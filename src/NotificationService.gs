/**
 * NotificationService.gs - Envoi des notifications email
 * Utilise MailApp (pas GmailApp) pour les emails transactionnels
 */

/**
 * Notification lors de la soumission d'une demande
 */
function NotificationService_onSubmit(requestData, userProfile) {
  var webappUrl = SheetDAO_getConfigValue('WEBAPP_URL');
  var institutionName = SheetDAO_getConfigValue('NOM_INSTITUTION') || 'Microfinance SA';

  // Email a l'employe (confirmation)
  sendNotificationEmail_({
    to: requestData.emailEmp,
    subject: institutionName + ' - Demande de conge soumise',
    recipientName: requestData.prenom + ' ' + requestData.nom,
    message: 'Votre demande de conge a ete soumise avec succes et est en attente d\'approbation par votre responsable.',
    requestData: requestData,
    webappUrl: webappUrl,
    institutionName: institutionName,
    buttonText: 'Voir ma demande'
  });

  // Email au manager (action requise)
  if (requestData.managerEmail) {
    sendNotificationEmail_({
      to: requestData.managerEmail,
      subject: institutionName + ' - Nouvelle demande de conge a approuver',
      recipientName: requestData.managerName || 'Responsable',
      message: 'Une nouvelle demande de conge a ete soumise par ' + requestData.prenom + ' ' + requestData.nom + ' et necessite votre approbation.',
      requestData: requestData,
      webappUrl: webappUrl,
      institutionName: institutionName,
      buttonText: 'Examiner la demande'
    });
  }
}

/**
 * Notification lors d'une transition de workflow
 */
function NotificationService_onTransition(actionKey, requestData, actorProfile) {
  var webappUrl = SheetDAO_getConfigValue('WEBAPP_URL');
  var institutionName = SheetDAO_getConfigValue('NOM_INSTITUTION') || 'Microfinance SA';
  var hrEmails = SheetDAO_getConfigValue('HR_EMAILS');

  switch (actionKey) {
    case ACTIONS.APPROVE_N1:
      // Notifier l'employe
      sendNotificationEmail_({
        to: requestData.emailEmp,
        subject: institutionName + ' - Demande approuvee par votre responsable',
        recipientName: requestData.prenom + ' ' + requestData.nom,
        message: 'Votre demande de conge a ete approuvee par ' + actorProfile.prenom + ' ' + actorProfile.nom + '. Elle est maintenant en attente de l\'avis des Ressources Humaines.',
        requestData: requestData,
        webappUrl: webappUrl,
        institutionName: institutionName,
        buttonText: 'Voir ma demande'
      });
      // Notifier les RH
      if (hrEmails) {
        var hrList = hrEmails.split(',');
        for (var i = 0; i < hrList.length; i++) {
          var hrEmail = hrList[i].trim();
          if (hrEmail) {
            sendNotificationEmail_({
              to: hrEmail,
              subject: institutionName + ' - Demande en attente de votre avis RH',
              recipientName: 'Service RH',
              message: 'La demande de conge de ' + requestData.prenom + ' ' + requestData.nom + ' a ete approuvee par son responsable. Votre avis est requis.',
              requestData: requestData,
              webappUrl: webappUrl,
              institutionName: institutionName,
              buttonText: 'Donner mon avis'
            });
          }
        }
      }
      break;

    case ACTIONS.REJECT_N1:
      sendNotificationEmail_({
        to: requestData.emailEmp,
        subject: institutionName + ' - Demande de conge rejetee',
        recipientName: requestData.prenom + ' ' + requestData.nom,
        message: 'Votre demande de conge a ete rejetee par ' + actorProfile.prenom + ' ' + actorProfile.nom + '.' +
          (requestData.commentManager ? ' Commentaire : ' + requestData.commentManager : ''),
        requestData: requestData,
        webappUrl: webappUrl,
        institutionName: institutionName,
        buttonText: 'Voir les details'
      });
      break;

    case ACTIONS.AVIS_FAVORABLE:
    case ACTIONS.AVIS_DEFAVORABLE:
      var avisText = actionKey === ACTIONS.AVIS_FAVORABLE ? 'favorable' : 'defavorable';
      var finalValidatorEmail = determineFinalValidatorEmail_(requestData);
      if (finalValidatorEmail) {
        sendNotificationEmail_({
          to: finalValidatorEmail,
          subject: institutionName + ' - Demande en attente de votre decision finale',
          recipientName: 'Direction',
          message: 'La demande de conge de ' + requestData.prenom + ' ' + requestData.nom +
            ' a recu un avis RH ' + avisText + '.' +
            (requestData.commentRh ? ' Commentaire RH : ' + requestData.commentRh : '') +
            ' Votre decision finale est requise.',
          requestData: requestData,
          webappUrl: webappUrl,
          institutionName: institutionName,
          buttonText: 'Prendre la decision'
        });
      }
      break;

    case ACTIONS.VALIDER:
      sendNotificationEmail_({
        to: requestData.emailEmp,
        subject: institutionName + ' - Demande de conge VALIDEE',
        recipientName: requestData.prenom + ' ' + requestData.nom,
        message: 'Votre demande de conge du ' + formatDate(requestData.dateDebut) + ' au ' + formatDate(requestData.dateFin) +
          ' (' + requestData.nbJours + ' jours) a ete validee. Vous recevrez votre fiche de conge par email.',
        requestData: requestData,
        webappUrl: webappUrl,
        institutionName: institutionName,
        buttonText: 'Voir ma demande'
      });
      // Notifier les RH
      if (hrEmails) {
        var hrList2 = hrEmails.split(',');
        for (var j = 0; j < hrList2.length; j++) {
          var hrEmail2 = hrList2[j].trim();
          if (hrEmail2) {
            sendNotificationEmail_({
              to: hrEmail2,
              subject: institutionName + ' - Demande de conge validee - ' + requestData.prenom + ' ' + requestData.nom,
              recipientName: 'Service RH',
              message: 'La demande de conge de ' + requestData.prenom + ' ' + requestData.nom + ' a ete validee.',
              requestData: requestData,
              webappUrl: webappUrl,
              institutionName: institutionName,
              buttonText: 'Voir la demande'
            });
          }
        }
      }
      break;

    case ACTIONS.REJETER_FINAL:
      sendNotificationEmail_({
        to: requestData.emailEmp,
        subject: institutionName + ' - Demande de conge rejetee (decision finale)',
        recipientName: requestData.prenom + ' ' + requestData.nom,
        message: 'Votre demande de conge a ete rejetee en decision finale.' +
          (requestData.commentValidateur ? ' Commentaire : ' + requestData.commentValidateur : ''),
        requestData: requestData,
        webappUrl: webappUrl,
        institutionName: institutionName,
        buttonText: 'Voir les details'
      });
      if (hrEmails) {
        var hrList3 = hrEmails.split(',');
        for (var k = 0; k < hrList3.length; k++) {
          var hrEmail3 = hrList3[k].trim();
          if (hrEmail3) {
            sendNotificationEmail_({
              to: hrEmail3,
              subject: institutionName + ' - Demande rejetee - ' + requestData.prenom + ' ' + requestData.nom,
              recipientName: 'Service RH',
              message: 'La demande de conge de ' + requestData.prenom + ' ' + requestData.nom + ' a ete rejetee en decision finale.',
              requestData: requestData,
              webappUrl: webappUrl,
              institutionName: institutionName,
              buttonText: 'Voir la demande'
            });
          }
        }
      }
      break;

    case ACTIONS.ANNULER:
      if (requestData.managerEmail) {
        sendNotificationEmail_({
          to: requestData.managerEmail,
          subject: institutionName + ' - Demande de conge annulee',
          recipientName: requestData.managerName || 'Responsable',
          message: requestData.prenom + ' ' + requestData.nom + ' a annule sa demande de conge.',
          requestData: requestData,
          webappUrl: webappUrl,
          institutionName: institutionName,
          buttonText: 'Voir les details'
        });
      }
      break;
  }
}

/**
 * Notification quand l'etape N1 est sautee (manager = DG ou DC)
 * La demande passe directement a l'avis RH
 */
function NotificationService_onSkipN1(requestData, userProfile) {
  var webappUrl = SheetDAO_getConfigValue('WEBAPP_URL');
  var institutionName = SheetDAO_getConfigValue('NOM_INSTITUTION') || 'Microfinance SA';
  var hrEmails = SheetDAO_getConfigValue('HR_EMAILS');

  // Email a l'employe (confirmation + info skip)
  sendNotificationEmail_({
    to: requestData.emailEmp,
    subject: institutionName + ' - Demande de conge soumise',
    recipientName: requestData.prenom + ' ' + requestData.nom,
    message: 'Votre demande de conge a ete soumise avec succes. Votre responsable etant membre de la Direction, votre demande est transmise directement aux Ressources Humaines pour avis.',
    requestData: requestData,
    webappUrl: webappUrl,
    institutionName: institutionName,
    buttonText: 'Voir ma demande'
  });

  // Email aux RH (action requise directement)
  if (hrEmails) {
    var hrList = hrEmails.split(',');
    for (var i = 0; i < hrList.length; i++) {
      var hrEmail = hrList[i].trim();
      if (hrEmail) {
        sendNotificationEmail_({
          to: hrEmail,
          subject: institutionName + ' - Demande en attente de votre avis RH',
          recipientName: 'Service RH',
          message: 'La demande de conge de ' + requestData.prenom + ' ' + requestData.nom + ' necessite votre avis. L\'etape d\'approbation N1 a ete sautee car le responsable est membre de la Direction.',
          requestData: requestData,
          webappUrl: webappUrl,
          institutionName: institutionName,
          buttonText: 'Donner mon avis'
        });
      }
    }
  }
}

/**
 * Determine l'email du validateur final
 */
function determineFinalValidatorEmail_(requestData) {
  if (requestData.agence && requestData.agence !== '') {
    return SheetDAO_getConfigValue('DIR_CLIENTELE_EMAIL');
  } else {
    return SheetDAO_getConfigValue('DIR_GENERAL_EMAIL');
  }
}

/**
 * Envoie un email de notification avec le template standard
 */
function sendNotificationEmail_(params) {
  try {
    var detailUrl = params.webappUrl ?
      params.webappUrl + '?page=DetailDemande&id=' + params.requestData.requestId : '#';

    var htmlBody = buildEmailTemplate_({
      institutionName: params.institutionName,
      recipientName: params.recipientName,
      message: params.message,
      requestData: params.requestData,
      detailUrl: detailUrl,
      buttonText: params.buttonText
    });

    MailApp.sendEmail({
      to: params.to,
      subject: params.subject,
      htmlBody: htmlBody,
      noReply: true
    });
  } catch (e) {
    console.error('Echec envoi email a ' + params.to + ': ' + e.message);
    // Enregistrer l'echec dans l'audit
    try {
      SheetDAO_appendRow(SHEET_NAMES.AUDIT, [
        new Date(), 'SYSTEM', 'SYSTEM',
        params.requestData ? params.requestData.requestId : '',
        'NOTIFICATION_FAILED', '', '',
        'To: ' + params.to + ' Error: ' + e.message
      ]);
    } catch (e2) {
      // Ignorer
    }
  }
}

/**
 * Construit le template HTML de l'email
 */
function buildEmailTemplate_(params) {
  var req = params.requestData;
  var statutLabel = req.statut || '';

  return '<!DOCTYPE html>' +
    '<html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:20px;">' +
    '<div style="background:#1a56db;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0;">' +
    '<h2 style="margin:0;font-size:18px;">' + (params.institutionName || 'Microfinance SA') + '</h2>' +
    '<p style="margin:4px 0 0;opacity:0.9;font-size:13px;">Gestion des Conges</p>' +
    '</div>' +
    '<div style="background:white;padding:24px;border-radius:0 0 8px 8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">' +
    '<p style="margin:0 0 16px;">Bonjour ' + (params.recipientName || '') + ',</p>' +
    '<p style="margin:0 0 20px;color:#374151;">' + (params.message || '') + '</p>' +
    '<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">' +
    '<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;color:#6b7280;width:140px;">Employe</td><td style="padding:8px;font-weight:500;">' + (req.prenom || '') + ' ' + (req.nom || '') + '</td></tr>' +
    '<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;color:#6b7280;">Type</td><td style="padding:8px;">' + (req.typeConge || '') + '</td></tr>' +
    '<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;color:#6b7280;">Du</td><td style="padding:8px;">' + formatDate(req.dateDebut) + '</td></tr>' +
    '<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;color:#6b7280;">Au</td><td style="padding:8px;">' + formatDate(req.dateFin) + '</td></tr>' +
    '<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;color:#6b7280;">Jours</td><td style="padding:8px;font-weight:600;">' + (req.nbJours || '') + '</td></tr>' +
    '<tr><td style="padding:8px;color:#6b7280;">Statut</td><td style="padding:8px;font-weight:600;">' + statutLabel + '</td></tr>' +
    '</table>' +
    '<div style="text-align:center;margin:24px 0 8px;">' +
    '<a href="' + (params.detailUrl || '#') + '" style="display:inline-block;background:#1a56db;color:white;padding:10px 24px;text-decoration:none;border-radius:6px;font-weight:500;">' + (params.buttonText || 'Voir la demande') + '</a>' +
    '</div>' +
    '</div>' +
    '<div style="text-align:center;padding:16px;font-size:11px;color:#9ca3af;">' +
    'Ceci est un message automatique. Merci de ne pas repondre directement.' +
    '</div>' +
    '</body></html>';
}
