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
  ACTIF: 11,
  DATE_NAISSANCE: 12,
  LIEU_NAISSANCE: 13,
  NATIONALITE: 14,
  NUM_CNI: 15,
  SITUATION_FAMILIALE: 16,
  NB_ENFANTS: 17,
  TELEPHONE: 18,
  TELEPHONE_PRO: 19,
  ADRESSE: 20,
  CONTACT_URGENCE_NOM: 21,
  CONTACT_URGENCE_TEL: 22,
  CONTACT_URGENCE_LIEN: 23,
  TYPE_CONTRAT: 24,
  DATE_EMBAUCHE: 25,
  DATE_FIN_CONTRAT: 26,
  DATE_FIN_ESSAI: 27,
  PHOTO_URL: 28
};

// ===== HEADERS FEUILLE EMPLOYES =====
var HEADERS_EMPLOYES = [
  'EMAIL', 'MATRICULE', 'NOM', 'PRENOM', 'POSTE', 'DEPARTEMENT',
  'AGENCE', 'MANAGER_EMAIL', 'ROLE', 'SOLDE_CONGES', 'SOLDE_INITIAL', 'ACTIF',
  'DATE_NAISSANCE', 'LIEU_NAISSANCE', 'NATIONALITE', 'NUM_CNI',
  'SITUATION_FAMILIALE', 'NB_ENFANTS', 'TELEPHONE', 'TELEPHONE_PRO', 'ADRESSE',
  'CONTACT_URGENCE_NOM', 'CONTACT_URGENCE_TEL', 'CONTACT_URGENCE_LIEN',
  'TYPE_CONTRAT', 'DATE_EMBAUCHE', 'DATE_FIN_CONTRAT', 'DATE_FIN_ESSAI', 'PHOTO_URL'
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
  VALIDE: 'Valide',
  REJETE: 'Rejete',
  ANNULE: 'Annule'
};

// Statuts terminaux (pas de transition possible)
var TERMINAL_STATUSES = [STATUS.REJETE_N1, STATUS.VALIDE, STATUS.REJETE, STATUS.ANNULE];

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
  EXCEPTIONAL: 'Absence exceptionnelle',
  MATERNITY: 'Conge maternite',
  PATERNITY: 'Conge paternite',
  SICK: 'Conge maladie',
  UNPAID: 'Conge sans solde',
  PERMISSION: 'Permission speciale'
};

// Types qui deduisent le solde de conges payes
var LEAVE_TYPES_DEDUCT_BALANCE = [LEAVE_TYPES.PAID];

// Types qui necessitent un justificatif/motif obligatoire
var LEAVE_TYPES_REQUIRE_MOTIF = [
  LEAVE_TYPES.EXCEPTIONAL, LEAVE_TYPES.SICK,
  LEAVE_TYPES.UNPAID, LEAVE_TYPES.PERMISSION
];

// Durees maximales par type (en jours ouvres, 0 = pas de limite)
var LEAVE_TYPE_MAX_DAYS = {};
LEAVE_TYPE_MAX_DAYS[LEAVE_TYPES.MATERNITY] = 98;
LEAVE_TYPE_MAX_DAYS[LEAVE_TYPES.PATERNITY] = 10;
LEAVE_TYPE_MAX_DAYS[LEAVE_TYPES.PERMISSION] = 10;

// ===== TYPES DE CONTRAT =====
var CONTRACT_TYPES = ['CDI', 'CDD', 'Stage'];

// ===== SITUATIONS FAMILIALES =====
var SITUATIONS_FAMILIALES = ['Celibataire', 'Marie(e)', 'Divorce(e)', 'Veuf(ve)'];

// ===== ACTIONS =====
var ACTIONS = {
  SUBMIT: 'SUBMIT',
  APPROVE_N1: 'APPROVE_N1',
  REJECT_N1: 'REJECT_N1',
  AVIS_FAVORABLE: 'AVIS_FAVORABLE',
  AVIS_DEFAVORABLE: 'AVIS_DEFAVORABLE',
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

// ===== NOMS FEUILLES SUPPLEMENTAIRES (SIRH) =====
var SHEET_NAMES_SIRH = {
  MOUVEMENTS: 'Mouvements',
  DOCUMENTS_RH: 'DocumentsRH',
  ONBOARDING: 'Onboarding',
  CONTRATS: 'Contrats'
};

// ===== COLONNES FEUILLE MOUVEMENTS =====
var COL_MOUVEMENTS = {
  MOUVEMENT_ID: 0,
  DATE_MOUVEMENT: 1,
  EMAIL_EMP: 2,
  TYPE: 3,
  ANCIEN_POSTE: 4,
  NOUVEAU_POSTE: 5,
  ANCIEN_DEPT: 6,
  NOUVEAU_DEPT: 7,
  ANCIENNE_AGENCE: 8,
  NOUVELLE_AGENCE: 9,
  MOTIF: 10,
  DOCUMENT_URL: 11,
  CREATED_BY: 12,
  DATE_EFFET: 13
};

var HEADERS_MOUVEMENTS = [
  'MOUVEMENT_ID', 'DATE_MOUVEMENT', 'EMAIL_EMP', 'TYPE',
  'ANCIEN_POSTE', 'NOUVEAU_POSTE', 'ANCIEN_DEPT', 'NOUVEAU_DEPT',
  'ANCIENNE_AGENCE', 'NOUVELLE_AGENCE', 'MOTIF', 'DOCUMENT_URL',
  'CREATED_BY', 'DATE_EFFET'
];

var MOUVEMENT_TYPES = ['Embauche', 'Promotion', 'Mutation', 'Renouvellement', 'Titularisation', 'Depart'];

// ===== COLONNES FEUILLE ONBOARDING =====
var COL_ONBOARDING = {
  ONBOARDING_ID: 0,
  EMAIL_EMP: 1,
  ETAPE_KEY: 2,
  ETAPE_LABEL: 3,
  STATUT: 4,
  DATE_ECHEANCE: 5,
  DATE_COMPLETION: 6,
  RESPONSABLE_EMAIL: 7,
  COMMENTAIRE: 8,
  CREATED_AT: 9
};

var HEADERS_ONBOARDING = [
  'ONBOARDING_ID', 'EMAIL_EMP', 'ETAPE_KEY', 'ETAPE_LABEL',
  'STATUT', 'DATE_ECHEANCE', 'DATE_COMPLETION', 'RESPONSABLE_EMAIL',
  'COMMENTAIRE', 'CREATED_AT'
];

var ONBOARDING_STATUS = {
  A_FAIRE: 'A faire',
  EN_COURS: 'En cours',
  FAIT: 'Fait'
};

var DEFAULT_ONBOARDING_STEPS = [
  { key: 'DOSSIER_ADMIN', label: 'Dossier administratif complet' },
  { key: 'CONTRAT_SIGNE', label: 'Contrat signe' },
  { key: 'VISITE_MEDICALE', label: 'Visite medicale' },
  { key: 'COMPTE_EMAIL', label: 'Creation compte email' },
  { key: 'MATERIEL_INFO', label: 'Attribution materiel informatique' },
  { key: 'BADGE_ACCES', label: 'Remise badge d\'acces' },
  { key: 'PRESENTATION_EQUIPE', label: 'Presentation a l\'equipe' },
  { key: 'FORMATION_SECURITE', label: 'Formation securite' },
  { key: 'FORMATION_OUTILS', label: 'Formation outils internes' },
  { key: 'ACCES_SIRH', label: 'Ouverture acces SIRH' }
];

// ===== COLONNES FEUILLE CONTRATS =====
var COL_CONTRATS = {
  CONTRAT_ID: 0,
  EMAIL_EMP: 1,
  TYPE_CONTRAT: 2,
  DATE_DEBUT: 3,
  DATE_FIN: 4,
  DUREE_MOIS: 5,
  PERIODE_ESSAI_FIN: 6,
  STATUT: 7,
  MOTIF_FIN: 8,
  DOCUMENT_URL: 9,
  RENOUVELE_PAR: 10,
  CREATED_BY: 11,
  CREATED_AT: 12
};

var HEADERS_CONTRATS = [
  'CONTRAT_ID', 'EMAIL_EMP', 'TYPE_CONTRAT', 'DATE_DEBUT', 'DATE_FIN',
  'DUREE_MOIS', 'PERIODE_ESSAI_FIN', 'STATUT', 'MOTIF_FIN',
  'DOCUMENT_URL', 'RENOUVELE_PAR', 'CREATED_BY', 'CREATED_AT'
];

var CONTRACT_STATUS = {
  ACTIF: 'Actif',
  EXPIRE: 'Expire',
  RENOUVELE: 'Renouvele',
  RESILIE: 'Resilie'
};

// ===== COLONNES FEUILLE DOCUMENTS RH =====
var COL_DOCUMENTS_RH = {
  DOCUMENT_ID: 0,
  EMAIL_EMP: 1,
  TYPE_DOCUMENT: 2,
  DATE_GENERATION: 3,
  GENERE_PAR: 4,
  DOCUMENT_URL: 5,
  NOTES: 6
};

var HEADERS_DOCUMENTS_RH = [
  'DOCUMENT_ID', 'EMAIL_EMP', 'TYPE_DOCUMENT',
  'DATE_GENERATION', 'GENERE_PAR', 'DOCUMENT_URL', 'NOTES'
];

var DOCUMENT_TYPES = [
  'Attestation de travail',
  'Certificat de travail',
  'Attestation de stage',
  'Attestation de presence'
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
  CALENDAR_SYNC_ENABLED: 'true',
  HEURE_REFERENCE: '08:00'
};

// ===== TIMEZONE =====
var TIMEZONE = 'Africa/Douala';
