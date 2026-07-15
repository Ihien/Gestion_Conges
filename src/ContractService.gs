/**
 * ContractService.gs - Gestion du cycle de vie des contrats
 * Creation, renouvellement, resiliation, alertes echeances
 */

/**
 * Cree un nouveau contrat pour un employe
 */
function ContractService_create(data, creatorEmail) {
  if (!data.emailEmp) throw new Error('Email employe requis.');
  if (!data.typeContrat) throw new Error('Type de contrat requis.');
  if (!data.dateDebut) throw new Error('Date de debut requise.');

  var emp = SheetDAO_getRowByKey(SHEET_NAMES.EMPLOYES, COL_EMPLOYES.EMAIL, data.emailEmp);
  if (!emp) throw new Error('Employe non trouve: ' + data.emailEmp);

  var actifs = ContractService_getByEmployee(data.emailEmp);
  for (var i = 0; i < actifs.length; i++) {
    if (actifs[i].statut === CONTRACT_STATUS.ACTIF) {
      throw new Error('Un contrat actif existe deja. Renouvelez ou resiliez-le d\'abord.');
    }
  }

  var contratId = generateUUID();
  var now = new Date();
  var row = [];
  row[COL_CONTRATS.CONTRAT_ID] = contratId;
  row[COL_CONTRATS.EMAIL_EMP] = data.emailEmp;
  row[COL_CONTRATS.TYPE_CONTRAT] = data.typeContrat;
  row[COL_CONTRATS.DATE_DEBUT] = parseDate(data.dateDebut) || data.dateDebut;
  row[COL_CONTRATS.DATE_FIN] = data.dateFin ? (parseDate(data.dateFin) || data.dateFin) : '';
  row[COL_CONTRATS.DUREE_MOIS] = parseInt(data.dureeMois) || '';
  row[COL_CONTRATS.PERIODE_ESSAI_FIN] = data.periodeEssaiFin ? (parseDate(data.periodeEssaiFin) || data.periodeEssaiFin) : '';
  row[COL_CONTRATS.STATUT] = CONTRACT_STATUS.ACTIF;
  row[COL_CONTRATS.MOTIF_FIN] = '';
  row[COL_CONTRATS.DOCUMENT_URL] = data.documentUrl || '';
  row[COL_CONTRATS.RENOUVELE_PAR] = '';
  row[COL_CONTRATS.CREATED_BY] = creatorEmail;
  row[COL_CONTRATS.CREATED_AT] = now;

  SheetDAO_appendRow(SHEET_NAMES_SIRH.CONTRATS, row);

  var empUpdates = { email: data.emailEmp, typeContrat: data.typeContrat, dateEmbauche: data.dateDebut };
  if (data.dateFin) empUpdates.dateFinContrat = data.dateFin;
  if (data.periodeEssaiFin) empUpdates.dateFinEssai = data.periodeEssaiFin;
  PersonnelService_updateFullProfile(empUpdates);

  SheetDAO_appendRow(SHEET_NAMES.AUDIT, [
    now, creatorEmail, 'RH', contratId, 'CONTRACT_CREATED', '', CONTRACT_STATUS.ACTIF,
    data.typeContrat + ' pour ' + data.emailEmp
  ]);

  return { success: true, contratId: contratId };
}

/**
 * Renouvelle un contrat existant (CDD -> CDD ou CDD -> CDI)
 */
function ContractService_renew(contratId, newData, creatorEmail) {
  var sheet = SheetDAO_getSheet(SHEET_NAMES_SIRH.CONTRATS);
  if (!sheet) throw new Error('Feuille Contrats non trouvee.');

  var data = sheet.getDataRange().getValues();
  var oldRow = -1;
  var emailEmp = '';

  for (var i = 1; i < data.length; i++) {
    if (data[i][COL_CONTRATS.CONTRAT_ID] === contratId) {
      oldRow = i + 1;
      emailEmp = data[i][COL_CONTRATS.EMAIL_EMP];
      break;
    }
  }
  if (oldRow === -1) throw new Error('Contrat non trouve.');

  var newContratId = generateUUID();
  var now = new Date();

  var updates = {};
  updates[COL_CONTRATS.STATUT] = CONTRACT_STATUS.RENOUVELE;
  updates[COL_CONTRATS.RENOUVELE_PAR] = newContratId;
  SheetDAO_updateCells(SHEET_NAMES_SIRH.CONTRATS, oldRow, updates);

  var row = [];
  row[COL_CONTRATS.CONTRAT_ID] = newContratId;
  row[COL_CONTRATS.EMAIL_EMP] = emailEmp;
  row[COL_CONTRATS.TYPE_CONTRAT] = newData.typeContrat || 'CDD';
  row[COL_CONTRATS.DATE_DEBUT] = parseDate(newData.dateDebut) || newData.dateDebut;
  row[COL_CONTRATS.DATE_FIN] = newData.dateFin ? (parseDate(newData.dateFin) || newData.dateFin) : '';
  row[COL_CONTRATS.DUREE_MOIS] = parseInt(newData.dureeMois) || '';
  row[COL_CONTRATS.PERIODE_ESSAI_FIN] = newData.periodeEssaiFin ? (parseDate(newData.periodeEssaiFin) || newData.periodeEssaiFin) : '';
  row[COL_CONTRATS.STATUT] = CONTRACT_STATUS.ACTIF;
  row[COL_CONTRATS.MOTIF_FIN] = '';
  row[COL_CONTRATS.DOCUMENT_URL] = newData.documentUrl || '';
  row[COL_CONTRATS.RENOUVELE_PAR] = '';
  row[COL_CONTRATS.CREATED_BY] = creatorEmail;
  row[COL_CONTRATS.CREATED_AT] = now;

  SheetDAO_appendRow(SHEET_NAMES_SIRH.CONTRATS, row);

  var empUpdates = { email: emailEmp, typeContrat: newData.typeContrat || 'CDD' };
  if (newData.dateFin) empUpdates.dateFinContrat = newData.dateFin;
  else if (newData.typeContrat === 'CDI') empUpdates.dateFinContrat = '';
  if (newData.periodeEssaiFin) empUpdates.dateFinEssai = newData.periodeEssaiFin;
  PersonnelService_updateFullProfile(empUpdates);

  SheetDAO_appendRow(SHEET_NAMES.AUDIT, [
    now, creatorEmail, 'RH', newContratId, 'CONTRACT_RENEWED', CONTRACT_STATUS.RENOUVELE, CONTRACT_STATUS.ACTIF,
    'Renouvellement ' + (newData.typeContrat || 'CDD') + ' pour ' + emailEmp
  ]);

  return { success: true, contratId: newContratId };
}

/**
 * Resilie un contrat
 */
function ContractService_terminate(contratId, motif, creatorEmail) {
  var sheet = SheetDAO_getSheet(SHEET_NAMES_SIRH.CONTRATS);
  if (!sheet) throw new Error('Feuille Contrats non trouvee.');

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][COL_CONTRATS.CONTRAT_ID] === contratId) {
      var updates = {};
      updates[COL_CONTRATS.STATUT] = CONTRACT_STATUS.RESILIE;
      updates[COL_CONTRATS.MOTIF_FIN] = motif || '';
      SheetDAO_updateCells(SHEET_NAMES_SIRH.CONTRATS, i + 1, updates);

      SheetDAO_appendRow(SHEET_NAMES.AUDIT, [
        new Date(), creatorEmail, 'RH', contratId, 'CONTRACT_TERMINATED', CONTRACT_STATUS.ACTIF, CONTRACT_STATUS.RESILIE,
        motif || ''
      ]);

      return { success: true };
    }
  }
  throw new Error('Contrat non trouve.');
}

/**
 * Retourne les contrats d'un employe
 */
function ContractService_getByEmployee(emailEmp) {
  var rows = SheetDAO_getRowsByKey(SHEET_NAMES_SIRH.CONTRATS, COL_CONTRATS.EMAIL_EMP, emailEmp);
  return rows.map(function(r) {
    return {
      contratId: r[COL_CONTRATS.CONTRAT_ID] || '',
      emailEmp: r[COL_CONTRATS.EMAIL_EMP] || '',
      typeContrat: r[COL_CONTRATS.TYPE_CONTRAT] || '',
      dateDebut: r[COL_CONTRATS.DATE_DEBUT] instanceof Date ? formatDate(r[COL_CONTRATS.DATE_DEBUT]) : String(r[COL_CONTRATS.DATE_DEBUT] || ''),
      dateFin: r[COL_CONTRATS.DATE_FIN] instanceof Date ? formatDate(r[COL_CONTRATS.DATE_FIN]) : String(r[COL_CONTRATS.DATE_FIN] || ''),
      dureeMois: r[COL_CONTRATS.DUREE_MOIS] || '',
      periodeEssaiFin: r[COL_CONTRATS.PERIODE_ESSAI_FIN] instanceof Date ? formatDate(r[COL_CONTRATS.PERIODE_ESSAI_FIN]) : String(r[COL_CONTRATS.PERIODE_ESSAI_FIN] || ''),
      statut: r[COL_CONTRATS.STATUT] || '',
      motifFin: r[COL_CONTRATS.MOTIF_FIN] || '',
      documentUrl: r[COL_CONTRATS.DOCUMENT_URL] || '',
      renouvelePar: r[COL_CONTRATS.RENOUVELE_PAR] || ''
    };
  }).sort(function(a, b) { return a.dateDebut > b.dateDebut ? -1 : 1; });
}

/**
 * Retourne tous les contrats actifs (vue RH)
 */
function ContractService_getAllActive() {
  var allRows = SheetDAO_getAllRawData(SHEET_NAMES_SIRH.CONTRATS);
  var empData = SheetDAO_getAllRawData(SHEET_NAMES.EMPLOYES);
  var empMap = {};
  for (var k = 0; k < empData.length; k++) {
    empMap[String(empData[k][COL_EMPLOYES.EMAIL]).toLowerCase()] = empData[k];
  }

  var results = [];
  for (var i = 0; i < allRows.length; i++) {
    var r = allRows[i];
    if (r[COL_CONTRATS.STATUT] !== CONTRACT_STATUS.ACTIF) continue;

    var email = String(r[COL_CONTRATS.EMAIL_EMP]).toLowerCase();
    var emp = empMap[email];
    results.push({
      contratId: r[COL_CONTRATS.CONTRAT_ID] || '',
      emailEmp: r[COL_CONTRATS.EMAIL_EMP] || '',
      nom: emp ? (emp[COL_EMPLOYES.NOM] || '') : '',
      prenom: emp ? (emp[COL_EMPLOYES.PRENOM] || '') : '',
      departement: emp ? (emp[COL_EMPLOYES.DEPARTEMENT] || '') : '',
      typeContrat: r[COL_CONTRATS.TYPE_CONTRAT] || '',
      dateDebut: r[COL_CONTRATS.DATE_DEBUT] instanceof Date ? formatDate(r[COL_CONTRATS.DATE_DEBUT]) : String(r[COL_CONTRATS.DATE_DEBUT] || ''),
      dateFin: r[COL_CONTRATS.DATE_FIN] instanceof Date ? formatDate(r[COL_CONTRATS.DATE_FIN]) : String(r[COL_CONTRATS.DATE_FIN] || ''),
      periodeEssaiFin: r[COL_CONTRATS.PERIODE_ESSAI_FIN] instanceof Date ? formatDate(r[COL_CONTRATS.PERIODE_ESSAI_FIN]) : String(r[COL_CONTRATS.PERIODE_ESSAI_FIN] || ''),
      statut: r[COL_CONTRATS.STATUT] || ''
    });
  }

  return results;
}

/**
 * Retourne les alertes de contrat (echeances proches)
 */
function ContractService_getAlerts() {
  var allRows = SheetDAO_getAllRawData(SHEET_NAMES_SIRH.CONTRATS);
  var empData = SheetDAO_getAllRawData(SHEET_NAMES.EMPLOYES);
  var empMap = {};
  for (var k = 0; k < empData.length; k++) {
    empMap[String(empData[k][COL_EMPLOYES.EMAIL]).toLowerCase()] = empData[k];
  }

  var now = new Date();
  var in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  var in15 = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
  var alerts = [];

  for (var i = 0; i < allRows.length; i++) {
    var r = allRows[i];
    if (r[COL_CONTRATS.STATUT] !== CONTRACT_STATUS.ACTIF) continue;
    var email = String(r[COL_CONTRATS.EMAIL_EMP]).toLowerCase();
    var emp = empMap[email];
    var nom = emp ? (emp[COL_EMPLOYES.NOM] + ' ' + emp[COL_EMPLOYES.PRENOM]) : email;

    var finContrat = r[COL_CONTRATS.DATE_FIN];
    if (finContrat instanceof Date && finContrat >= now && finContrat <= in30) {
      alerts.push({
        type: 'Fin de contrat ' + (r[COL_CONTRATS.TYPE_CONTRAT] || ''),
        employe: nom, email: r[COL_CONTRATS.EMAIL_EMP] || '',
        date: formatDate(finContrat),
        urgence: finContrat <= in15 ? 'haute' : 'normale',
        contratId: r[COL_CONTRATS.CONTRAT_ID] || ''
      });
    }

    var finEssai = r[COL_CONTRATS.PERIODE_ESSAI_FIN];
    if (finEssai instanceof Date && finEssai >= now && finEssai <= in30) {
      alerts.push({
        type: 'Fin periode essai',
        employe: nom, email: r[COL_CONTRATS.EMAIL_EMP] || '',
        date: formatDate(finEssai),
        urgence: finEssai <= in15 ? 'haute' : 'normale',
        contratId: r[COL_CONTRATS.CONTRAT_ID] || ''
      });
    }
  }

  alerts.sort(function(a, b) { return parseDate(a.date) - parseDate(b.date); });
  return alerts;
}
