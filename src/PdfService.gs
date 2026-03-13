/**
 * PdfService.gs - Generation de PDF et archivage Drive
 * Utilise un template Google Doc avec marqueurs {{PLACEHOLDER}}
 */

/**
 * Genere un PDF pour une demande validee et l'archive dans Drive
 * Retourne l'URL du PDF archive
 */
function PdfService_generateAndArchive(requestData, validatorProfile) {
  var templateId = SheetDAO_getConfigValue('PDF_TEMPLATE_DOC_ID');
  var archiveRootId = SheetDAO_getConfigValue('ARCHIVE_FOLDER_ID');

  // Si pas de template ou dossier configure, generer un PDF simple
  if (!templateId || !archiveRootId) {
    return PdfService_generateSimplePdf(requestData, validatorProfile, archiveRootId);
  }

  // 1. Determiner le sous-dossier d'archive YYYY/MM
  var now = new Date();
  var year = now.getFullYear().toString();
  var month = padMonth(now.getMonth() + 1);

  var rootFolder = DriveApp.getFolderById(archiveRootId);
  var yearFolder = getOrCreateSubfolder_(rootFolder, year);
  var monthFolder = getOrCreateSubfolder_(yearFolder, month);

  // 2. Copier le template
  var fileName = 'Conge_' + requestData.matricule + '_' + formatDateISO(now) + '_' + requestData.requestId.substring(0, 8);
  var templateFile = DriveApp.getFileById(templateId);
  var docCopy = templateFile.makeCopy(fileName, monthFolder);

  // 3. Ouvrir et remplacer les marqueurs
  var doc = DocumentApp.openById(docCopy.getId());
  var body = doc.getBody();

  body.replaceText('{{NOM}}', requestData.nom || '');
  body.replaceText('{{PRENOM}}', requestData.prenom || '');
  body.replaceText('{{MATRICULE}}', requestData.matricule || '');
  body.replaceText('{{POSTE}}', requestData.poste || '');
  body.replaceText('{{DEPARTEMENT}}', requestData.departement || '');
  body.replaceText('{{AGENCE}}', requestData.agence || 'Siege');
  body.replaceText('{{TYPE_CONGE}}', requestData.typeConge || '');
  body.replaceText('{{MOTIF}}', requestData.motif || 'N/A');
  body.replaceText('{{DATE_DEBUT}}', formatDate(requestData.dateDebut));
  body.replaceText('{{DATE_FIN}}', formatDate(requestData.dateFin));
  body.replaceText('{{NB_JOURS}}', String(requestData.nbJours || 0));
  body.replaceText('{{MANAGER_NAME}}', requestData.managerName || '');
  body.replaceText('{{DATE_SUBMIT}}', formatDate(requestData.dateSubmit));
  body.replaceText('{{DATE_APPROBATION}}', formatDate(requestData.dateApprobation));
  body.replaceText('{{AVIS_RH}}', requestData.avisRh || '');
  body.replaceText('{{COMMENT_RH}}', requestData.commentRh || '');
  body.replaceText('{{DATE_AVIS_RH}}', formatDate(requestData.dateAvisRh));
  body.replaceText('{{DATE_DECISION}}', formatDate(now));
  body.replaceText('{{VALIDATEUR_NOM}}', validatorProfile ? (validatorProfile.prenom + ' ' + validatorProfile.nom) : '');
  body.replaceText('{{COMMENT_VALIDATEUR}}', requestData.commentValidateur || '');
  body.replaceText('{{DATE_GENERATION}}', formatDateTime(now));
  body.replaceText('{{REQUEST_ID}}', requestData.requestId || '');

  doc.saveAndClose();

  // 4. Exporter en PDF
  var pdfBlob = DriveApp.getFileById(docCopy.getId()).getAs(MimeType.PDF);
  pdfBlob.setName(fileName + '.pdf');
  var pdfFile = monthFolder.createFile(pdfBlob);

  // 5. Supprimer la copie Doc intermediaire
  DriveApp.getFileById(docCopy.getId()).setTrashed(true);

  // 6. Definir les permissions
  setArchivePermissions_(pdfFile);

  return pdfFile.getUrl();
}

/**
 * Genere un PDF simple sans template Doc (fallback)
 */
function PdfService_generateSimplePdf(requestData, validatorProfile, archiveRootId) {
  var now = new Date();
  var institutionName = SheetDAO_getConfigValue('NOM_INSTITUTION') || 'Microfinance SA';

  var htmlContent = '<!DOCTYPE html><html><head><style>' +
    'body{font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:40px;color:#333;}' +
    'h1{text-align:center;color:#1a56db;font-size:20px;border-bottom:2px solid #1a56db;padding-bottom:10px;}' +
    'h2{color:#1a56db;font-size:16px;margin-top:24px;}' +
    'table{width:100%;border-collapse:collapse;margin:12px 0;}' +
    'td{padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;}' +
    'td:first-child{color:#6b7280;width:200px;font-weight:500;}' +
    '.header{text-align:center;margin-bottom:30px;}' +
    '.header p{margin:4px 0;color:#6b7280;font-size:13px;}' +
    '.signatures{margin-top:40px;display:flex;justify-content:space-between;}' +
    '.signature-box{text-align:center;width:30%;}' +
    '.signature-line{border-top:1px solid #333;margin-top:40px;padding-top:8px;font-size:12px;}' +
    '.footer{margin-top:40px;text-align:center;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px;}' +
    '</style></head><body>' +
    '<div class="header"><h1>' + institutionName + '</h1><p>Societe de Microfinance</p></div>' +
    '<h1>FICHE DE CONGE VALIDEE</h1>' +
    '<h2>Informations de l\'employe</h2>' +
    '<table>' +
    '<tr><td>Nom et Prenom</td><td>' + (requestData.prenom || '') + ' ' + (requestData.nom || '') + '</td></tr>' +
    '<tr><td>Matricule</td><td>' + (requestData.matricule || '') + '</td></tr>' +
    '<tr><td>Poste</td><td>' + (requestData.poste || '') + '</td></tr>' +
    '<tr><td>Departement</td><td>' + (requestData.departement || '') + '</td></tr>' +
    '<tr><td>Agence</td><td>' + (requestData.agence || 'Siege') + '</td></tr>' +
    '</table>' +
    '<h2>Details du conge</h2>' +
    '<table>' +
    '<tr><td>Type de conge</td><td>' + (requestData.typeConge || '') + '</td></tr>' +
    '<tr><td>Motif</td><td>' + (requestData.motif || 'N/A') + '</td></tr>' +
    '<tr><td>Date de debut</td><td>' + formatDate(requestData.dateDebut) + '</td></tr>' +
    '<tr><td>Date de fin</td><td>' + formatDate(requestData.dateFin) + '</td></tr>' +
    '<tr><td>Nombre de jours</td><td>' + (requestData.nbJours || 0) + '</td></tr>' +
    '</table>' +
    '<h2>Circuit de validation</h2>' +
    '<table>' +
    '<tr><td>Soumis le</td><td>' + formatDate(requestData.dateSubmit) + '</td></tr>' +
    '<tr><td>Approuve par (N1)</td><td>' + (requestData.managerName || '') + ' le ' + formatDate(requestData.dateApprobation) + '</td></tr>' +
    '<tr><td>Avis RH</td><td>' + (requestData.avisRh || '') + '</td></tr>' +
    '<tr><td>Commentaire RH</td><td>' + (requestData.commentRh || '') + '</td></tr>' +
    '<tr><td>Decision finale</td><td>VALIDE le ' + formatDate(now) + '</td></tr>' +
    '<tr><td>Par</td><td>' + (validatorProfile ? validatorProfile.prenom + ' ' + validatorProfile.nom : '') + '</td></tr>' +
    '</table>' +
    '<div style="margin-top:40px;">' +
    '<table><tr>' +
    '<td style="width:33%;text-align:center;border:none;"><div style="border-top:1px solid #333;padding-top:8px;margin-top:50px;">Employe</div></td>' +
    '<td style="width:33%;text-align:center;border:none;"><div style="border-top:1px solid #333;padding-top:8px;margin-top:50px;">Responsable</div></td>' +
    '<td style="width:33%;text-align:center;border:none;"><div style="border-top:1px solid #333;padding-top:8px;margin-top:50px;">Direction</div></td>' +
    '</tr></table></div>' +
    '<div class="footer">Document genere automatiquement le ' + formatDateTime(now) + ' | Reference: ' + (requestData.requestId || '') + '</div>' +
    '</body></html>';

  // Creer un blob HTML et le convertir en PDF via un Doc temporaire
  var blob = Utilities.newBlob(htmlContent, MimeType.HTML, 'temp.html');
  var fileName = 'Conge_' + requestData.matricule + '_' + formatDateISO(now);

  if (archiveRootId) {
    var rootFolder = DriveApp.getFolderById(archiveRootId);
    var yearFolder = getOrCreateSubfolder_(rootFolder, now.getFullYear().toString());
    var monthFolder = getOrCreateSubfolder_(yearFolder, padMonth(now.getMonth() + 1));

    // Creer un Google Doc temporaire
    var tempDoc = Drive.Files ? null : DocumentApp.create(fileName + '_temp');
    // Methode alternative: creer le fichier HTML et l'exporter
    var htmlFile = monthFolder.createFile(blob);

    // Utiliser le Doc pour conversion
    var tempDocFile = DocumentApp.create(fileName);
    var body = tempDocFile.getBody();
    body.setText(''); // Vider
    // Inserer le contenu de base
    body.appendParagraph(institutionName).setHeading(DocumentApp.ParagraphHeading.HEADING1).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    body.appendParagraph('FICHE DE CONGE VALIDEE').setHeading(DocumentApp.ParagraphHeading.HEADING2).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    body.appendParagraph('');
    body.appendParagraph('Employe: ' + requestData.prenom + ' ' + requestData.nom);
    body.appendParagraph('Matricule: ' + requestData.matricule);
    body.appendParagraph('Poste: ' + requestData.poste);
    body.appendParagraph('Departement: ' + requestData.departement);
    body.appendParagraph('Agence: ' + (requestData.agence || 'Siege'));
    body.appendParagraph('');
    body.appendParagraph('Type de conge: ' + requestData.typeConge);
    if (requestData.motif) body.appendParagraph('Motif: ' + requestData.motif);
    body.appendParagraph('Date de debut: ' + formatDate(requestData.dateDebut));
    body.appendParagraph('Date de fin: ' + formatDate(requestData.dateFin));
    body.appendParagraph('Nombre de jours: ' + requestData.nbJours);
    body.appendParagraph('');
    body.appendParagraph('Soumis le: ' + formatDate(requestData.dateSubmit));
    body.appendParagraph('Approuve par: ' + requestData.managerName + ' le ' + formatDate(requestData.dateApprobation));
    body.appendParagraph('Avis RH: ' + (requestData.avisRh || ''));
    body.appendParagraph('Decision finale: VALIDE le ' + formatDate(now));
    body.appendParagraph('Par: ' + (validatorProfile ? validatorProfile.prenom + ' ' + validatorProfile.nom : ''));
    body.appendParagraph('');
    body.appendParagraph('Reference: ' + requestData.requestId);

    tempDocFile.saveAndClose();

    var pdfBlob = DriveApp.getFileById(tempDocFile.getId()).getAs(MimeType.PDF);
    pdfBlob.setName(fileName + '.pdf');
    var pdfFile = monthFolder.createFile(pdfBlob);

    // Nettoyer
    DriveApp.getFileById(tempDocFile.getId()).setTrashed(true);
    htmlFile.setTrashed(true);

    setArchivePermissions_(pdfFile);
    return pdfFile.getUrl();
  }

  return '';
}

/**
 * Recupere ou cree un sous-dossier dans un dossier parent
 */
function getOrCreateSubfolder_(parentFolder, name) {
  var folders = parentFolder.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(name);
}

/**
 * Definit les permissions sur un fichier PDF archive
 */
function setArchivePermissions_(file) {
  // Partager avec les RH (editeur)
  var hrEmails = SheetDAO_getConfigValue('HR_EMAILS');
  if (hrEmails) {
    var hrList = hrEmails.split(',');
    for (var i = 0; i < hrList.length; i++) {
      var email = hrList[i].trim();
      if (email) {
        try {
          file.addEditor(email);
        } catch (e) {
          console.error('Erreur ajout editeur ' + email + ': ' + e.message);
        }
      }
    }
  }

  // Partager avec Audit (lecteur)
  var auditEmails = SheetDAO_getConfigValue('AUDIT_EMAILS');
  if (auditEmails) {
    var auditList = auditEmails.split(',');
    for (var j = 0; j < auditList.length; j++) {
      var auditEmail = auditList[j].trim();
      if (auditEmail) {
        try {
          file.addViewer(auditEmail);
        } catch (e) {
          console.error('Erreur ajout lecteur ' + auditEmail + ': ' + e.message);
        }
      }
    }
  }
}
