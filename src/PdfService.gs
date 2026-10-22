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
  body.replaceText('{{DATE_DEBUT}}', requestData.dateDebut || '');
  body.replaceText('{{DATE_FIN}}', requestData.dateFin || '');
  body.replaceText('{{NB_JOURS}}', String(requestData.nbJours || 0));
  body.replaceText('{{MANAGER_NAME}}', requestData.managerName || '');
  body.replaceText('{{DATE_SUBMIT}}', requestData.dateSubmit || '');
  body.replaceText('{{DATE_APPROBATION}}', requestData.dateApprobation || '');
  body.replaceText('{{AVIS_RH}}', requestData.avisRh || '');
  body.replaceText('{{COMMENT_RH}}', requestData.commentRh || '');
  body.replaceText('{{DATE_AVIS_RH}}', requestData.dateAvisRh || '');
  body.replaceText('{{DATE_DECISION}}', formatDate(now));
  body.replaceText('{{VALIDATEUR_NOM}}', validatorProfile ? (validatorProfile.prenom + ' ' + validatorProfile.nom) : '');
  body.replaceText('{{COMMENT_VALIDATEUR}}', requestData.commentValidateur || '');
  body.replaceText('{{DATE_GENERATION}}', formatDateTime(now));
  body.replaceText('{{REQUEST_ID}}', requestData.requestId || '');

  // 4. Ajouter le QR code de validation
  try {
    var webappUrl = SheetDAO_getConfigValue('WEBAPP_URL') || '';
    var qrData = webappUrl
      ? webappUrl + '?page=DetailDemande&id=' + (requestData.requestId || '')
      : 'BAOBAB BURKINA | Ref: ' + (requestData.requestId || '') + ' | ' +
        (requestData.prenom || '') + ' ' + (requestData.nom || '') + ' | Valide: ' + formatDate(now);

    var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=' + encodeURIComponent(qrData);
    var qrResponse = UrlFetchApp.fetch(qrUrl, { muteHttpExceptions: true });
    if (qrResponse.getResponseCode() === 200) {
      var qrPara = body.appendParagraph('');
      qrPara.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
      var qrImage = qrPara.appendInlineImage(qrResponse.getBlob());
      qrImage.setWidth(100);
      qrImage.setHeight(100);
    }
  } catch (e) {
    console.log('QR code generation skipped: ' + e.message);
  }

  doc.saveAndClose();

  // 5. Exporter en PDF
  var pdfBlob = DriveApp.getFileById(docCopy.getId()).getAs(MimeType.PDF);
  pdfBlob.setName(fileName + '.pdf');
  var pdfFile = monthFolder.createFile(pdfBlob);

  // 6. Supprimer la copie Doc intermediaire
  DriveApp.getFileById(docCopy.getId()).setTrashed(true);

  // 7. Definir les permissions
  setArchivePermissions_(pdfFile);

  return pdfFile.getUrl();
}

/**
 * Genere un PDF au format Baobab Burkina avec QR code de validation
 */
function PdfService_generateSimplePdf(requestData, validatorProfile, archiveRootId) {
  var now = new Date();
  var institutionName = SheetDAO_getConfigValue('NOM_INSTITUTION') || 'Baobab Burkina SA';
  var webappUrl = SheetDAO_getConfigValue('WEBAPP_URL') || '';
  var fileName = requestData.matricule + '_' + (requestData.nom || '') + '_' + formatDateISO(now);

  var doc = DocumentApp.create(fileName);
  var body = doc.getBody();
  body.setText('');

  body.setMarginTop(30);
  body.setMarginBottom(30);
  body.setMarginLeft(40);
  body.setMarginRight(40);

  // --- En-tete: institution ---
  var headerPara = body.appendParagraph(institutionName);
  headerPara.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
  headerPara.setFontSize(14);
  headerPara.setBold(true);
  headerPara.setForegroundColor('#3D0068');

  // --- Titre ---
  body.appendParagraph('');
  var typeLabel = requestData.typeConge ? requestData.typeConge.toUpperCase() : 'CONGES PAYES';
  var titlePara = body.appendParagraph('DEMANDE DE ' + typeLabel);
  titlePara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  titlePara.setFontSize(18);
  titlePara.setBold(true);
  titlePara.setForegroundColor('#333333');

  var sep = body.appendParagraph('____');
  sep.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  sep.setForegroundColor('#D4007A');
  sep.setFontSize(10);

  body.appendParagraph('');

  // --- Matricule ---
  var matPara = body.appendParagraph('N° Matricule : ' + (requestData.matricule || ''));
  matPara.setFontSize(11);
  matPara.setBold(true);

  body.appendParagraph('');

  // --- Table principale (infos employe + cadre RH) ---
  var mainTable = body.appendTable();
  mainTable.setBorderWidth(1);
  mainTable.setBorderColor('#cccccc');

  // Recuperer le solde pour le cadre RH
  var balanceDetail = null;
  try {
    balanceDetail = LeaveCounter_getBalanceDetail(requestData.emailEmp);
  } catch (e) {}
  var soldePrecedent = balanceDetail ? balanceDetail.acquis : '-';
  var soldeRestant = balanceDetail ? balanceDetail.disponible : '-';

  // Ligne 1: Nom + Cadre Reserve RH header
  var row0 = mainTable.appendTableRow();
  var cellInfoHeader = row0.appendTableCell();
  cellInfoHeader.setWidth(320);
  addCellText_(cellInfoHeader, 'Nom : ' + (requestData.nom || ''), 10, false);
  addCellText_(cellInfoHeader, '', 2, false);
  addCellText_(cellInfoHeader, 'Prenom(s) : ' + (requestData.prenom || ''), 10, false);
  addCellText_(cellInfoHeader, '', 2, false);
  addCellText_(cellInfoHeader, 'Poste : ' + (requestData.poste || ''), 10, false);
  addCellText_(cellInfoHeader, '', 2, false);
  addCellText_(cellInfoHeader, 'Departement : ' + (requestData.departement || ''), 10, false);
  if (requestData.agence) {
    addCellText_(cellInfoHeader, '', 2, false);
    addCellText_(cellInfoHeader, 'Agence : ' + requestData.agence, 10, false);
  }
  addCellText_(cellInfoHeader, '', 2, false);
  addCellText_(cellInfoHeader, 'Nombre de jours demandes : ' + (requestData.nbJours || 0) + ' jours ouvres.', 10, false);
  addCellText_(cellInfoHeader, '', 2, false);
  addCellText_(cellInfoHeader, 'Date de Depart : ' + (requestData.dateDebut || ''), 10, false);
  addCellText_(cellInfoHeader, '', 2, false);
  addCellText_(cellInfoHeader, 'Date de Reprise : ' + (requestData.dateFin || ''), 10, false);

  // Cadre Reserve RH
  var cellRH = row0.appendTableCell();
  cellRH.setWidth(200);
  cellRH.setBackgroundColor('#f9f8f6');
  var rhTitle = cellRH.appendParagraph('Cadre Reserve RH');
  rhTitle.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  rhTitle.setFontSize(10);
  rhTitle.setBold(true);
  rhTitle.setForegroundColor('#D4007A');

  var rhTable = cellRH.appendTable();
  rhTable.setBorderWidth(1);
  rhTable.setBorderColor('#dddddd');
  addRhRow_(rhTable, 'Solde Precedent', String(soldePrecedent));
  addRhRow_(rhTable, 'Nbre de Jours Ouvres Accordes', String(requestData.nbJours || 0));
  addRhRow_(rhTable, 'Date de Reprise', requestData.dateFin || '');
  addRhRow_(rhTable, 'Solde Restant', String(soldeRestant));

  body.appendParagraph('');

  // --- Table de validation ---
  var valTable = body.appendTable();
  valTable.setBorderWidth(1);
  valTable.setBorderColor('#cccccc');

  var valRow = valTable.appendTableRow();

  // Colonne: Le demandeur
  var cellDemandeur = valRow.appendTableCell();
  cellDemandeur.setWidth(180);
  var demTitle = cellDemandeur.appendParagraph('Le demandeur');
  demTitle.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  demTitle.setFontSize(9);
  demTitle.setBold(true);
  demTitle.setUnderline(true);
  addCellText_(cellDemandeur, '', 6, false);
  addCellText_(cellDemandeur, 'Signature : ' + (requestData.prenom || '') + ' ' + (requestData.nom || ''), 9, false);
  addCellText_(cellDemandeur, '', 3, false);
  addCellText_(cellDemandeur, 'Fait le : ' + (requestData.dateSubmit || ''), 9, false);

  // Colonne: Validation N+1
  var cellN1 = valRow.appendTableCell();
  cellN1.setWidth(180);
  var n1Title = cellN1.appendParagraph('Validation du N+1 ou N+2 :');
  n1Title.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  n1Title.setFontSize(9);
  n1Title.setBold(true);
  addCellText_(cellN1, '', 6, false);
  addCellText_(cellN1, 'Signature : ' + (requestData.managerName || ''), 9, false);
  addCellText_(cellN1, '', 3, false);
  addCellText_(cellN1, 'Le, ' + (requestData.dateApprobation || ''), 9, false);

  // Colonne: Validation RH
  var cellVal = valRow.appendTableCell();
  cellVal.setWidth(160);
  cellVal.setBackgroundColor('#f9f8f6');
  var valTitle = cellVal.appendParagraph('VALIDATION');
  valTitle.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  valTitle.setFontSize(10);
  valTitle.setBold(true);
  addCellText_(cellVal, '', 4, false);
  var visaPara = cellVal.appendParagraph('Visa : Valide RH');
  visaPara.setFontSize(10);
  visaPara.setBold(true);
  visaPara.setForegroundColor('#D4007A');
  addCellText_(cellVal, '', 4, false);
  var lieuDate = 'Ouaga, le ' + formatDate(now);
  addCellText_(cellVal, lieuDate, 9, false);

  body.appendParagraph('');

  // --- QR Code de validation ---
  try {
    var qrData = 'BAOBAB BURKINA SA\n' +
      'Ref: ' + (requestData.requestId || '') + '\n' +
      'Employe: ' + (requestData.prenom || '') + ' ' + (requestData.nom || '') + ' (' + (requestData.matricule || '') + ')\n' +
      'Conge: ' + (requestData.typeConge || '') + '\n' +
      'Du ' + (requestData.dateDebut || '') + ' au ' + (requestData.dateFin || '') + '\n' +
      (requestData.nbJours || 0) + ' jours\n' +
      'Valide le: ' + formatDate(now);

    if (webappUrl) {
      qrData = webappUrl + '?page=DetailDemande&id=' + (requestData.requestId || '');
    }

    var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=' + encodeURIComponent(qrData);
    var qrResponse = UrlFetchApp.fetch(qrUrl, { muteHttpExceptions: true });
    if (qrResponse.getResponseCode() === 200) {
      var qrBlob = qrResponse.getBlob();
      var qrPara = body.appendParagraph('');
      qrPara.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
      var qrImage = qrPara.appendInlineImage(qrBlob);
      qrImage.setWidth(100);
      qrImage.setHeight(100);
    }
  } catch (e) {
    console.log('QR code generation skipped: ' + e.message);
  }

  body.appendParagraph('');

  // --- Pied de page ---
  var footer1 = body.appendParagraph('BAOBAB BURKINA SA. 570 AVENUE DE LA NATION 02 BP 5028 OUAGA 02 – CAPITAL. 3 870 150 000 FCFA');
  footer1.setFontSize(7);
  footer1.setForegroundColor('#888888');
  footer1.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  var footer2 = body.appendParagraph('RCCM: BF-OUA-2014-B-5354 / BF OUA 2022 M 2436. REGISTRE SFD: A-13-15-0469. IFU: 00059780T');
  footer2.setFontSize(7);
  footer2.setForegroundColor('#888888');
  footer2.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  var footer3 = body.appendParagraph('Tel. (+226) 25 30 66 66. EMAIL. CONTACTBBF@BAOBABGROUP.COM');
  footer3.setFontSize(7);
  footer3.setForegroundColor('#888888');
  footer3.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  var refPara = body.appendParagraph('Ref: ' + (requestData.requestId || '') + ' | Genere le ' + formatDateTime(now));
  refPara.setFontSize(6);
  refPara.setForegroundColor('#aaaaaa');
  refPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  doc.saveAndClose();

  // Exporter en PDF
  var pdfBlob = DriveApp.getFileById(doc.getId()).getAs(MimeType.PDF);
  pdfBlob.setName(fileName + '.pdf');

  var pdfFile;
  if (archiveRootId) {
    var rootFolder = DriveApp.getFolderById(archiveRootId);
    var yearFolder = getOrCreateSubfolder_(rootFolder, now.getFullYear().toString());
    var monthFolder = getOrCreateSubfolder_(yearFolder, padMonth(now.getMonth() + 1));
    pdfFile = monthFolder.createFile(pdfBlob);
    setArchivePermissions_(pdfFile);
  } else {
    pdfFile = DriveApp.createFile(pdfBlob);
  }

  DriveApp.getFileById(doc.getId()).setTrashed(true);
  return pdfFile.getUrl();
}

function addCellText_(cell, text, fontSize, bold) {
  var para = cell.appendParagraph(text);
  para.setFontSize(fontSize);
  if (bold) para.setBold(true);
  return para;
}

function addRhRow_(table, label, value) {
  var row = table.appendTableRow();
  var c1 = row.appendTableCell(label);
  c1.setWidth(110);
  var p1 = c1.getChild(0).asParagraph();
  p1.setFontSize(8);
  var c2 = row.appendTableCell(value);
  var p2 = c2.getChild(0).asParagraph();
  p2.setFontSize(10);
  p2.setBold(true);
  p2.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
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
