/**
 * Config.gs - Constantes globales, noms de feuilles, indices de colonnes, enums
 * Toutes les "magic strings" sont centralisees ici.
 */

// ===== NOMS DES FEUILLES =====
var SHEET_NAMES = {
  DEMANDES: 'Demandes',
  EMPLOYES: 'Employes',
  REFERENTIEL: 'Referentiel',
  AUDIT: 'JournalAudit',
  CONFIG: 'Config'
};

// ===== COLONNES FEUILLE DEMANDES (indices zero-based) =====
var COL_DEMANDES = {
  REQUEST_ID: 0,
  TIMESTAMP: 1,
  EMAIL_EMP: 2,
  MATRICULE: 3,
  NOM: 4,
  PRENOM: 5,
  POSTE: 6,
  DEPARTEMENT: 7,
  AGENCE: 8,
  TYPE_CONGE: 9,
  MOTIF: 10,
  DATE_DEBUT: 11,
  DATE_FIN: 12,
  NB_JOURS: 13,
  MANAGER_EMAIL: 14,
  MANAGER_NAME: 15,
  STATUT: 16,
  COMMENT_MANAGER: 17,
  AVIS_RH: 18,
  COMMENT_RH: 19,
  COMMENT_VALIDATEUR: 20,
  DATE_SUBMIT: 21,
  DATE_APPROBATION: 22,
  DATE_AVIS_RH: 23,
  DATE_DECISION_FINALE: 24,
  PDF_URL: 25,
  VALIDATEUR_FINAL_EMAIL: 26
};

// ===== HEADERS FEUILLE DEMANDES =====
var HEADERS_DEMANDES = [
  'REQUEST_ID', 'TIMESTAMP', 'EMAIL_EMP', 'MATRICULE', 'NOM', 'PRENOM',
  'POSTE', 'DEPARTEMENT', 'AGENCE', 'TYPE_CONGE', 'MOTIF',
  'DATE_DEBUT', 'DATE_FIN', 'NB_JOURS', 'MANAGER_EMAIL', 'MANAGER_NAME',
  'STATUT', 'COMMENT_MANAGER', 'AVIS_RH', 'COMMENT_RH', 'COMMENT_VALIDATEUR',
  'DATE_SUBMIT', 'DATE_APPROBATION', 'DATE_AVIS_RH', 'DATE_DECISION_FINALE',
  'PDF_URL', 'VALIDATEUR_FINAL_EMAIL'
];

// ===== COLONNES FEUILLE EMPLOYES (indices zero-based) =====
var COL_EMPLOYES = {
  EMAIL: 0,
  MATRICULE: 1,
  NOM: 2,
  PRENOM: 3,
  POSTE: 4,
  DEPARTEMENT: 5,
  AGENCE: 6,
  MANAGER_EMAIL: 7,
  ROLE: 8,
  SOLDE_CONGES: 9,
  SOLDE_INITIAL: 10,
  ACTIF: 11
};

// ===== HEADERS FEUILLE EMPLOYES =====
var HEADERS_EMPLOYES = [
  'EMAIL', 'MATRICULE', 'NOM', 'PRENOM', 'POSTE', 'DEPARTEMENT',
  'AGENCE', 'MANAGER_EMAIL', 'ROLE', 'SOLDE_CONGES', 'SOLDE_INITIAL', 'ACTIF'
];

// ===== HEADERS FEUILLE REFERENTIEL =====
var HEADERS_REFERENTIEL = ['DEPARTEMENTS', 'AGENCES', 'TYPES_CONGE', 'JOURS_FERIES'];

// ===== HEADERS FEUILLE AUDIT =====
var HEADERS_AUDIT = [
  'TIMESTAMP', 'USER_EMAIL', 'USER_ROLE', 'REQUEST_ID',
  'ACTION', 'ANCIEN_STATUT', 'NOUVEAU_STATUT', 'COMMENTAIRE'
];

// ===== HEADERS FEUILLE CONFIG =====
var HEADERS_CONFIG = ['CLE', 'VALEUR'];

// ===== STATUTS =====
var STATUS = {
  SOUMIS: 'Soumis',
  APPROUVE_N1: 'Approuve N1',
  REJETE_N1: 'Rejete N1',
  AVIS_RH_FAVORABLE: 'Avis RH Favorable',
  AVIS_RH_DEFAVORABLE: 'Avis RH Defavorable',
  VALIDE: 'Valide',
  REJETE_FINAL: 'Rejete Final',
  ANNULE: 'Annule'
};

// Statuts terminaux (pas de transition possible)
var TERMINAL_STATUSES = [STATUS.REJETE_N1, STATUS.VALIDE, STATUS.REJETE_FINAL, STATUS.ANNULE];

// ===== ROLES =====
var ROLES = {
  EMPLOYE: 'EMPLOYE',
  CHEF_AGENCE: 'CHEF_AGENCE',
  CHEF_AGENCE_SENIOR: 'CHEF_AGENCE_SENIOR',
  CHEF_DEPARTEMENT: 'CHEF_DEPARTEMENT',
  RH: 'RH',
  DIRECTEUR_CLIENTELE: 'DIRECTEUR_CLIENTELE',
  DIRECTEUR_GENERAL: 'DIRECTEUR_GENERAL'
};

// ===== TYPES DE CONGE =====
var LEAVE_TYPES = {
  PAID: 'Conges payes',
  EXCEPTIONAL: 'Absence exceptionnelle'
};

// ===== ACTIONS =====
var ACTIONS = {
  SUBMIT: 'SUBMIT',
  APPROVE_N1: 'APPROVE_N1',
  REJECT_N1: 'REJECT_N1',
  AVIS_FAVORABLE: 'AVIS_FAVORABLE',
  AVIS_DEFAVORABLE: 'AVIS_DEFAVORABLE',
  VALIDER: 'VALIDER',
  REJETER_FINAL: 'REJETER_FINAL',
  ANNULER: 'ANNULER'
};

// ===== DEPARTEMENTS =====
var DEPARTEMENTS = [
  'Direction Generale',
  'Ressources Humaines',
  'Juridique et Conformite',
  'Moyens Generaux',
  'Risque et Controle Permanent',
  'Informatique',
  'Developpement et Innovation',
  'Direction Clientele',
  'Direction Administrative et Financiere',
  'Audit Interne',
  'Recouvrement',
  'Marketing et Communication',
  'Qualite',
  'Canaux Alternatifs'
];

// ===== AGENCES =====
var AGENCES = [
  'Agence 1', 'Agence 2', 'Agence 3', 'Agence 4', 'Agence 5',
  'Agence 6', 'Agence 7', 'Agence 8', 'Agence 9', 'Agence 10',
  'Agence 11', 'Agence 12', 'Agence 13', 'Agence 14', 'Agence 15'
];

// ===== CONFIG DEFAULTS =====
var DEFAULT_CONFIG = {
  SOLDE_ANNUEL_DEFAUT: '30',
  NOM_INSTITUTION: 'Microfinance SA',
  WEBAPP_URL: '',
  PDF_TEMPLATE_DOC_ID: '',
  ARCHIVE_FOLDER_ID: '',
  HR_EMAILS: '',
  AUDIT_EMAILS: '',
  DIR_CLIENTELE_EMAIL: '',
  DIR_GENERAL_EMAIL: ''
};

// ===== TIMEZONE =====
var TIMEZONE = 'Africa/Douala';
