/**
 * Auth.gs - Identite utilisateur, detection de role, controle d'acces
 * Toutes les verifications de permission sont centralisees ici.
 */

/**
 * Retourne l'email de l'utilisateur connecte
 */
function getCurrentUserEmail() {
  return Session.getActiveUser().getEmail();
}

/**
 * Retourne le profil complet de l'utilisateur connecte depuis la feuille Employes
 * Retourne null si non trouve ou inactif
 */
function getCurrentUserProfile() {
  var email = getCurrentUserEmail();
  if (!email) return null;

  var row = SheetDAO_getRowByKey(SHEET_NAMES.EMPLOYES, COL_EMPLOYES.EMAIL, email);
  if (!row) return null;

  var profile = buildEmployeeObject(row);

  // Verifier que l'employe est actif
  if (profile.actif === false || profile.actif === 'FALSE' || profile.actif === '') {
    return null;
  }

  return profile;
}

/**
 * Verifie que l'utilisateur est authentifie (existe et actif)
 * Lance une erreur si non authentifie
 */
function assertAuthenticated() {
  var profile = getCurrentUserProfile();
  if (!profile) {
    throw new Error('Acces refuse : utilisateur non reconnu ou inactif.');
  }
  return profile;
}

/**
 * Verifie que l'utilisateur a l'un des roles autorises
 * allowedRoles: tableau de strings (ex: [ROLES.RH, ROLES.DIRECTEUR_GENERAL])
 */
function assertRole(allowedRoles) {
  var profile = assertAuthenticated();
  if (allowedRoles.indexOf(profile.role) === -1) {
    throw new Error('Acces refuse : role insuffisant. Role requis : ' + allowedRoles.join(', '));
  }
  return profile;
}

/**
 * Determine si l'utilisateur peut voir une demande donnee
 * requestRow: tableau brut d'une ligne de la feuille Demandes
 * userProfile: profil de l'utilisateur
 */
function canViewRequest(requestRow, userProfile) {
  if (!requestRow || !userProfile) return false;

  var role = userProfile.role;

  // RH, Directeurs voient tout
  if (role === ROLES.RH || role === ROLES.DIRECTEUR_CLIENTELE || role === ROLES.DIRECTEUR_GENERAL) {
    return true;
  }

  // Chef d'agence / Chef d'agence senior : demandes de son agence + ses propres demandes
  if (role === ROLES.CHEF_AGENCE || role === ROLES.CHEF_AGENCE_SENIOR) {
    var requestAgence = requestRow[COL_DEMANDES.AGENCE];
    return requestAgence === userProfile.agence ||
           requestRow[COL_DEMANDES.EMAIL_EMP] === userProfile.email;
  }

  // Chef de departement : demandes de son departement + ses propres demandes
  if (role === ROLES.CHEF_DEPARTEMENT) {
    var requestDept = requestRow[COL_DEMANDES.DEPARTEMENT];
    return requestDept === userProfile.departement ||
           requestRow[COL_DEMANDES.EMAIL_EMP] === userProfile.email;
  }

  // Employe : uniquement ses propres demandes
  return requestRow[COL_DEMANDES.EMAIL_EMP] === userProfile.email;
}

/**
 * Determine si l'utilisateur peut effectuer une action sur une demande
 * requestRow: tableau brut d'une ligne Demandes
 * actionKey: string (ex: 'APPROVE_N1', 'AVIS_FAVORABLE', etc.)
 * userProfile: profil de l'utilisateur
 */
function canActOnRequest(requestRow, actionKey, userProfile) {
  if (!requestRow || !userProfile) return false;

  var currentStatut = requestRow[COL_DEMANDES.STATUT];
  var role = userProfile.role;
  var email = userProfile.email;

  switch (actionKey) {
    case ACTIONS.APPROVE_N1:
    case ACTIONS.REJECT_N1:
      if (currentStatut !== STATUS.SOUMIS) return false;
      // DG peut approuver/rejeter n'importe quelle demande
      if (role === ROLES.DIRECTEUR_GENERAL) return true;
      // DC peut approuver/rejeter toute demande d'agence (y compris chefs d'agence)
      if (role === ROLES.DIRECTEUR_CLIENTELE) {
        var agence = String(requestRow[COL_DEMANDES.AGENCE] || '');
        return agence !== '';
      }
      // N+1 classique
      return (role === ROLES.CHEF_AGENCE || role === ROLES.CHEF_AGENCE_SENIOR || role === ROLES.CHEF_DEPARTEMENT) &&
             requestRow[COL_DEMANDES.MANAGER_EMAIL].toLowerCase() === email.toLowerCase();

    case ACTIONS.AVIS_FAVORABLE:
    case ACTIONS.AVIS_DEFAVORABLE:
      // RH donne son avis (decision finale) quand le statut est Approuve N1
      return currentStatut === STATUS.APPROUVE_N1 && role === ROLES.RH;

    case ACTIONS.ANNULER:
      // L'employe peut annuler sa demande tant qu'elle est Soumise
      return currentStatut === STATUS.SOUMIS &&
             requestRow[COL_DEMANDES.EMAIL_EMP].toLowerCase() === email.toLowerCase();

    default:
      return false;
  }
}

/**
 * Retourne la liste des actions disponibles pour l'utilisateur sur une demande
 */
function getAvailableActions(requestRow, userProfile) {
  var actions = [];
  var allActions = Object.values(ACTIONS);

  for (var i = 0; i < allActions.length; i++) {
    if (allActions[i] === ACTIONS.SUBMIT) continue; // Submit n'est pas une action sur une demande existante
    if (canActOnRequest(requestRow, allActions[i], userProfile)) {
      actions.push(allActions[i]);
    }
  }
  return actions;
}
