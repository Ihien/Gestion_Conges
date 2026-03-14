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
    .setTitle('Gestion des Conges')
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
    typesConge: [LEAVE_TYPES.PAID, LEAVE_TYPES.EXCEPTIONAL]
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
