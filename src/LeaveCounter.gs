/**
 * LeaveCounter.gs - Gestion des soldes de conges
 */

/**
 * Retourne le solde de conges d'un employe
 */
function LeaveCounter_getBalance(email) {
  var row = SheetDAO_getRowByKey(SHEET_NAMES.EMPLOYES, COL_EMPLOYES.EMAIL, email);
  if (!row) return 0;
  return parseInt(row[COL_EMPLOYES.SOLDE_CONGES]) || 0;
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
 * Uniquement pour les conges payes
 */
function LeaveCounter_deductLeave(email, nbJours) {
  var rowNumber = SheetDAO_getRowNumber(SHEET_NAMES.EMPLOYES, COL_EMPLOYES.EMAIL, email);
  if (rowNumber === -1) {
    console.error('LeaveCounter: employe non trouve: ' + email);
    return;
  }

  var currentBalance = LeaveCounter_getBalance(email);
  var newBalance = currentBalance - parseInt(nbJours);

  if (newBalance < 0) {
    console.warn('LeaveCounter: solde negatif pour ' + email + ': ' + newBalance);
  }

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

  var currentBalance = LeaveCounter_getBalance(email);
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

    // RH et DG voient tout
    if (userProfile.role === ROLES.RH || userProfile.role === ROLES.DIRECTEUR_GENERAL) {
      canSee = true;
    }
    // Chef d'agence voit son agence
    else if ((userProfile.role === ROLES.CHEF_AGENCE || userProfile.role === ROLES.CHEF_AGENCE_SENIOR) && emp.agence === userProfile.agence) {
      canSee = true;
    }
    // Chef de departement voit son departement
    else if (userProfile.role === ROLES.CHEF_DEPARTEMENT && emp.departement === userProfile.departement) {
      canSee = true;
    }
    // Manager direct
    else if (emp.managerEmail && emp.managerEmail.toLowerCase() === userProfile.email.toLowerCase()) {
      canSee = true;
    }

    if (canSee) {
      results.push({
        nom: emp.nom,
        prenom: emp.prenom,
        matricule: emp.matricule,
        departement: emp.departement,
        agence: emp.agence,
        soldeConges: emp.soldeConges,
        soldeInitial: emp.soldeInitial
      });
    }
  }

  return results;
}

/**
 * Reinitialise les soldes annuels pour tous les employes actifs
 * A executer une fois par an
 */
function LeaveCounter_initializeAnnualBalances() {
  var sheet = SheetDAO_getSheet(SHEET_NAMES.EMPLOYES);
  if (!sheet) return;

  var data = sheet.getDataRange().getValues();
  var defaultSolde = parseInt(SheetDAO_getConfigValue('SOLDE_ANNUEL_DEFAUT')) || 30;

  for (var i = 1; i < data.length; i++) {
    var actif = data[i][COL_EMPLOYES.ACTIF];
    if (actif === true || actif === 'TRUE') {
      var soldeInitial = parseInt(data[i][COL_EMPLOYES.SOLDE_INITIAL]) || defaultSolde;
      sheet.getRange(i + 1, COL_EMPLOYES.SOLDE_CONGES + 1).setValue(soldeInitial);
    }
  }

  Logger.log('Soldes annuels reinitialises pour tous les employes actifs.');
}
