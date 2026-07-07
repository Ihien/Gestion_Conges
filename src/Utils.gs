/**
 * Utils.gs - Fonctions utilitaires partagees
 */

/**
 * Genere un identifiant unique (UUID v4)
 */
function generateUUID() {
  return Utilities.getUuid();
}

/**
 * Formate une date au format dd/MM/yyyy
 */
function formatDate(date) {
  if (!date || !(date instanceof Date)) return '';
  return Utilities.formatDate(date, TIMEZONE, 'dd/MM/yyyy');
}

/**
 * Formate une date au format ISO yyyy-MM-dd
 */
function formatDateISO(date) {
  if (!date || !(date instanceof Date)) return '';
  return Utilities.formatDate(date, TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Formate une date et heure au format dd/MM/yyyy HH:mm
 */
function formatDateTime(date) {
  if (!date || !(date instanceof Date)) return '';
  return Utilities.formatDate(date, TIMEZONE, 'dd/MM/yyyy HH:mm');
}

/**
 * Parse une date depuis dd/MM/yyyy ou yyyy-MM-dd
 */
function parseDate(str) {
  if (!str) return null;
  if (str instanceof Date) return str;

  var parts;
  // Format dd/MM/yyyy
  if (str.indexOf('/') !== -1) {
    parts = str.split('/');
    if (parts.length === 3) {
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
  }
  // Format yyyy-MM-dd
  if (str.indexOf('-') !== -1) {
    parts = str.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
  }
  return null;
}

/**
 * Verifie si une date est un weekend (samedi ou dimanche)
 */
function isWeekend(date) {
  var day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Charge les jours feries depuis la feuille Referentiel
 */
function getPublicHolidays() {
  var sheet = SheetDAO_getSheet(SHEET_NAMES.REFERENTIEL);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  var holidays = [];
  var colIndex = HEADERS_REFERENTIEL.indexOf('JOURS_FERIES');

  for (var i = 1; i < data.length; i++) {
    var val = data[i][colIndex];
    if (val instanceof Date) {
      holidays.push(formatDateISO(val));
    } else if (val && typeof val === 'string') {
      var parsed = parseDate(val);
      if (parsed) holidays.push(formatDateISO(parsed));
    }
  }
  return holidays;
}

/**
 * Calcule le nombre de jours ouvres entre deux dates (inclusif)
 * Exclut weekends et jours feries
 */
function calculateBusinessDays(startDate, endDate) {
  if (!startDate || !endDate) return 0;

  var start = new Date(startDate);
  var end = new Date(endDate);

  if (end < start) return 0;

  var holidays = getPublicHolidays();
  var count = 0;
  var current = new Date(start);

  while (current <= end) {
    if (!isWeekend(current)) {
      var isoDate = formatDateISO(current);
      if (holidays.indexOf(isoDate) === -1) {
        count++;
      }
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Valide le format du matricule (M suivi de 4 chiffres)
 */
function validateMatricule(value) {
  return /^M\d{4}$/.test(value);
}

/**
 * Sanitize une chaine : trim + supprime balises HTML
 */
function sanitizeInput(str) {
  if (!str) return '';
  return String(str).replace(/<[^>]*>/g, '').trim();
}

/**
 * Convertit un code statut en label francais lisible
 */
function toFrenchStatusLabel(statusCode) {
  var labels = {};
  labels[STATUS.SOUMIS] = 'Soumis';
  labels[STATUS.APPROUVE_N1] = 'Approuve par le responsable';
  labels[STATUS.REJETE_N1] = 'Rejete par le responsable';
  labels[STATUS.VALIDE] = 'Valide';
  labels[STATUS.REJETE] = 'Rejete par les RH';
  labels[STATUS.ANNULE] = 'Annule';
  return labels[statusCode] || statusCode;
}

/**
 * Convertit un tableau brut (row array) en objet nomme pour Demandes
 */
function buildRequestObject(rowArray) {
  if (!rowArray || rowArray.length === 0) return null;

  // Helper: convert Date objects to ISO strings for safe serialization via google.script.run
  function safeDate(val) {
    if (val instanceof Date) return formatDate(val);
    return val ? String(val) : '';
  }

  return {
    requestId: rowArray[COL_DEMANDES.REQUEST_ID] || '',
    timestamp: safeDate(rowArray[COL_DEMANDES.TIMESTAMP]),
    emailEmp: rowArray[COL_DEMANDES.EMAIL_EMP] || '',
    matricule: rowArray[COL_DEMANDES.MATRICULE] || '',
    nom: rowArray[COL_DEMANDES.NOM] || '',
    prenom: rowArray[COL_DEMANDES.PRENOM] || '',
    poste: rowArray[COL_DEMANDES.POSTE] || '',
    departement: rowArray[COL_DEMANDES.DEPARTEMENT] || '',
    agence: rowArray[COL_DEMANDES.AGENCE] || '',
    typeConge: rowArray[COL_DEMANDES.TYPE_CONGE] || '',
    motif: rowArray[COL_DEMANDES.MOTIF] || '',
    dateDebut: safeDate(rowArray[COL_DEMANDES.DATE_DEBUT]),
    dateFin: safeDate(rowArray[COL_DEMANDES.DATE_FIN]),
    nbJours: Number(rowArray[COL_DEMANDES.NB_JOURS]) || 0,
    managerEmail: rowArray[COL_DEMANDES.MANAGER_EMAIL] || '',
    managerName: rowArray[COL_DEMANDES.MANAGER_NAME] || '',
    statut: rowArray[COL_DEMANDES.STATUT] || '',
    commentManager: rowArray[COL_DEMANDES.COMMENT_MANAGER] || '',
    avisRh: rowArray[COL_DEMANDES.AVIS_RH] || '',
    commentRh: rowArray[COL_DEMANDES.COMMENT_RH] || '',
    commentValidateur: rowArray[COL_DEMANDES.COMMENT_VALIDATEUR] || '',
    dateSubmit: safeDate(rowArray[COL_DEMANDES.DATE_SUBMIT]),
    dateApprobation: safeDate(rowArray[COL_DEMANDES.DATE_APPROBATION]),
    dateAvisRh: safeDate(rowArray[COL_DEMANDES.DATE_AVIS_RH]),
    dateDecisionFinale: safeDate(rowArray[COL_DEMANDES.DATE_DECISION_FINALE]),
    pdfUrl: rowArray[COL_DEMANDES.PDF_URL] || '',
    validateurFinalEmail: rowArray[COL_DEMANDES.VALIDATEUR_FINAL_EMAIL] || ''
  };
}

/**
 * Convertit un tableau brut en objet nomme pour Employes
 */
function buildEmployeeObject(rowArray) {
  if (!rowArray || rowArray.length === 0) return null;

  return {
    email: rowArray[COL_EMPLOYES.EMAIL] || '',
    matricule: rowArray[COL_EMPLOYES.MATRICULE] || '',
    nom: rowArray[COL_EMPLOYES.NOM] || '',
    prenom: rowArray[COL_EMPLOYES.PRENOM] || '',
    poste: rowArray[COL_EMPLOYES.POSTE] || '',
    departement: rowArray[COL_EMPLOYES.DEPARTEMENT] || '',
    agence: rowArray[COL_EMPLOYES.AGENCE] || '',
    managerEmail: rowArray[COL_EMPLOYES.MANAGER_EMAIL] || '',
    role: rowArray[COL_EMPLOYES.ROLE] || '',
    soldeConges: Number(rowArray[COL_EMPLOYES.SOLDE_CONGES]) || 0,
    soldeInitial: Number(rowArray[COL_EMPLOYES.SOLDE_INITIAL]) || 0,
    actif: rowArray[COL_EMPLOYES.ACTIF] === true || rowArray[COL_EMPLOYES.ACTIF] === 'TRUE' || rowArray[COL_EMPLOYES.ACTIF] === 'Oui'
  };
}

/**
 * Pad un mois sur 2 chiffres
 */
function padMonth(month) {
  return month < 10 ? '0' + month : String(month);
}
