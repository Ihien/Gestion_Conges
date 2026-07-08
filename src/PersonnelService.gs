/**
 * PersonnelService.gs - Gestion administrative du personnel
 * Dossier employe enrichi, annuaire, mouvements
 */

/**
 * Retourne le profil complet d'un employe (tous les champs)
 */
function PersonnelService_getFullProfile(email) {
  var row = SheetDAO_getRowByKey(SHEET_NAMES.EMPLOYES, COL_EMPLOYES.EMAIL, email);
  if (!row) return null;
  var profile = buildEmployeeObject(row);
  if (profile.dateEmbauche) {
    var embauche = parseDate(profile.dateEmbauche);
    if (embauche) {
      var now = new Date();
      var diffMs = now - embauche;
      var years = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
      var months = Math.floor((diffMs % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
      profile.anciennete = years + ' an' + (years > 1 ? 's' : '') + ' ' + months + ' mois';
    }
  }
  return profile;
}

/**
 * Met a jour le profil enrichi d'un employe (champs personnels, contrat, contacts)
 */
function PersonnelService_updateFullProfile(data) {
  if (!data || !data.email) throw new Error('Email employe requis.');

  var rowNumber = SheetDAO_getRowNumber(SHEET_NAMES.EMPLOYES, COL_EMPLOYES.EMAIL, data.email);
  if (rowNumber === -1) throw new Error('Employe non trouve: ' + data.email);

  var updates = {};
  var fields = {
    nom: COL_EMPLOYES.NOM,
    prenom: COL_EMPLOYES.PRENOM,
    poste: COL_EMPLOYES.POSTE,
    departement: COL_EMPLOYES.DEPARTEMENT,
    agence: COL_EMPLOYES.AGENCE,
    managerEmail: COL_EMPLOYES.MANAGER_EMAIL,
    role: COL_EMPLOYES.ROLE,
    soldeConges: COL_EMPLOYES.SOLDE_CONGES,
    soldeInitial: COL_EMPLOYES.SOLDE_INITIAL,
    actif: COL_EMPLOYES.ACTIF,
    dateNaissance: COL_EMPLOYES.DATE_NAISSANCE,
    lieuNaissance: COL_EMPLOYES.LIEU_NAISSANCE,
    nationalite: COL_EMPLOYES.NATIONALITE,
    numCni: COL_EMPLOYES.NUM_CNI,
    situationFamiliale: COL_EMPLOYES.SITUATION_FAMILIALE,
    nbEnfants: COL_EMPLOYES.NB_ENFANTS,
    telephone: COL_EMPLOYES.TELEPHONE,
    telephonePro: COL_EMPLOYES.TELEPHONE_PRO,
    adresse: COL_EMPLOYES.ADRESSE,
    contactUrgenceNom: COL_EMPLOYES.CONTACT_URGENCE_NOM,
    contactUrgenceTel: COL_EMPLOYES.CONTACT_URGENCE_TEL,
    contactUrgenceLien: COL_EMPLOYES.CONTACT_URGENCE_LIEN,
    typeContrat: COL_EMPLOYES.TYPE_CONTRAT,
    dateEmbauche: COL_EMPLOYES.DATE_EMBAUCHE,
    dateFinContrat: COL_EMPLOYES.DATE_FIN_CONTRAT,
    dateFinEssai: COL_EMPLOYES.DATE_FIN_ESSAI,
    photoUrl: COL_EMPLOYES.PHOTO_URL
  };

  for (var key in fields) {
    if (data[key] !== undefined) {
      var val = data[key];
      if (key === 'soldeConges' || key === 'soldeInitial' || key === 'nbEnfants') {
        val = parseInt(val) || 0;
      }
      if (key === 'dateNaissance' || key === 'dateEmbauche' || key === 'dateFinContrat' || key === 'dateFinEssai') {
        if (val && typeof val === 'string') val = parseDate(val) || val;
      }
      updates[fields[key]] = val;
    }
  }

  if (Object.keys(updates).length > 0) {
    SheetDAO_updateCells(SHEET_NAMES.EMPLOYES, rowNumber, updates);
  }
  return { success: true };
}

/**
 * Retourne l'annuaire du personnel (tous les employes actifs, champs non sensibles)
 */
function PersonnelService_getAnnuaire(userProfile) {
  var allRows = SheetDAO_getAllRawData(SHEET_NAMES.EMPLOYES);
  var results = [];

  for (var i = 0; i < allRows.length; i++) {
    var actif = allRows[i][COL_EMPLOYES.ACTIF];
    if (actif !== true && actif !== 'TRUE') continue;

    results.push({
      email: allRows[i][COL_EMPLOYES.EMAIL] || '',
      matricule: allRows[i][COL_EMPLOYES.MATRICULE] || '',
      nom: allRows[i][COL_EMPLOYES.NOM] || '',
      prenom: allRows[i][COL_EMPLOYES.PRENOM] || '',
      poste: allRows[i][COL_EMPLOYES.POSTE] || '',
      departement: allRows[i][COL_EMPLOYES.DEPARTEMENT] || '',
      agence: allRows[i][COL_EMPLOYES.AGENCE] || '',
      telephonePro: allRows[i][COL_EMPLOYES.TELEPHONE_PRO] || '',
      photoUrl: allRows[i][COL_EMPLOYES.PHOTO_URL] || ''
    });
  }

  results.sort(function(a, b) {
    return (a.nom + a.prenom).localeCompare(b.nom + b.prenom);
  });

  return results;
}

/**
 * Retourne les donnees d'organigramme (hierarchie basee sur managerEmail)
 */
function PersonnelService_getOrgChart(userProfile) {
  var allRows = SheetDAO_getAllRawData(SHEET_NAMES.EMPLOYES);
  var employees = [];

  for (var i = 0; i < allRows.length; i++) {
    var actif = allRows[i][COL_EMPLOYES.ACTIF];
    if (actif !== true && actif !== 'TRUE') continue;

    employees.push({
      email: allRows[i][COL_EMPLOYES.EMAIL] || '',
      nom: allRows[i][COL_EMPLOYES.NOM] || '',
      prenom: allRows[i][COL_EMPLOYES.PRENOM] || '',
      poste: allRows[i][COL_EMPLOYES.POSTE] || '',
      departement: allRows[i][COL_EMPLOYES.DEPARTEMENT] || '',
      agence: allRows[i][COL_EMPLOYES.AGENCE] || '',
      managerEmail: allRows[i][COL_EMPLOYES.MANAGER_EMAIL] || '',
      role: allRows[i][COL_EMPLOYES.ROLE] || '',
      photoUrl: allRows[i][COL_EMPLOYES.PHOTO_URL] || ''
    });
  }

  return employees;
}

/**
 * Enregistre un mouvement de personnel
 */
function PersonnelService_recordMovement(data, creatorEmail) {
  var mouvementId = generateUUID();
  var now = new Date();

  var row = [];
  row[COL_MOUVEMENTS.MOUVEMENT_ID] = mouvementId;
  row[COL_MOUVEMENTS.DATE_MOUVEMENT] = now;
  row[COL_MOUVEMENTS.EMAIL_EMP] = data.emailEmp || '';
  row[COL_MOUVEMENTS.TYPE] = data.type || '';
  row[COL_MOUVEMENTS.ANCIEN_POSTE] = data.ancienPoste || '';
  row[COL_MOUVEMENTS.NOUVEAU_POSTE] = data.nouveauPoste || '';
  row[COL_MOUVEMENTS.ANCIEN_DEPT] = data.ancienDept || '';
  row[COL_MOUVEMENTS.NOUVEAU_DEPT] = data.nouveauDept || '';
  row[COL_MOUVEMENTS.ANCIENNE_AGENCE] = data.ancienneAgence || '';
  row[COL_MOUVEMENTS.NOUVELLE_AGENCE] = data.nouvelleAgence || '';
  row[COL_MOUVEMENTS.MOTIF] = data.motif || '';
  row[COL_MOUVEMENTS.DOCUMENT_URL] = data.documentUrl || '';
  row[COL_MOUVEMENTS.CREATED_BY] = creatorEmail;
  row[COL_MOUVEMENTS.DATE_EFFET] = data.dateEffet ? parseDate(data.dateEffet) : now;

  SheetDAO_appendRow(SHEET_NAMES_SIRH.MOUVEMENTS, row);

  if (data.type === 'Promotion' || data.type === 'Mutation') {
    var empUpdates = {};
    if (data.nouveauPoste) empUpdates.poste = data.nouveauPoste;
    if (data.nouveauDept) empUpdates.departement = data.nouveauDept;
    if (data.nouvelleAgence !== undefined) empUpdates.agence = data.nouvelleAgence;
    if (Object.keys(empUpdates).length > 0) {
      empUpdates.email = data.emailEmp;
      PersonnelService_updateFullProfile(empUpdates);
    }
  }

  if (data.type === 'Depart') {
    var departures = {};
    departures.email = data.emailEmp;
    departures.actif = false;
    PersonnelService_updateFullProfile(departures);
  }

  return { success: true, mouvementId: mouvementId };
}

/**
 * Retourne les mouvements d'un employe
 */
function PersonnelService_getEmployeeMovements(emailEmp) {
  var allRows = SheetDAO_getAllRawData(SHEET_NAMES_SIRH.MOUVEMENTS);
  var results = [];

  for (var i = 0; i < allRows.length; i++) {
    if (String(allRows[i][COL_MOUVEMENTS.EMAIL_EMP]).toLowerCase() === emailEmp.toLowerCase()) {
      results.push({
        mouvementId: allRows[i][COL_MOUVEMENTS.MOUVEMENT_ID] || '',
        dateMouvement: allRows[i][COL_MOUVEMENTS.DATE_MOUVEMENT] instanceof Date ? formatDate(allRows[i][COL_MOUVEMENTS.DATE_MOUVEMENT]) : String(allRows[i][COL_MOUVEMENTS.DATE_MOUVEMENT] || ''),
        type: allRows[i][COL_MOUVEMENTS.TYPE] || '',
        ancienPoste: allRows[i][COL_MOUVEMENTS.ANCIEN_POSTE] || '',
        nouveauPoste: allRows[i][COL_MOUVEMENTS.NOUVEAU_POSTE] || '',
        ancienDept: allRows[i][COL_MOUVEMENTS.ANCIEN_DEPT] || '',
        nouveauDept: allRows[i][COL_MOUVEMENTS.NOUVEAU_DEPT] || '',
        ancienneAgence: allRows[i][COL_MOUVEMENTS.ANCIENNE_AGENCE] || '',
        nouvelleAgence: allRows[i][COL_MOUVEMENTS.NOUVELLE_AGENCE] || '',
        motif: allRows[i][COL_MOUVEMENTS.MOTIF] || '',
        dateEffet: allRows[i][COL_MOUVEMENTS.DATE_EFFET] instanceof Date ? formatDate(allRows[i][COL_MOUVEMENTS.DATE_EFFET]) : String(allRows[i][COL_MOUVEMENTS.DATE_EFFET] || '')
      });
    }
  }

  results.sort(function(a, b) { return a.dateMouvement > b.dateMouvement ? -1 : 1; });
  return results;
}

/**
 * Retourne les alertes echeances (fin essai, fin CDD) dans les 30 prochains jours
 */
function PersonnelService_getAlerts() {
  var allRows = SheetDAO_getAllRawData(SHEET_NAMES.EMPLOYES);
  var alerts = [];
  var now = new Date();
  var in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  for (var i = 0; i < allRows.length; i++) {
    var actif = allRows[i][COL_EMPLOYES.ACTIF];
    if (actif !== true && actif !== 'TRUE') continue;

    var nom = allRows[i][COL_EMPLOYES.NOM] + ' ' + allRows[i][COL_EMPLOYES.PRENOM];
    var email = allRows[i][COL_EMPLOYES.EMAIL];

    var finEssai = allRows[i][COL_EMPLOYES.DATE_FIN_ESSAI];
    if (finEssai instanceof Date && finEssai >= now && finEssai <= in30Days) {
      alerts.push({ type: 'Fin periode essai', employe: nom, email: email, date: formatDate(finEssai), urgence: finEssai <= new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000) ? 'haute' : 'normale' });
    }

    var finContrat = allRows[i][COL_EMPLOYES.DATE_FIN_CONTRAT];
    if (finContrat instanceof Date && finContrat >= now && finContrat <= in30Days) {
      alerts.push({ type: 'Fin de CDD', employe: nom, email: email, date: formatDate(finContrat), urgence: finContrat <= new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000) ? 'haute' : 'normale' });
    }
  }

  alerts.sort(function(a, b) { return parseDate(a.date) - parseDate(b.date); });
  return alerts;
}
