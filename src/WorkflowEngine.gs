/**
 * WorkflowEngine.gs - Machine a etats pour le workflow d'approbation
 * Autorite unique pour toutes les transitions de statut.
 */

// ===== CARTE DES TRANSITIONS =====
var TRANSITIONS = {};

TRANSITIONS[ACTIONS.APPROVE_N1] = {
  fromStatus: [STATUS.SOUMIS],
  toStatus: STATUS.APPROUVE_N1,
  allowedRoles: [ROLES.CHEF_AGENCE, ROLES.CHEF_AGENCE_SENIOR, ROLES.CHEF_DEPARTEMENT,
                 ROLES.DIRECTEUR_CLIENTELE, ROLES.DIRECTEUR_GENERAL],
  requiresRelation: 'IS_MANAGER_OR_DIRECTOR',
  timestampCol: COL_DEMANDES.DATE_APPROBATION,
  commentCol: COL_DEMANDES.COMMENT_MANAGER,
  requireComment: false
};

TRANSITIONS[ACTIONS.REJECT_N1] = {
  fromStatus: [STATUS.SOUMIS],
  toStatus: STATUS.REJETE_N1,
  allowedRoles: [ROLES.CHEF_AGENCE, ROLES.CHEF_AGENCE_SENIOR, ROLES.CHEF_DEPARTEMENT,
                 ROLES.DIRECTEUR_CLIENTELE, ROLES.DIRECTEUR_GENERAL],
  requiresRelation: 'IS_MANAGER_OR_DIRECTOR',
  timestampCol: COL_DEMANDES.DATE_APPROBATION,
  commentCol: COL_DEMANDES.COMMENT_MANAGER,
  requireComment: true
};

TRANSITIONS[ACTIONS.AVIS_FAVORABLE] = {
  fromStatus: [STATUS.APPROUVE_N1],
  toStatus: STATUS.VALIDE,
  allowedRoles: [ROLES.RH],
  requiresRelation: null,
  timestampCol: COL_DEMANDES.DATE_AVIS_RH,
  commentCol: COL_DEMANDES.COMMENT_RH,
  extraUpdates: function() {
    var u = {};
    u[COL_DEMANDES.AVIS_RH] = 'Favorable';
    u[COL_DEMANDES.DATE_DECISION_FINALE] = new Date();
    return u;
  },
  requireComment: false
};

TRANSITIONS[ACTIONS.AVIS_DEFAVORABLE] = {
  fromStatus: [STATUS.APPROUVE_N1],
  toStatus: STATUS.REJETE,
  allowedRoles: [ROLES.RH],
  requiresRelation: null,
  timestampCol: COL_DEMANDES.DATE_AVIS_RH,
  commentCol: COL_DEMANDES.COMMENT_RH,
  extraUpdates: function() {
    var u = {};
    u[COL_DEMANDES.AVIS_RH] = 'Defavorable';
    u[COL_DEMANDES.DATE_DECISION_FINALE] = new Date();
    return u;
  },
  requireComment: true
};

TRANSITIONS[ACTIONS.ANNULER] = {
  fromStatus: [STATUS.SOUMIS],
  toStatus: STATUS.ANNULE,
  allowedRoles: [ROLES.EMPLOYE, ROLES.CHEF_AGENCE, ROLES.CHEF_AGENCE_SENIOR, ROLES.CHEF_DEPARTEMENT,
                 ROLES.RH, ROLES.DIRECTEUR_CLIENTELE, ROLES.DIRECTEUR_GENERAL],
  requiresRelation: 'IS_OWNER',
  timestampCol: null,
  commentCol: null,
  requireComment: false
};

/**
 * Execute une transition de workflow
 * C'est la fonction principale d'orchestration
 */
function WorkflowEngine_processTransition(requestId, actionKey, comment, userProfile) {
  // Acquérir un verrou pour éviter les conditions de course
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error('Systeme occupe. Veuillez reessayer dans quelques instants.');
  }

  try {
    // 1. Verifier la transition existe
    var transition = TRANSITIONS[actionKey];
    if (!transition) {
      throw new Error('Action non reconnue: ' + actionKey);
    }

    // 2. Charger la demande
    var requestRow = SheetDAO_getRowByKey(SHEET_NAMES.DEMANDES, COL_DEMANDES.REQUEST_ID, requestId);
    if (!requestRow) {
      throw new Error('Demande non trouvee: ' + requestId);
    }

    var currentStatut = requestRow[COL_DEMANDES.STATUT];

    // 3. Verifier le statut source
    if (transition.fromStatus.indexOf(currentStatut) === -1) {
      throw new Error('Transition impossible depuis le statut "' + currentStatut + '".');
    }

    // 4. Verifier le role
    if (transition.allowedRoles.indexOf(userProfile.role) === -1) {
      throw new Error('Votre role ne permet pas cette action.');
    }

    // 5. Verifier la relation
    if (transition.requiresRelation) {
      if (!checkRelation_(requestRow, userProfile, transition.requiresRelation)) {
        throw new Error('Vous n\'etes pas autorise a agir sur cette demande.');
      }
    }

    // 6. Verifier le commentaire
    if (transition.requireComment && (!comment || comment.trim() === '')) {
      throw new Error('Un commentaire est obligatoire pour cette action.');
    }

    // 7. Construire les mises a jour
    var updates = {};
    updates[COL_DEMANDES.STATUT] = transition.toStatus;

    if (transition.timestampCol !== null) {
      updates[transition.timestampCol] = new Date();
    }

    if (transition.commentCol !== null && comment) {
      updates[transition.commentCol] = sanitizeInput(comment);
    }

    // Mises a jour supplementaires
    if (transition.extraUpdates) {
      var extra = transition.extraUpdates();
      var extraKeys = Object.keys(extra);
      for (var i = 0; i < extraKeys.length; i++) {
        updates[extraKeys[i]] = extra[extraKeys[i]];
      }
    }

    // 8. Appliquer les mises a jour
    var rowNumber = SheetDAO_getRowNumber(SHEET_NAMES.DEMANDES, COL_DEMANDES.REQUEST_ID, requestId);
    SheetDAO_updateCells(SHEET_NAMES.DEMANDES, rowNumber, updates);

    // 9. Journal d'audit
    var auditRow = [
      new Date(),
      userProfile.email,
      userProfile.role,
      requestId,
      actionKey,
      currentStatut,
      transition.toStatus,
      comment || ''
    ];
    SheetDAO_appendRow(SHEET_NAMES.AUDIT, auditRow);

    // 10. Effets de bord post-transition
    var requestData = buildRequestObject(requestRow);
    requestData.statut = transition.toStatus; // Mettre a jour avec le nouveau statut

    // Notifications
    try {
      NotificationService_onTransition(actionKey, requestData, userProfile);
    } catch (e) {
      console.error('Erreur notification: ' + e.message);
    }

    // Si valide: generer PDF, deduire le solde, creer evenement Calendar
    if (transition.toStatus === STATUS.VALIDE) {
      try {
        var pdfUrl = PdfService_generateAndArchive(requestData, userProfile);
        if (pdfUrl) {
          var pdfUpdate = {};
          pdfUpdate[COL_DEMANDES.PDF_URL] = pdfUrl;
          SheetDAO_updateCells(SHEET_NAMES.DEMANDES, rowNumber, pdfUpdate);
        }
      } catch (e) {
        console.error('Erreur generation PDF: ' + e.message);
      }

      // Deduire le solde si type concerne
      if (LEAVE_TYPES_DEDUCT_BALANCE.indexOf(requestData.typeConge) !== -1) {
        try {
          LeaveCounter_deductLeave(requestData.emailEmp, requestData.nbJours);
        } catch (e) {
          console.error('Erreur deduction solde: ' + e.message);
        }
      }

      // Creer evenement Google Calendar
      try {
        CalendarService_createLeaveEvent(requestData);
      } catch (e) {
        console.error('Erreur Calendar: ' + e.message);
      }
    }

    return { success: true, newStatus: transition.toStatus };

  } finally {
    lock.releaseLock();
  }
}

/**
 * Verifie la relation entre l'utilisateur et la demande
 */
function checkRelation_(requestRow, userProfile, relationType) {
  var email = userProfile.email.toLowerCase();

  switch (relationType) {
    case 'IS_MANAGER':
      return String(requestRow[COL_DEMANDES.MANAGER_EMAIL]).toLowerCase() === email;

    case 'IS_MANAGER_OR_DIRECTOR':
      // DG peut approuver n'importe quelle demande
      if (userProfile.role === ROLES.DIRECTEUR_GENERAL) return true;
      // DC peut approuver toute demande d'agence
      if (userProfile.role === ROLES.DIRECTEUR_CLIENTELE) {
        var agence = String(requestRow[COL_DEMANDES.AGENCE] || '');
        return agence !== '';
      }
      // N+1 classique
      return String(requestRow[COL_DEMANDES.MANAGER_EMAIL]).toLowerCase() === email;

    case 'IS_OWNER':
      return String(requestRow[COL_DEMANDES.EMAIL_EMP]).toLowerCase() === email;

    default:
      return false;
  }
}
