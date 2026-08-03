/**
 * Setup.gs - Bootstrap du systeme
 * Fonctions a executer une seule fois depuis l'editeur Apps Script
 */

/**
 * IMPORTANT : Executez cette fonction UNE FOIS depuis l'editeur Apps Script
 * Elle enregistre l'ID du classeur pour que la Web App fonctionne pour tous les utilisateurs
 */
function saveSpreadsheetId() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    Logger.log('ERREUR: Executez cette fonction depuis l\'editeur du classeur (pas depuis un autre projet).');
    return;
  }
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  Logger.log('ID du classeur enregistre avec succes: ' + ss.getId());
  Logger.log('La Web App fonctionnera maintenant pour tous les utilisateurs.');
}

/**
 * Configuration initiale complete du systeme
 */
function initialSetup() {
  saveSpreadsheetId();
  createAllSheets();
  addDataValidations();
  populateReferentiel();
  populateConfig();
  formatSheets();
  Logger.log('Setup initial termine avec succes.');
}

/**
 * Cree toutes les feuilles avec leurs headers
 */
function createAllSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  createSheetIfNotExists_(ss, SHEET_NAMES.DEMANDES, HEADERS_DEMANDES);
  createSheetIfNotExists_(ss, SHEET_NAMES.EMPLOYES, HEADERS_EMPLOYES);
  createSheetIfNotExists_(ss, SHEET_NAMES.REFERENTIEL, HEADERS_REFERENTIEL);
  createSheetIfNotExists_(ss, SHEET_NAMES.AUDIT, HEADERS_AUDIT);
  createSheetIfNotExists_(ss, SHEET_NAMES.CONFIG, HEADERS_CONFIG);
  createSheetIfNotExists_(ss, SHEET_NAMES_SIRH.MOUVEMENTS, HEADERS_MOUVEMENTS);
  createSheetIfNotExists_(ss, SHEET_NAMES_SIRH.ONBOARDING, HEADERS_ONBOARDING);
  createSheetIfNotExists_(ss, SHEET_NAMES_SIRH.CONTRATS, HEADERS_CONTRATS);
  createSheetIfNotExists_(ss, SHEET_NAMES_SIRH.DOCUMENTS_RH, HEADERS_DOCUMENTS_RH);

  // Supprimer la feuille par defaut "Feuille 1" si elle existe et est vide
  var defaultSheet = ss.getSheetByName('Feuille 1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch (e) {
      // Ignorer si c'est la derniere feuille
    }
  }
}

/**
 * Cree une feuille si elle n'existe pas deja
 */
function createSheetIfNotExists_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  // Ecrire les headers si la premiere ligne est vide
  var firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  var isEmpty = firstRow.every(function(cell) { return cell === ''; });

  if (isEmpty) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  // Figer la premiere ligne
  sheet.setFrozenRows(1);

  return sheet;
}

/**
 * Ajoute les validations de donnees sur les colonnes appropriees
 */
function addDataValidations() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Validation STATUT sur Demandes
  var demandesSheet = ss.getSheetByName(SHEET_NAMES.DEMANDES);
  if (demandesSheet) {
    var statusValues = Object.values(STATUS);
    var statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(statusValues)
      .setAllowInvalid(false)
      .build();
    var statusCol = COL_DEMANDES.STATUT + 1;
    demandesSheet.getRange(2, statusCol, 500, 1).setDataValidation(statusRule);
  }

  // Validation ROLE sur Employes
  var employesSheet = ss.getSheetByName(SHEET_NAMES.EMPLOYES);
  if (employesSheet) {
    var roleValues = Object.values(ROLES);
    var roleRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(roleValues)
      .setAllowInvalid(false)
      .build();
    var roleCol = COL_EMPLOYES.ROLE + 1;
    employesSheet.getRange(2, roleCol, 500, 1).setDataValidation(roleRule);

    // Validation ACTIF (TRUE/FALSE)
    var boolRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['TRUE', 'FALSE'])
      .setAllowInvalid(false)
      .build();
    var actifCol = COL_EMPLOYES.ACTIF + 1;
    employesSheet.getRange(2, actifCol, 500, 1).setDataValidation(boolRule);

    // Validations conformite BF
    var genreRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(GENRES)
      .setAllowInvalid(true)
      .build();
    employesSheet.getRange(2, COL_EMPLOYES.GENRE + 1, 500, 1).setDataValidation(genreRule);

    var niveauRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(NIVEAUX_ETUDE)
      .setAllowInvalid(true)
      .build();
    employesSheet.getRange(2, COL_EMPLOYES.NIVEAU_ENTREE + 1, 500, 1).setDataValidation(niveauRule);

    var natureContratRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(NATURES_CONTRAT)
      .setAllowInvalid(true)
      .build();
    employesSheet.getRange(2, COL_EMPLOYES.NATURE_CONTRAT_ENTREE + 1, 500, 1).setDataValidation(natureContratRule);

    var statutPosteRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(STATUTS_POSTE)
      .setAllowInvalid(true)
      .build();
    employesSheet.getRange(2, COL_EMPLOYES.STATUT_POSTE_ENTREE + 1, 500, 1).setDataValidation(statutPosteRule);

    var sitFamRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(SITUATIONS_FAMILIALES)
      .setAllowInvalid(true)
      .build();
    employesSheet.getRange(2, COL_EMPLOYES.SITUATION_FAMILIALE + 1, 500, 1).setDataValidation(sitFamRule);
    employesSheet.getRange(2, COL_EMPLOYES.SITUATION_FAMILIALE_ENTREE + 1, 500, 1).setDataValidation(sitFamRule);
  }
}

/**
 * Remplit la feuille Referentiel avec les donnees par defaut
 */
function populateReferentiel() {
  var sheet = SheetDAO_getSheet(SHEET_NAMES.REFERENTIEL);
  if (!sheet) return;

  var existingData = sheet.getDataRange().getValues();
  if (existingData.length > 1) return; // Deja peuplee

  // Determiner le nombre max de lignes
  var types = Object.values(LEAVE_TYPES);
  var maxRows = Math.max(DEPARTEMENTS.length, AGENCES.length, types.length);

  var data = [];
  for (var i = 0; i < maxRows; i++) {
    data.push([
      i < DEPARTEMENTS.length ? DEPARTEMENTS[i] : '',
      i < AGENCES.length ? AGENCES[i] : '',
      i < types.length ? types[i] : '',
      '' // Jours feries a remplir manuellement
    ]);
  }

  if (data.length > 0) {
    sheet.getRange(2, 1, data.length, 4).setValues(data);
  }
}

/**
 * Remplit la feuille Config avec les valeurs par defaut
 */
function populateConfig() {
  var sheet = SheetDAO_getSheet(SHEET_NAMES.CONFIG);
  if (!sheet) return;

  var existingData = sheet.getDataRange().getValues();
  if (existingData.length > 1) return; // Deja peuplee

  var configKeys = Object.keys(DEFAULT_CONFIG);
  var data = [];
  for (var i = 0; i < configKeys.length; i++) {
    data.push([configKeys[i], DEFAULT_CONFIG[configKeys[i]]]);
  }

  if (data.length > 0) {
    sheet.getRange(2, 1, data.length, 2).setValues(data);
  }
}

/**
 * Formate les feuilles (headers en gras, couleur de fond, largeurs)
 */
function formatSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();

  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    var lastCol = sheet.getLastColumn();
    if (lastCol > 0) {
      var headerRange = sheet.getRange(1, 1, 1, lastCol);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#1a56db');
      headerRange.setFontColor('#ffffff');
      headerRange.setHorizontalAlignment('center');
    }
  }
}

/**
 * Migration vers le SIRH etendu
 * A executer UNE FOIS si le systeme existait deja avec l'ancien schema (12 colonnes Employes)
 * Cette fonction est SANS DANGER : elle ne supprime rien, elle ajoute les colonnes/config manquantes
 */
function migrateToSIRH() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Etendre les headers de la feuille Employes (jusqu'a 51 colonnes)
  var empSheet = ss.getSheetByName(SHEET_NAMES.EMPLOYES);
  if (empSheet) {
    var currentHeaders = empSheet.getRange(1, 1, 1, empSheet.getLastColumn()).getValues()[0];
    if (currentHeaders.length < HEADERS_EMPLOYES.length) {
      var startCol = currentHeaders.length + 1;
      var newHeaders = HEADERS_EMPLOYES.slice(currentHeaders.length);
      empSheet.getRange(1, startCol, 1, newHeaders.length).setValues([newHeaders]);
      Logger.log('Employes: ' + newHeaders.length + ' nouvelles colonnes ajoutees (total: ' + HEADERS_EMPLOYES.length + ')');
    } else {
      Logger.log('Employes: headers deja a jour (' + currentHeaders.length + ' colonnes)');
    }

    // Validations sur les colonnes SIRH Phase 1
    var contractRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(CONTRACT_TYPES)
      .setAllowInvalid(true)
      .build();
    empSheet.getRange(2, COL_EMPLOYES.TYPE_CONTRAT + 1, 500, 1).setDataValidation(contractRule);

    var familyRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(SITUATIONS_FAMILIALES)
      .setAllowInvalid(true)
      .build();
    empSheet.getRange(2, COL_EMPLOYES.SITUATION_FAMILIALE + 1, 500, 1).setDataValidation(familyRule);

    // Validations conformite BF
    var genreRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(GENRES)
      .setAllowInvalid(true)
      .build();
    empSheet.getRange(2, COL_EMPLOYES.GENRE + 1, 500, 1).setDataValidation(genreRule);

    var niveauRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(NIVEAUX_ETUDE)
      .setAllowInvalid(true)
      .build();
    empSheet.getRange(2, COL_EMPLOYES.NIVEAU_ENTREE + 1, 500, 1).setDataValidation(niveauRule);

    var natureContratRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(NATURES_CONTRAT)
      .setAllowInvalid(true)
      .build();
    empSheet.getRange(2, COL_EMPLOYES.NATURE_CONTRAT_ENTREE + 1, 500, 1).setDataValidation(natureContratRule);

    var statutPosteRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(STATUTS_POSTE)
      .setAllowInvalid(true)
      .build();
    empSheet.getRange(2, COL_EMPLOYES.STATUT_POSTE_ENTREE + 1, 500, 1).setDataValidation(statutPosteRule);

    var sitFamEntreeRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(SITUATIONS_FAMILIALES)
      .setAllowInvalid(true)
      .build();
    empSheet.getRange(2, COL_EMPLOYES.SITUATION_FAMILIALE_ENTREE + 1, 500, 1).setDataValidation(sitFamEntreeRule);
  }

  // 2. Creer les feuilles supplementaires si elles n'existent pas
  createSheetIfNotExists_(ss, SHEET_NAMES_SIRH.MOUVEMENTS, HEADERS_MOUVEMENTS);
  createSheetIfNotExists_(ss, SHEET_NAMES_SIRH.ONBOARDING, HEADERS_ONBOARDING);
  createSheetIfNotExists_(ss, SHEET_NAMES_SIRH.CONTRATS, HEADERS_CONTRATS);
  createSheetIfNotExists_(ss, SHEET_NAMES_SIRH.DOCUMENTS_RH, HEADERS_DOCUMENTS_RH);

  // 3. Ajouter les cles de config manquantes
  var newConfigKeys = ['CALENDAR_SYNC_ENABLED', 'HEURE_REFERENCE'];
  for (var i = 0; i < newConfigKeys.length; i++) {
    var existing = SheetDAO_getConfigValue(newConfigKeys[i]);
    if (!existing) {
      SheetDAO_setConfigValue(newConfigKeys[i], DEFAULT_CONFIG[newConfigKeys[i]]);
      Logger.log('Config: ajout de ' + newConfigKeys[i] + ' = ' + DEFAULT_CONFIG[newConfigKeys[i]]);
    }
  }

  // 4. Mettre a jour le Referentiel avec les nouveaux types de conge
  var refSheet = ss.getSheetByName(SHEET_NAMES.REFERENTIEL);
  if (refSheet) {
    var refData = refSheet.getDataRange().getValues();
    var existingTypes = [];
    for (var r = 1; r < refData.length; r++) {
      if (refData[r][2]) existingTypes.push(refData[r][2]);
    }
    var allTypes = Object.values(LEAVE_TYPES);
    var newTypes = [];
    for (var t = 0; t < allTypes.length; t++) {
      if (existingTypes.indexOf(allTypes[t]) === -1) newTypes.push(allTypes[t]);
    }
    if (newTypes.length > 0) {
      var lastRow = refSheet.getLastRow();
      for (var n = 0; n < newTypes.length; n++) {
        refSheet.getRange(lastRow + 1 + n, 3).setValue(newTypes[n]);
      }
      Logger.log('Referentiel: ' + newTypes.length + ' nouveaux types de conge ajoutes');
    }
  }

  // 5. Reformater les headers
  formatSheets();

  Logger.log('Migration SIRH terminee avec succes.');
}

/**
 * Cree le dossier d'archives dans Drive
 */
function createArchiveFolder() {
  var folderName = 'Conges_Archives';
  var folders = DriveApp.getFoldersByName(folderName);

  var folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(folderName);
  }

  SheetDAO_setConfigValue('ARCHIVE_FOLDER_ID', folder.getId());
  Logger.log('Dossier archive cree/trouve: ' + folder.getUrl());
  return folder;
}

/**
 * Ajoute des donnees de test (developpement uniquement)
 */
function addSampleData() {
  var sheet = SheetDAO_getSheet(SHEET_NAMES.EMPLOYES);
  if (!sheet) return;

  var existingData = sheet.getDataRange().getValues();
  if (existingData.length > 1) {
    Logger.log('Des employes existent deja. Ajout annule.');
    return;
  }

  // 12 champs de base + 17 champs SIRH Phase 1 + 22 champs conformite BF = 51 colonnes
  var pad = ['','','','','','',0,'','','','','','','CDI','','','',
    '','','','','','','','','','','','','','','','','','','','','',''];
  var sampleEmployees = [
    ['employe1@microfinance.com', 'M0001', 'Dupont', 'Jean', 'Analyste Credit', 'Direction Clientele', 'Agence 1', 'chef1@microfinance.com', 'EMPLOYE', 30, 30, true].concat(pad),
    ['employe2@microfinance.com', 'M0002', 'Martin', 'Marie', 'Comptable', 'Direction Administrative et Financiere', '', 'chefdept1@microfinance.com', 'EMPLOYE', 30, 30, true].concat(pad),
    ['chef1@microfinance.com', 'M0010', 'Bernard', 'Pierre', 'Chef Agence 1', 'Direction Clientele', 'Agence 1', 'dirclient@microfinance.com', 'CHEF_AGENCE', 30, 30, true].concat(pad),
    ['chefdept1@microfinance.com', 'M0020', 'Petit', 'Sophie', 'Responsable DAF', 'Direction Administrative et Financiere', '', 'dg@microfinance.com', 'CHEF_DEPARTEMENT', 30, 30, true].concat(pad),
    ['rh@microfinance.com', 'M0030', 'Moreau', 'Claire', 'Responsable RH', 'Ressources Humaines', '', 'dg@microfinance.com', 'RH', 30, 30, true].concat(pad),
    ['dirclient@microfinance.com', 'M0040', 'Robert', 'Paul', 'Directeur Clientele', 'Direction Clientele', '', 'dg@microfinance.com', 'DIRECTEUR_CLIENTELE', 30, 30, true].concat(pad),
    ['dg@microfinance.com', 'M0050', 'Leroy', 'Jacques', 'Directeur General', 'Direction Generale', '', '', 'DIRECTEUR_GENERAL', 30, 30, true].concat(pad)
  ];

  sheet.getRange(2, 1, sampleEmployees.length, sampleEmployees[0].length).setValues(sampleEmployees);
  Logger.log(sampleEmployees.length + ' employes de test ajoutes.');
}
