/**
 * SheetDAO.gs - Data Access Object
 * Toutes les interactions avec SpreadsheetApp sont isolees ici.
 * Aucun autre fichier .gs ne doit appeler SpreadsheetApp directement.
 */

// Cache au niveau module
var _spreadsheet = null;
var _sheets = {};

/**
 * Retourne le spreadsheet (avec cache)
 * Utilise openById si l'ID est stocke dans les Script Properties (necessaire pour Web App)
 * Fallback sur getActiveSpreadsheet pour l'execution depuis l'editeur
 */
function SheetDAO_getSpreadsheet() {
  if (!_spreadsheet) {
    var ssId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (ssId) {
      _spreadsheet = SpreadsheetApp.openById(ssId);
    } else {
      _spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      if (_spreadsheet) {
        PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', _spreadsheet.getId());
      }
    }
  }
  if (!_spreadsheet) {
    throw new Error('Impossible d\'acceder au classeur. Executez la fonction saveSpreadsheetId() depuis l\'editeur Apps Script.');
  }
  return _spreadsheet;
}

/**
 * Retourne une feuille par son nom (avec cache)
 */
function SheetDAO_getSheet(sheetName) {
  if (!_sheets[sheetName]) {
    _sheets[sheetName] = SheetDAO_getSpreadsheet().getSheetByName(sheetName);
  }
  return _sheets[sheetName];
}

/**
 * Retourne toutes les lignes d'une feuille sous forme de tableau d'objets
 * Utilise la premiere ligne comme headers
 */
function SheetDAO_getAllData(sheetName) {
  var sheet = SheetDAO_getSheet(sheetName);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var headers = data[0];
  var results = [];

  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    results.push(obj);
  }
  return results;
}

/**
 * Retourne toutes les lignes brutes d'une feuille (sans header)
 */
function SheetDAO_getAllRawData(sheetName) {
  var sheet = SheetDAO_getSheet(sheetName);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  return data.slice(1);
}

/**
 * Trouve une ligne par cle dans une colonne specifique
 * Retourne le tableau brut de la ligne ou null
 */
function SheetDAO_getRowByKey(sheetName, colIndex, keyValue) {
  var rows = SheetDAO_getAllRawData(sheetName);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][colIndex]).toLowerCase() === String(keyValue).toLowerCase()) {
      return rows[i];
    }
  }
  return null;
}

/**
 * Trouve toutes les lignes correspondant a une cle
 */
function SheetDAO_getRowsByKey(sheetName, colIndex, keyValue) {
  var rows = SheetDAO_getAllRawData(sheetName);
  var results = [];
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][colIndex]).toLowerCase() === String(keyValue).toLowerCase()) {
      results.push(rows[i]);
    }
  }
  return results;
}

/**
 * Retourne le numero de ligne (1-based) pour une cle donnee
 * Row 1 = header, Row 2 = premiere donnee
 */
function SheetDAO_getRowNumber(sheetName, colIndex, keyValue) {
  var rows = SheetDAO_getAllRawData(sheetName);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][colIndex]).toLowerCase() === String(keyValue).toLowerCase()) {
      return i + 2; // +1 pour header, +1 pour index 0-based
    }
  }
  return -1;
}

/**
 * Ajoute une ligne a la fin d'une feuille
 * rowArray est un tableau de valeurs dans l'ordre des colonnes
 */
function SheetDAO_appendRow(sheetName, rowArray) {
  var sheet = SheetDAO_getSheet(sheetName);
  if (!sheet) throw new Error('Feuille non trouvee: ' + sheetName);
  sheet.appendRow(rowArray);
}

/**
 * Met a jour des cellules specifiques d'une ligne
 * rowNumber: 1-based
 * updates: objet {colIndex: value, ...}
 */
function SheetDAO_updateCells(sheetName, rowNumber, updates) {
  var sheet = SheetDAO_getSheet(sheetName);
  if (!sheet) throw new Error('Feuille non trouvee: ' + sheetName);

  var keys = Object.keys(updates);
  for (var i = 0; i < keys.length; i++) {
    var colIndex = parseInt(keys[i]);
    var value = updates[keys[i]];
    sheet.getRange(rowNumber, colIndex + 1).setValue(value); // +1 car getRange est 1-based
  }
}

/**
 * Retourne les valeurs d'une colonne specifique (sans header)
 */
function SheetDAO_getColumnValues(sheetName, colIndex) {
  var rows = SheetDAO_getAllRawData(sheetName);
  var values = [];
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][colIndex] !== '' && rows[i][colIndex] !== null && rows[i][colIndex] !== undefined) {
      values.push(rows[i][colIndex]);
    }
  }
  return values;
}

/**
 * Lit une valeur de configuration depuis la feuille Config
 */
function SheetDAO_getConfigValue(key) {
  var rows = SheetDAO_getAllRawData(SHEET_NAMES.CONFIG);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === key) {
      return String(rows[i][1]);
    }
  }
  return '';
}

/**
 * Ecrit une valeur de configuration dans la feuille Config
 */
function SheetDAO_setConfigValue(key, value) {
  var sheet = SheetDAO_getSheet(SHEET_NAMES.CONFIG);
  if (!sheet) throw new Error('Feuille Config non trouvee');

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  // Si la cle n'existe pas, l'ajouter
  sheet.appendRow([key, value]);
}

/**
 * Vide le cache (utile en cas de modification externe)
 */
function SheetDAO_clearCache() {
  _spreadsheet = null;
  _sheets = {};
}
