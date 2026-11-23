/**
 * LeaveCounter.gs - Gestion des soldes de conges
 * Modele : solde de depart (SOLDE_CONGES) + acquisition mensuelle de 2,5 j/mois
 * Regle de perte : 30 jours de report perdus apres 60 jours dans la nouvelle annee
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
 * Calcule la perte de jours de report selon la regle des 60 jours.
 * Si on est a plus de 60 jours dans l'annee, les jours de report
 * (solde de depart) sont reduits de 30 jours maximum.
 */
function LeaveCounter_getReportLoss_(soldeDepart) {
  if (soldeDepart <= 0) return 0;

  var now = new Date();
  var yearStart = new Date(now.getFullYear(), 0, 1);
  var daysSinceYearStart = Math.floor((now - yearStart) / (24 * 60 * 60 * 1000));

  if (daysSinceYearStart >= DELAI_EXPIRATION_REPORT) {
    return Math.min(JOURS_PERDUS_REPORT, soldeDepart);
  }
  return 0;
}

/**
 * Calcule le solde acquis au prorata pour un employe.
 * acquis = soldeDepart - perte60j + min(moisTravailles * 2.5, soldeInitial)
 */
function LeaveCounter_getAcquiredBalance(email) {
  var row = SheetDAO_getRowByKey(SHEET_NAMES.EMPLOYES, COL_EMPLOYES.EMAIL, email);
  if (!row) return 0;

  var defaultSolde = parseInt(SheetDAO_getConfigValue('SOLDE_ANNUEL_DEFAUT')) || 30;
  var soldeInitial = parseInt(row[COL_EMPLOYES.SOLDE_INITIAL]) || defaultSolde;
  var soldeDepart = parseFloat(row[COL_EMPLOYES.SOLDE_CONGES]) || 0;

  var dateEmbauche = row[COL_EMPLOYES.DATE_EMBAUCHE];
  if (dateEmbauche && !(dateEmbauche instanceof Date)) {
    dateEmbauche = new Date(dateEmbauche);
  }

  var perte = LeaveCounter_getReportLoss_(soldeDepart);
  var soldeReportAjuste = soldeDepart - perte;

  var mois = LeaveCounter_getMonthsWorkedThisYear_(dateEmbauche);
  var gainsMensuels = Math.min(mois * TAUX_ACQUISITION_MENSUEL, soldeInitial);

  return soldeReportAjuste + gainsMensuels;
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
 */
function LeaveCounter_getBalance(email) {
  var acquis = LeaveCounter_getAcquiredBalance(email);
  var consumed = LeaveCounter_getConsumedThisYear(email);
  var disponible = acquis - consumed;
  return Math.max(disponible, 0);
}

/**
 * Retourne le detail complet du solde
 */
function LeaveCounter_getBalanceDetail(email) {
  var row = SheetDAO_getRowByKey(SHEET_NAMES.EMPLOYES, COL_EMPLOYES.EMAIL, email);
  if (!row) return { acquis: 0, consomme: 0, disponible: 0, moisTravailles: 0, soldeAnnuel: 30, soldeDepart: 0, perteReport: 0 };

  var defaultSolde = parseInt(SheetDAO_getConfigValue('SOLDE_ANNUEL_DEFAUT')) || 30;
  var soldeInitial = parseInt(row[COL_EMPLOYES.SOLDE_INITIAL]) || defaultSolde;
  var soldeDepart = parseFloat(row[COL_EMPLOYES.SOLDE_CONGES]) || 0;

  var dateEmbauche = row[COL_EMPLOYES.DATE_EMBAUCHE];
  if (dateEmbauche && !(dateEmbauche instanceof Date)) {
    dateEmbauche = new Date(dateEmbauche);
  }

  var perte = LeaveCounter_getReportLoss_(soldeDepart);
  var soldeReportAjuste = soldeDepart - perte;

  var mois = LeaveCounter_getMonthsWorkedThisYear_(dateEmbauche);
  var gainsMensuels = Math.min(mois * TAUX_ACQUISITION_MENSUEL, soldeInitial);
  var acquis = soldeReportAjuste + gainsMensuels;
  var consumed = LeaveCounter_getConsumedThisYear(email);
  var disponible = Math.max(acquis - consumed, 0);

  return {
    acquis: acquis,
    consomme: consumed,
    disponible: disponible,
    moisTravailles: mois,
    soldeAnnuel: soldeInitial,
    tauxMensuel: TAUX_ACQUISITION_MENSUEL,
    soldeDepart: soldeDepart,
    perteReport: perte
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
 * Met a jour le cache de solde apres validation d'un conge.
 * Le champ SOLDE_CONGES ne change pas (c'est le solde de depart),
 * seul le calcul dynamique reflète la deduction.
 */
function LeaveCounter_deductLeave(email, nbJours) {
  // Pas besoin de modifier SOLDE_CONGES car le solde est calcule dynamiquement.
  // La deduction est tracee via la demande validee dans la feuille Demandes.
  Logger.log('Deduction de ' + nbJours + ' jours pour ' + email + ' (tracee via demande validee)');
}

/**
 * Credite des jours au solde de depart (correction administrative)
 */
function LeaveCounter_creditLeave(email, nbJours) {
  var rowNumber = SheetDAO_getRowNumber(SHEET_NAMES.EMPLOYES, COL_EMPLOYES.EMAIL, email);
  if (rowNumber === -1) {
    throw new Error('Employe non trouve: ' + email);
  }

  var currentSolde = parseFloat(SheetDAO_getRowByKey(SHEET_NAMES.EMPLOYES, COL_EMPLOYES.EMAIL, email)[COL_EMPLOYES.SOLDE_CONGES]) || 0;
  var newSolde = currentSolde + parseFloat(nbJours);

  var updates = {};
  updates[COL_EMPLOYES.SOLDE_CONGES] = newSolde;
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
        soldeInitial: detail.soldeAnnuel,
        soldeDepart: detail.soldeDepart,
        perteReport: detail.perteReport
      });
    }
  }

  return results;
}

/**
 * Simulation annuelle des changements de solde pour test.
 * Simule mois par mois pour un employe fictif avec des evenements de conge.
 */
function LeaveCounter_simulateYear(params) {
  params = params || {};
  var soldeDepart = params.soldeDepart !== undefined ? params.soldeDepart : 15;
  var soldeAnnuel = params.soldeAnnuel || 30;
  var year = params.year || new Date().getFullYear();
  var congesSimules = params.conges || [
    { mois: 4, jours: 5, type: 'Conges payes' },
    { mois: 8, jours: 10, type: 'Conges payes' },
    { mois: 12, jours: 5, type: 'Conges payes' }
  ];

  var simulation = [];
  var totalConsomme = 0;

  for (var m = 1; m <= 12; m++) {
    var daysSinceYearStart = (m - 1) * 30;
    var perteReport = 0;
    if (daysSinceYearStart >= DELAI_EXPIRATION_REPORT && soldeDepart > 0) {
      perteReport = Math.min(JOURS_PERDUS_REPORT, soldeDepart);
    }
    var soldeReportAjuste = soldeDepart - perteReport;

    var gainsMensuels = Math.min(m * TAUX_ACQUISITION_MENSUEL, soldeAnnuel);

    var congesCeMois = 0;
    for (var c = 0; c < congesSimules.length; c++) {
      if (congesSimules[c].mois === m) {
        congesCeMois += congesSimules[c].jours;
      }
    }
    totalConsomme += congesCeMois;

    var acquis = soldeReportAjuste + gainsMensuels;
    var disponible = Math.max(acquis - totalConsomme, 0);

    var monthNames = ['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre'];
    simulation.push({
      mois: m,
      moisLabel: monthNames[m - 1] + ' ' + year,
      soldeDepart: soldeDepart,
      perteReport: perteReport,
      soldeReportAjuste: soldeReportAjuste,
      gainsMensuels: gainsMensuels,
      congesPris: congesCeMois,
      totalConsomme: totalConsomme,
      acquis: acquis,
      disponible: disponible
    });
  }

  return {
    parametres: {
      soldeDepart: soldeDepart,
      soldeAnnuel: soldeAnnuel,
      tauxMensuel: TAUX_ACQUISITION_MENSUEL,
      delaiExpiration: DELAI_EXPIRATION_REPORT,
      joursPerdus: JOURS_PERDUS_REPORT,
      annee: year,
      congesSimules: congesSimules
    },
    simulation: simulation
  };
}

/**
 * Exporte les soldes de conges au format CSV pour telechargement Excel.
 */
function LeaveCounter_exportBalancesCSV(userProfile) {
  var balances = LeaveCounter_getTeamBalances(userProfile);

  var csv = 'Matricule;Nom;Prenom;Departement;Agence;Solde Depart;Perte Report;Acquis;Consomme;Disponible;Allocation Annuelle\n';
  for (var i = 0; i < balances.length; i++) {
    var b = balances[i];
    csv += [
      b.matricule, b.nom, b.prenom, b.departement, b.agence || 'Siege',
      b.soldeDepart || 0, b.perteReport || 0, b.acquis || 0,
      b.consomme || 0, b.soldeConges || 0, b.soldeInitial || 30
    ].join(';') + '\n';
  }

  var blob = Utilities.newBlob(csv, 'text/csv', 'Soldes_Conges_' + formatDateISO(new Date()) + '.csv');
  var file = DriveApp.createFile(blob);
  var url = file.getUrl();
  return { success: true, url: url, fileName: file.getName() };
}
