/**
 * DocumentService.gs - Generation d'attestations et certificats RH
 * Genere des documents PDF via Google Docs et les archive dans Drive
 */

/**
 * Genere un document RH (attestation, certificat) et l'archive
 */
function DocumentService_generate(emailEmp, typeDocument, notes, creatorEmail) {
  if (DOCUMENT_TYPES.indexOf(typeDocument) === -1) {
    throw new Error('Type de document invalide: ' + typeDocument);
  }

  var emp = SheetDAO_getRowByKey(SHEET_NAMES.EMPLOYES, COL_EMPLOYES.EMAIL, emailEmp);
  if (!emp) throw new Error('Employe non trouve: ' + emailEmp);

  var profile = buildEmployeeObject(emp);
  var institutionName = SheetDAO_getConfigValue('NOM_INSTITUTION') || 'Microfinance SA';
  var now = new Date();

  var content;
  switch (typeDocument) {
    case 'Attestation de travail':
      content = buildAttestationTravail_(profile, institutionName, now);
      break;
    case 'Certificat de travail':
      content = buildCertificatTravail_(profile, institutionName, now);
      break;
    case 'Attestation de stage':
      content = buildAttestationStage_(profile, institutionName, now);
      break;
    case 'Attestation de presence':
      content = buildAttestationPresence_(profile, institutionName, now);
      break;
    default:
      throw new Error('Generateur non disponible pour: ' + typeDocument);
  }

  var pdfUrl = createDocumentPdf_(content, profile, typeDocument, now);

  var docId = generateUUID();
  SheetDAO_appendRow(SHEET_NAMES_SIRH.DOCUMENTS_RH, [
    docId, emailEmp, typeDocument, now, creatorEmail, pdfUrl, notes || ''
  ]);

  SheetDAO_appendRow(SHEET_NAMES.AUDIT, [
    now, creatorEmail, 'RH', docId, 'DOCUMENT_GENERATED', '', '',
    typeDocument + ' pour ' + profile.prenom + ' ' + profile.nom
  ]);

  return { success: true, documentId: docId, url: pdfUrl };
}

/**
 * Retourne les documents generes pour un employe
 */
function DocumentService_getByEmployee(emailEmp) {
  var rows = SheetDAO_getRowsByKey(SHEET_NAMES_SIRH.DOCUMENTS_RH, COL_DOCUMENTS_RH.EMAIL_EMP, emailEmp);
  return rows.map(function(r) {
    return {
      documentId: r[COL_DOCUMENTS_RH.DOCUMENT_ID] || '',
      emailEmp: r[COL_DOCUMENTS_RH.EMAIL_EMP] || '',
      typeDocument: r[COL_DOCUMENTS_RH.TYPE_DOCUMENT] || '',
      dateGeneration: r[COL_DOCUMENTS_RH.DATE_GENERATION] instanceof Date ? formatDate(r[COL_DOCUMENTS_RH.DATE_GENERATION]) : String(r[COL_DOCUMENTS_RH.DATE_GENERATION] || ''),
      generePar: r[COL_DOCUMENTS_RH.GENERE_PAR] || '',
      documentUrl: r[COL_DOCUMENTS_RH.DOCUMENT_URL] || '',
      notes: r[COL_DOCUMENTS_RH.NOTES] || ''
    };
  }).sort(function(a, b) { return a.dateGeneration > b.dateGeneration ? -1 : 1; });
}

/**
 * Retourne tous les documents generes (vue RH)
 */
function DocumentService_getAll() {
  var allRows = SheetDAO_getAllRawData(SHEET_NAMES_SIRH.DOCUMENTS_RH);
  var empData = SheetDAO_getAllRawData(SHEET_NAMES.EMPLOYES);
  var empMap = {};
  for (var k = 0; k < empData.length; k++) {
    empMap[String(empData[k][COL_EMPLOYES.EMAIL]).toLowerCase()] = empData[k];
  }

  var results = [];
  for (var i = 0; i < allRows.length; i++) {
    var r = allRows[i];
    var email = String(r[COL_DOCUMENTS_RH.EMAIL_EMP]).toLowerCase();
    var emp = empMap[email];
    results.push({
      documentId: r[COL_DOCUMENTS_RH.DOCUMENT_ID] || '',
      emailEmp: r[COL_DOCUMENTS_RH.EMAIL_EMP] || '',
      nom: emp ? (emp[COL_EMPLOYES.NOM] || '') : '',
      prenom: emp ? (emp[COL_EMPLOYES.PRENOM] || '') : '',
      typeDocument: r[COL_DOCUMENTS_RH.TYPE_DOCUMENT] || '',
      dateGeneration: r[COL_DOCUMENTS_RH.DATE_GENERATION] instanceof Date ? formatDate(r[COL_DOCUMENTS_RH.DATE_GENERATION]) : String(r[COL_DOCUMENTS_RH.DATE_GENERATION] || ''),
      generePar: r[COL_DOCUMENTS_RH.GENERE_PAR] || '',
      documentUrl: r[COL_DOCUMENTS_RH.DOCUMENT_URL] || '',
      notes: r[COL_DOCUMENTS_RH.NOTES] || ''
    });
  }

  results.sort(function(a, b) { return a.dateGeneration > b.dateGeneration ? -1 : 1; });
  return results;
}

// ===================================================================
// GENERATEURS DE CONTENU
// ===================================================================

function buildAttestationTravail_(p, inst, now) {
  var anciennete = '';
  if (p.dateEmbauche) {
    var emb = parseDate(p.dateEmbauche);
    if (emb) {
      var diff = now - emb;
      var years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
      var months = Math.floor((diff % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
      anciennete = years + ' an' + (years > 1 ? 's' : '') + ' et ' + months + ' mois';
    }
  }
  return {
    title: 'ATTESTATION DE TRAVAIL',
    body: 'Je soussigne(e), agissant en qualite de Directeur General de ' + inst + ', ' +
      'atteste par la presente que :\n\n' +
      'M./Mme ' + p.prenom + ' ' + p.nom + '\n' +
      'Matricule : ' + p.matricule + '\n' +
      (p.dateNaissance ? 'Ne(e) le : ' + p.dateNaissance + (p.lieuNaissance ? ' a ' + p.lieuNaissance : '') + '\n' : '') +
      (p.numCni ? 'CNI N° : ' + p.numCni + '\n' : '') +
      '\n' +
      'Est employe(e) au sein de notre institution depuis le ' + (p.dateEmbauche || '___________') +
      (anciennete ? ' (soit ' + anciennete + ')' : '') + ', ' +
      'en qualite de ' + (p.poste || '___________') + ', ' +
      'au sein du departement ' + (p.departement || '___________') +
      (p.agence ? ', affecte(e) a l\'' + p.agence : '') + '.\n\n' +
      'A la date de ce jour, l\'interesse(e) est toujours en activite dans notre structure ' +
      'sous contrat ' + (p.typeContrat || '___________') + '.\n\n' +
      'La presente attestation est delivree a l\'interesse(e) pour servir et valoir ce que de droit.'
  };
}

function buildCertificatTravail_(p, inst, now) {
  return {
    title: 'CERTIFICAT DE TRAVAIL',
    body: 'Je soussigne(e), agissant en qualite de Directeur General de ' + inst + ', ' +
      'certifie par la presente que :\n\n' +
      'M./Mme ' + p.prenom + ' ' + p.nom + '\n' +
      'Matricule : ' + p.matricule + '\n' +
      (p.dateNaissance ? 'Ne(e) le : ' + p.dateNaissance + (p.lieuNaissance ? ' a ' + p.lieuNaissance : '') + '\n' : '') +
      '\n' +
      'A ete employe(e) au sein de ' + inst + ' du ' + (p.dateEmbauche || '___________') +
      ' au ' + formatDate(now) + ', ' +
      'en qualite de ' + (p.poste || '___________') + '.\n\n' +
      'Durant cette periode, M./Mme ' + p.nom + ' a fait preuve de serieux et de ' +
      'professionnalisme dans l\'exercice de ses fonctions.\n\n' +
      'M./Mme ' + p.nom + ' nous quitte ce jour, libre de tout engagement.\n\n' +
      'En foi de quoi, le present certificat est etabli pour servir et valoir ce que de droit.'
  };
}

function buildAttestationStage_(p, inst, now) {
  return {
    title: 'ATTESTATION DE STAGE',
    body: 'Je soussigne(e), agissant en qualite de Directeur General de ' + inst + ', ' +
      'atteste par la presente que :\n\n' +
      'M./Mme ' + p.prenom + ' ' + p.nom + '\n' +
      (p.dateNaissance ? 'Ne(e) le : ' + p.dateNaissance + (p.lieuNaissance ? ' a ' + p.lieuNaissance : '') + '\n' : '') +
      '\n' +
      'A effectue un stage au sein de ' + inst + '\n' +
      'Du ' + (p.dateEmbauche || '___________') + ' au ' + (p.dateFinContrat || formatDate(now)) + '\n' +
      'Au sein du departement : ' + (p.departement || '___________') + '\n' +
      'En qualite de : ' + (p.poste || 'Stagiaire') + '\n\n' +
      'Durant cette periode, l\'interesse(e) a fait preuve de motivation et d\'engagement ' +
      'dans les missions qui lui ont ete confiees.\n\n' +
      'La presente attestation est delivree a l\'interesse(e) pour servir et valoir ce que de droit.'
  };
}

function buildAttestationPresence_(p, inst, now) {
  return {
    title: 'ATTESTATION DE PRESENCE',
    body: 'Je soussigne(e), agissant en qualite de Directeur General de ' + inst + ', ' +
      'atteste par la presente que :\n\n' +
      'M./Mme ' + p.prenom + ' ' + p.nom + '\n' +
      'Matricule : ' + p.matricule + '\n' +
      'Poste : ' + (p.poste || '___________') + '\n' +
      'Departement : ' + (p.departement || '___________') + '\n\n' +
      'Est present(e) a son poste de travail a la date du ' + formatDate(now) + '.\n\n' +
      'La presente attestation est delivree a l\'interesse(e) pour servir et valoir ce que de droit.'
  };
}

// ===================================================================
// GENERATION PDF
// ===================================================================

function createDocumentPdf_(content, profile, typeDocument, now) {
  var archiveRootId = SheetDAO_getConfigValue('ARCHIVE_FOLDER_ID');
  var institutionName = SheetDAO_getConfigValue('NOM_INSTITUTION') || 'Microfinance SA';
  var fileName = typeDocument.replace(/\s+/g, '_') + '_' + profile.matricule + '_' + formatDateISO(now);

  var doc = DocumentApp.create(fileName);
  var body = doc.getBody();
  body.setText('');

  var headerStyle = {};
  headerStyle[DocumentApp.Attribute.HORIZONTAL_ALIGNMENT] = DocumentApp.HorizontalAlignment.CENTER;
  headerStyle[DocumentApp.Attribute.FONT_SIZE] = 12;
  headerStyle[DocumentApp.Attribute.BOLD] = true;

  body.appendParagraph(institutionName)
    .setHeading(DocumentApp.ParagraphHeading.HEADING1)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('Societe de Microfinance')
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendParagraph('');
  body.appendParagraph(content.title)
    .setHeading(DocumentApp.ParagraphHeading.HEADING2)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('');

  var lines = content.body.split('\n');
  for (var i = 0; i < lines.length; i++) {
    body.appendParagraph(lines[i]);
  }

  body.appendParagraph('');
  body.appendParagraph('Fait a ___________, le ' + formatDate(now))
    .setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  body.appendParagraph('');
  body.appendParagraph('Le Directeur General')
    .setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  body.appendParagraph('');
  body.appendParagraph('(Signature et cachet)')
    .setAlignment(DocumentApp.HorizontalAlignment.RIGHT);

  doc.saveAndClose();

  var pdfBlob = DriveApp.getFileById(doc.getId()).getAs(MimeType.PDF);
  pdfBlob.setName(fileName + '.pdf');

  var pdfFile;
  if (archiveRootId) {
    var rootFolder = DriveApp.getFolderById(archiveRootId);
    var docFolder = getOrCreateSubfolder_(rootFolder, 'Documents_RH');
    var yearFolder = getOrCreateSubfolder_(docFolder, now.getFullYear().toString());
    pdfFile = yearFolder.createFile(pdfBlob);
    setArchivePermissions_(pdfFile);
  } else {
    pdfFile = DriveApp.createFile(pdfBlob);
  }

  DriveApp.getFileById(doc.getId()).setTrashed(true);

  return pdfFile.getUrl();
}
