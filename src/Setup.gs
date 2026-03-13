/**
 * Setup.gs - Bootstrap du systeme
 * Fonctions a executer une seule fois depuis l'editeur Apps Script
 */

/**
 * Configuration initiale complete du systeme
 */
function initialSetup() {
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
  var maxRows = Math.max(DEPARTEMENTS.length, AGENCES.length, 2);
  var types = [LEAVE_TYPES.PAID, LEAVE_TYPES.EXCEPTIONAL];

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

  var sampleEmployees = [
    ['employe1@microfinance.com', 'M0001', 'Dupont', 'Jean', 'Analyste Credit', 'Direction Clientele', 'Agence 1', 'chef1@microfinance.com', 'EMPLOYE', 30, 30, true],
    ['employe2@microfinance.com', 'M0002', 'Martin', 'Marie', 'Comptable', 'Direction Administrative et Financiere', '', 'chefdept1@microfinance.com', 'EMPLOYE', 30, 30, true],
    ['chef1@microfinance.com', 'M0010', 'Bernard', 'Pierre', 'Chef Agence 1', 'Direction Clientele', 'Agence 1', 'dirclient@microfinance.com', 'CHEF_AGENCE', 30, 30, true],
    ['chefdept1@microfinance.com', 'M0020', 'Petit', 'Sophie', 'Responsable DAF', 'Direction Administrative et Financiere', '', 'dg@microfinance.com', 'CHEF_DEPARTEMENT', 30, 30, true],
    ['rh@microfinance.com', 'M0030', 'Moreau', 'Claire', 'Responsable RH', 'Ressources Humaines', '', 'dg@microfinance.com', 'RH', 30, 30, true],
    ['dirclient@microfinance.com', 'M0040', 'Robert', 'Paul', 'Directeur Clientele', 'Direction Clientele', '', 'dg@microfinance.com', 'DIRECTEUR_CLIENTELE', 30, 30, true],
    ['dg@microfinance.com', 'M0050', 'Leroy', 'Jacques', 'Directeur General', 'Direction Generale', '', '', 'DIRECTEUR_GENERAL', 30, 30, true]
  ];

  sheet.getRange(2, 1, sampleEmployees.length, sampleEmployees[0].length).setValues(sampleEmployees);
  Logger.log(sampleEmployees.length + ' employes de test ajoutes.');
}
