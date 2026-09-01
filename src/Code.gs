/**
 * Code.gs - Point d'entree de l'application Web
 * doGet(), include(), et toutes les fonctions server_* exposees au frontend
 */

/**
 * Point d'entree de la Web App
 */
function doGet(e) {
  var userProfile = getCurrentUserProfile();

  if (!userProfile) {
    return HtmlService.createHtmlOutput(
      '<html><body style="font-family:Arial,sans-serif;text-align:center;padding:60px;">' +
      '<h2>Acces refuse</h2>' +
      '<p>Votre compte n\'est pas autorise a acceder a cette application.</p>' +
      '<p>Contactez le service RH pour demander l\'acces.</p>' +
      '</body></html>'
    ).setTitle('Acces refuse');
  }

  var template = HtmlService.createTemplateFromFile('Index');
  template.userProfile = JSON.stringify(userProfile);
  template.initialPage = (e && e.parameter && e.parameter.page) ? e.parameter.page : 'Dashboard';
  template.pageParams = (e && e.parameter) ? JSON.stringify(e.parameter) : '{}';

  return template.evaluate()
    .setTitle('SIRH - Gestion des Ressources Humaines')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * Inclut un fichier HTML partiel dans un template
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ===================================================================
// FONCTIONS SERVER EXPOSEES AU FRONTEND (via google.script.run)
// ===================================================================

/**
 * Retourne le profil de l'utilisateur connecte
 */
function server_getCurrentUserProfile() {
  return getCurrentUserProfile();
}

/**
 * Retourne les demandes de l'utilisateur connecte
 */
function server_getMyRequests() {
  var profile = assertAuthenticated();
  return LeaveService_getMyRequests(profile);
}

/**
 * Retourne les demandes de l'equipe du manager
 */
function server_getTeamRequests() {
  var profile = assertAuthenticated();
  return LeaveService_getTeamRequests(profile);
}

/**
 * Retourne toutes les demandes (RH uniquement)
 */
function server_getAllRequests() {
  var profile = assertRole([ROLES.RH, ROLES.DIRECTEUR_CLIENTELE, ROLES.DIRECTEUR_GENERAL]);
  return LeaveService_getAllRequests(profile);
}

/**
 * Retourne les demandes en attente d'action de l'utilisateur
 */
function server_getPendingForMe() {
  var profile = assertAuthenticated();
  return LeaveService_getPendingForMe(profile);
}

/**
 * Retourne le detail d'une demande par son ID
 */
function server_getRequestById(requestId) {
  var profile = assertAuthenticated();
  return LeaveService_getRequestById(requestId, profile);
}

/**
 * Soumet une nouvelle demande de conge
 */
function server_submitRequest(formData) {
  var profile = assertAuthenticated();
  return LeaveService_submitRequest(formData, profile);
}

/**
 * Execute une action de workflow (approuver, rejeter, avis, valider)
 */
function server_processAction(requestId, actionKey, comment) {
  var profile = assertAuthenticated();
  return WorkflowEngine_processTransition(requestId, actionKey, comment, profile);
}

/**
 * Annule une demande
 */
function server_cancelRequest(requestId) {
  var profile = assertAuthenticated();
  return WorkflowEngine_processTransition(requestId, ACTIONS.ANNULER, '', profile);
}

/**
 * Retourne les donnees pour les dropdowns (departements, agences, types)
 */
function server_getDropdownData() {
  return {
    departements: DEPARTEMENTS,
    agences: AGENCES,
    typesConge: Object.values(LEAVE_TYPES),
    typesContrat: CONTRACT_TYPES,
    situationsFamiliales: SITUATIONS_FAMILIALES,
    mouvementTypes: MOUVEMENT_TYPES,
    documentTypes: DOCUMENT_TYPES,
    onboardingStatuts: Object.values(ONBOARDING_STATUS),
    contractStatuts: Object.values(CONTRACT_STATUS),
    demandeDocStatuts: Object.values(DEMANDE_DOC_STATUS),
    genres: GENRES,
    niveauxEtude: NIVEAUX_ETUDE,
    naturesContrat: NATURES_CONTRAT,
    statutsPoste: STATUTS_POSTE
  };
}

/**
 * Retourne le solde de conges de l'utilisateur connecte
 */
function server_getLeaveBalance() {
  var profile = assertAuthenticated();
  return LeaveCounter_getBalance(profile.email);
}

/**
 * Retourne la liste des employes (admin uniquement)
 */
function server_getEmployeeList() {
  assertRole([ROLES.RH, ROLES.DIRECTEUR_GENERAL]);
  return LeaveService_getEmployeeList();
}

/**
 * Met a jour un employe (admin uniquement)
 */
function server_updateEmployee(data) {
  assertRole([ROLES.RH, ROLES.DIRECTEUR_GENERAL]);
  return LeaveService_updateEmployee(data);
}

/**
 * Retourne les soldes de l'equipe du manager
 */
function server_getTeamBalances() {
  var profile = assertAuthenticated();
  return LeaveCounter_getTeamBalances(profile);
}

/**
 * Retourne une valeur de configuration
 */
function server_getConfigValue(key) {
  assertRole([ROLES.RH, ROLES.DIRECTEUR_GENERAL]);
  return SheetDAO_getConfigValue(key);
}

/**
 * Calcule le nombre de jours ouvres entre deux dates
 */
function server_calculateBusinessDays(startDate, endDate) {
  assertAuthenticated();
  var start = parseDate(startDate);
  var end = parseDate(endDate);
  return calculateBusinessDays(start, end);
}

// ===================================================================
// FONCTIONS SIRH ETENDUES
// ===================================================================

/**
 * Retourne le profil complet enrichi d'un employe
 */
function server_getFullProfile(email) {
  var profile = assertAuthenticated();
  if (email && email !== profile.email) {
    if (profile.role !== ROLES.RH && profile.role !== ROLES.DIRECTEUR_GENERAL) {
      throw new Error('Acces refuse : seuls RH et DG peuvent consulter les profils complets.');
    }
  }
  return PersonnelService_getFullProfile(email || profile.email);
}

/**
 * Met a jour le profil complet d'un employe
 */
function server_updateFullProfile(data) {
  assertRole([ROLES.RH, ROLES.DIRECTEUR_GENERAL]);
  return PersonnelService_updateFullProfile(data);
}

/**
 * Retourne l'annuaire du personnel
 */
function server_getAnnuaire() {
  var profile = assertAuthenticated();
  return PersonnelService_getAnnuaire(profile);
}

/**
 * Retourne les donnees de l'organigramme
 */
function server_getOrgChart() {
  var profile = assertAuthenticated();
  return PersonnelService_getOrgChart(profile);
}

/**
 * Retourne les absences de l'equipe pour le calendrier
 */
function server_getTeamCalendar(year, month) {
  var profile = assertAuthenticated();
  return CalendarService_getTeamAbsences(profile, year, month);
}

/**
 * Enregistre un mouvement de personnel
 */
function server_recordMovement(data) {
  var profile = assertRole([ROLES.RH, ROLES.DIRECTEUR_GENERAL]);
  return PersonnelService_recordMovement(data, profile.email);
}

/**
 * Retourne les mouvements d'un employe
 */
function server_getEmployeeMovements(email) {
  var profile = assertAuthenticated();
  if (email !== profile.email) {
    if ([ROLES.RH, ROLES.DIRECTEUR_GENERAL].indexOf(profile.role) === -1) {
      throw new Error('Acces refuse.');
    }
  }
  return PersonnelService_getEmployeeMovements(email);
}

/**
 * Retourne les alertes RH (echeances employes + contrats)
 */
function server_getAlerts() {
  assertRole([ROLES.RH, ROLES.DIRECTEUR_GENERAL]);
  var empAlerts = PersonnelService_getAlerts();
  var contractAlerts = ContractService_getAlerts();
  var all = empAlerts.concat(contractAlerts);
  all.sort(function(a, b) { return parseDate(a.date) - parseDate(b.date); });
  return all;
}

// ===================================================================
// ONBOARDING
// ===================================================================

function server_initiateOnboarding(emailEmp) {
  var profile = assertRole([ROLES.RH, ROLES.DIRECTEUR_GENERAL]);
  return OnboardingService_initiate(emailEmp, profile.email);
}

function server_getOnboardingSteps(emailEmp) {
  assertRole([ROLES.RH, ROLES.DIRECTEUR_GENERAL]);
  return OnboardingService_getSteps(emailEmp);
}

function server_updateOnboardingStep(onboardingId, newStatut, comment) {
  var profile = assertRole([ROLES.RH, ROLES.DIRECTEUR_GENERAL]);
  return OnboardingService_updateStep(onboardingId, newStatut, comment, profile.email);
}

function server_getActiveOnboardings() {
  assertRole([ROLES.RH, ROLES.DIRECTEUR_GENERAL]);
  return OnboardingService_getActiveOnboardings();
}

// ===================================================================
// CONTRATS
// ===================================================================

function server_createContract(data) {
  var profile = assertRole([ROLES.RH, ROLES.DIRECTEUR_GENERAL]);
  return ContractService_create(data, profile.email);
}

function server_renewContract(contratId, newData) {
  var profile = assertRole([ROLES.RH, ROLES.DIRECTEUR_GENERAL]);
  return ContractService_renew(contratId, newData, profile.email);
}

function server_terminateContract(contratId, motif) {
  var profile = assertRole([ROLES.RH, ROLES.DIRECTEUR_GENERAL]);
  return ContractService_terminate(contratId, motif, profile.email);
}

function server_getEmployeeContracts(emailEmp) {
  var profile = assertAuthenticated();
  if (emailEmp !== profile.email) {
    if ([ROLES.RH, ROLES.DIRECTEUR_GENERAL].indexOf(profile.role) === -1) {
      throw new Error('Acces refuse.');
    }
  }
  return ContractService_getByEmployee(emailEmp);
}

function server_getAllActiveContracts() {
  assertRole([ROLES.RH, ROLES.DIRECTEUR_GENERAL]);
  return ContractService_getAllActive();
}

// ===================================================================
// DOCUMENTS / ATTESTATIONS
// ===================================================================

function server_generateDocument(emailEmp, typeDocument, notes) {
  var profile = assertRole([ROLES.RH, ROLES.DIRECTEUR_GENERAL]);
  return DocumentService_generate(emailEmp, typeDocument, notes, profile.email);
}

function server_getEmployeeDocuments(emailEmp) {
  var profile = assertAuthenticated();
  if (emailEmp !== profile.email) {
    if ([ROLES.RH, ROLES.DIRECTEUR_GENERAL].indexOf(profile.role) === -1) {
      throw new Error('Acces refuse.');
    }
  }
  return DocumentService_getByEmployee(emailEmp);
}

function server_getAllDocuments() {
  assertRole([ROLES.RH, ROLES.DIRECTEUR_GENERAL]);
  return DocumentService_getAll();
}

// ===================================================================
// DEMANDES DE DOCUMENTS (employes)
// ===================================================================

function server_requestDocument(typeDocument, notes) {
  var profile = assertAuthenticated();
  return DocumentRequestService_create(profile.email, typeDocument, notes);
}

function server_getMyDocumentRequests() {
  var profile = assertAuthenticated();
  return DocumentRequestService_getByEmployee(profile.email);
}

function server_getAllDocumentRequests() {
  assertRole([ROLES.RH, ROLES.DIRECTEUR_GENERAL]);
  return DocumentRequestService_getAll();
}

function server_processDocumentRequest(demandeId, action, notesRh) {
  var profile = assertRole([ROLES.RH, ROLES.DIRECTEUR_GENERAL]);
  return DocumentRequestService_process(demandeId, action, notesRh, profile.email);
}

function server_getDashboardStats() {
  var profile = assertAuthenticated();
  var stats = {};

  var myRequests = LeaveService_getMyRequests(profile);
  stats.conges = { total: myRequests.length, soumis: 0, enCours: 0, valide: 0, rejete: 0, annule: 0 };
  for (var i = 0; i < myRequests.length; i++) {
    switch(myRequests[i].statut) {
      case 'Soumis': stats.conges.soumis++; break;
      case 'Approuve N1': stats.conges.enCours++; break;
      case 'Valide': stats.conges.valide++; break;
      case 'Rejete N1': case 'Rejete': stats.conges.rejete++; break;
      case 'Annule': stats.conges.annule++; break;
    }
  }

  var myDocRequests = DocumentRequestService_getByEmployee(profile.email);
  stats.documents = { total: myDocRequests.length, enAttente: 0, enCours: 0, traitee: 0, rejetee: 0 };
  for (var j = 0; j < myDocRequests.length; j++) {
    switch(myDocRequests[j].statut) {
      case 'En attente': stats.documents.enAttente++; break;
      case 'En cours': stats.documents.enCours++; break;
      case 'Traitee': stats.documents.traitee++; break;
      case 'Rejetee': stats.documents.rejetee++; break;
    }
  }

  return stats;
}
