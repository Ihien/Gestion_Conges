/**
 * LeaveCounter.gs - Gestion des soldes de conges
 * Principe : acquisition progressive de 2,5 jours/mois.
 * Le solde disponible = jours acquis au prorata - jours consommes.
 */

/**
 * Calcule le nombre de mois ecoules dans l'annee en cours
 * pour un employe, en tenant compte de sa date d'embauche.
 * Un mois entame compte comme un mois complet.
 */
function LeaveCounter_getMonthsWorkedThisYear_(dateEmbauche) {
  var now = new Date();
  var yearStart = new Date(now.getFullYear(), 0, 1);

  var startDate;
  if (dateEmbauche instanceof Date && dateEmbauche > yearStart) {
    startDate = dateEmbauche;
  } else {
    startDate = yearStart;
  }

  var startMonth = startDate.getMonth();
  var currentMonth = now.getMonth();

  return currentMonth - startMonth + 1;
}

/**
 * Calcule le solde acquis au prorata pour un employe.
 * acquis = min(moisTravailles * 2.5, soldeInitial)
 */
function LeaveCounter_getAcquiredBalance(email) {
  var row = SheetDAO_getRowByKey(SHEET_NAMES.EMPLOYES, COL_EMPLOYES.EMAIL, email);
  if (!row) return 0;

  var defaultSolde = parseInt(SheetDAO_getConfigValue('SOLDE_ANNUEL_DEFAUT')) || 30;
  var soldeInitial = parseInt(row[COL_EMPLOYES.SOLDE_INITIAL]) || defaultSolde;

  var dateEmbauche = row[COL_EMPLOYES.DATE_EMBAUCHE];
  if (dateEmbauche && !(dateEmbauche instanceof Date)) {
    dateEmbauche = new Date(dateEmbauche);
  }

  var mois = LeaveCounter_getMonthsWorkedThisYear_(dateEmbauche);
  var acquis = Math.min(mois * TAUX_ACQUISITION_MENSUEL, soldeInitial);
  return acquis;
}

/**
 * Calcule les jours consommes (valides) pour l'annee en cours.
 */
function LeaveCounter_getConsumedThisYear(email) {
  var allRows = SheetDAO_getAllRawData(SHEET_NAMES.DEMANDES);
  var now = new Date();
  var yearStart = new Date(now.getFullYear(), 0, 1);
  var consumed = 0;

  for (var i = 0; i < allRows.length; i++) {
    var emailEmp = String(allRows[i][COL_DEMANDES.EMAIL_EMP] || '').toLowerCase();
    if (emailEmp !== email.toLowerCase()) continue;

    var statut = allRows[i][COL_DEMANDES.STATUT];
    if (statut !== STATUS.VALIDE) continue;

    var typeConge = allRows[i][COL_DEMANDES.TYPE_CONGE];
    if (LEAVE_TYPES_DEDUCT_BALANCE.indexOf(typeConge) === -1) continue;

    var dateDebut = allRows[i][COL_DEMANDES.DATE_DEBUT];
    if (dateDebut instanceof Date && dateDebut >= yearStart) {
      consumed += parseInt(allRows[i][COL_DEMANDES.NB_JOURS]) || 0;
    }
  }

  return consumed;
}

/**
 * Retourne le solde disponible = acquis - consomme.
 * C'est la fonction principale utilisee partout.
 */
function LeaveCounter_getBalance(email) {
  var acquis = LeaveCounter_getAcquiredBalance(email);
  var consumed = LeaveCounter_getConsumedThisYear(email);
  var disponible = acquis - consumed;
  return Math.max(disponible, 0);
}

/**
 * Retourne le detail du solde (acquis, consomme, disponible, mois)
 */
function LeaveCounter_getBalanceDetail(email) {
  var row = SheetDAO_getRowByKey(SHEET_NAMES.EMPLOYES, COL_EMPLOYES.EMAIL, email);
  if (!row) return { acquis: 0, consomme: 0, disponible: 0, moisTravailles: 0, soldeAnnuel: 30 };

  var defaultSolde = parseInt(SheetDAO_getConfigValue('SOLDE_ANNUEL_DEFAUT')) || 30;
  var soldeInitial = parseInt(row[COL_EMPLOYES.SOLDE_INITIAL]) || defaultSolde;

  var dateEmbauche = row[COL_EMPLOYES.DATE_EMBAUCHE];
  if (dateEmbauche && !(dateEmbauche instanceof Date)) {
    dateEmbauche = new Date(dateEmbauche);
  }

  var mois = LeaveCounter_getMonthsWorkedThisYear_(dateEmbauche);
  var acquis = Math.min(mois * TAUX_ACQUISITION_MENSUEL, soldeInitial);
  var consumed = LeaveCounter_getConsumedThisYear(email);
  var disponible = Math.max(acquis - consumed, 0);

  return {
    acquis: acquis,
    consomme: consumed,
    disponible: disponible,
    moisTravailles: mois,
    soldeAnnuel: soldeInitial,
    tauxMensuel: TAUX_ACQUISITION_MENSUEL
  };
}

/**
 * Verifie si l'employe a un solde suffisant
 */
function LeaveCounter_hasEnoughLeave(email, nbJours) {
  var balance = LeaveCounter_getBalance(email);
  return balance >= nbJours;
}

/**
 * Deduit des jours du solde (appele lors de la validation)
 * Avec le systeme au prorata, la deduction est tracee par la demande validee.
 * Cette fonction met a jour le champ SOLDE_CONGES pour affichage rapide.
 */
function LeaveCounter_deductLeave(email, nbJours) {
  var rowNumber = SheetDAO_getRowNumber(SHEET_NAMES.EMPLOYES, COL_EMPLOYES.EMAIL, email);
  if (rowNumber === -1) {
    console.error('LeaveCounter: employe non trouve: ' + email);
    return;
  }

  var newBalance = LeaveCounter_getBalance(email);

  var updates = {};
  updates[COL_EMPLOYES.SOLDE_CONGES] = newBalance;
  SheetDAO_updateCells(SHEET_NAMES.EMPLOYES, rowNumber, updates);
}

/**
 * Credite des jours au solde (correction administrative)
 */
function LeaveCounter_creditLeave(email, nbJours) {
  var rowNumber = SheetDAO_getRowNumber(SHEET_NAMES.EMPLOYES, COL_EMPLOYES.EMAIL, email);
  if (rowNumber === -1) {
    throw new Error('Employe non trouve: ' + email);
  }

  var currentBalance = parseInt(SheetDAO_getRowByKey(SHEET_NAMES.EMPLOYES, COL_EMPLOYES.EMAIL, email)[COL_EMPLOYES.SOLDE_CONGES]) || 0;
  var newBalance = currentBalance + parseInt(nbJours);

  var updates = {};
  updates[COL_EMPLOYES.SOLDE_CONGES] = newBalance;
  SheetDAO_updateCells(SHEET_NAMES.EMPLOYES, rowNumber, updates);
}

/**
 * Retourne les soldes de l'equipe d'un manager
 */
function LeaveCounter_getTeamBalances(userProfile) {
  var allRows = SheetDAO_getAllRawData(SHEET_NAMES.EMPLOYES);
  var results = [];

  for (var i = 0; i < allRows.length; i++) {
    var emp = buildEmployeeObject(allRows[i]);
    var canSee = false;

    if (userProfile.role === ROLES.RH || userProfile.role === ROLES.DIRECTEUR_GENERAL) {
      canSee = true;
    }
    else if ((userProfile.role === ROLES.CHEF_AGENCE || userProfile.role === ROLES.CHEF_AGENCE_SENIOR) && emp.agence === userProfile.agence) {
      canSee = true;
    }
    else if (userProfile.role === ROLES.CHEF_DEPARTEMENT && emp.departement === userProfile.departement) {
      canSee = true;
    }
    else if (emp.managerEmail && emp.managerEmail.toLowerCase() === userProfile.email.toLowerCase()) {
      canSee = true;
    }

    if (canSee) {
      var detail = LeaveCounter_getBalanceDetail(emp.email);
      results.push({
        nom: emp.nom,
        prenom: emp.prenom,
        matricule: emp.matricule,
        departement: emp.departement,
        agence: emp.agence,
        soldeConges: detail.disponible,
        acquis: detail.acquis,
        consomme: detail.consomme,
        soldeInitial: detail.soldeAnnuel
      });
    }
  }

  return results;
}

/**
 * Recalcule le champ SOLDE_CONGES pour tous les employes actifs.
 * A executer periodiquement (mensuel) pour mettre a jour le cache.
 */
function LeaveCounter_refreshAllBalances() {
  var sheet = SheetDAO_getSheet(SHEET_NAMES.EMPLOYES);
  if (!sheet) return;

  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var actif = data[i][COL_EMPLOYES.ACTIF];
    if (actif === true || actif === 'TRUE') {
      var email = data[i][COL_EMPLOYES.EMAIL];
      if (email) {
        var balance = LeaveCounter_getBalance(email);
        sheet.getRange(i + 1, COL_EMPLOYES.SOLDE_CONGES + 1).setValue(balance);
      }
    }
  }

  Logger.log('Soldes recalcules au prorata pour tous les employes actifs.');
}

/**
 * Reinitialise les soldes en debut d'annee.
 * Remet le compteur a 0 consomme (les demandes de l'annee precedente
 * ne comptent plus). Le champ SOLDE_CONGES est mis a 0 et sera
 * recalcule par le prorata mensuel.
 */
function LeaveCounter_initializeAnnualBalances() {
  var sheet = SheetDAO_getSheet(SHEET_NAMES.EMPLOYES);
  if (!sheet) return;

  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var actif = data[i][COL_EMPLOYES.ACTIF];
    if (actif === true || actif === 'TRUE') {
      sheet.getRange(i + 1, COL_EMPLOYES.SOLDE_CONGES + 1).setValue(0);
    }
  }

  Logger.log('Soldes annuels reinitialises. Le prorata mensuel demarre.');
}
