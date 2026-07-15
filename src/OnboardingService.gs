/**
 * OnboardingService.gs - Gestion de l'integration des nouveaux collaborateurs
 * Checklist d'onboarding, suivi des etapes, notifications
 */

/**
 * Initialise l'onboarding pour un nouvel employe
 * Cree toutes les etapes par defaut avec le statut "A faire"
 */
function OnboardingService_initiate(emailEmp, creatorEmail) {
  var emp = SheetDAO_getRowByKey(SHEET_NAMES.EMPLOYES, COL_EMPLOYES.EMAIL, emailEmp);
  if (!emp) throw new Error('Employe non trouve: ' + emailEmp);

  var existing = SheetDAO_getRowsByKey(SHEET_NAMES_SIRH.ONBOARDING, COL_ONBOARDING.EMAIL_EMP, emailEmp);
  if (existing && existing.length > 0) throw new Error('L\'onboarding est deja en cours pour cet employe.');

  var now = new Date();
  var echeance30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  for (var i = 0; i < DEFAULT_ONBOARDING_STEPS.length; i++) {
    var step = DEFAULT_ONBOARDING_STEPS[i];
    var row = [];
    row[COL_ONBOARDING.ONBOARDING_ID] = generateUUID();
    row[COL_ONBOARDING.EMAIL_EMP] = emailEmp;
    row[COL_ONBOARDING.ETAPE_KEY] = step.key;
    row[COL_ONBOARDING.ETAPE_LABEL] = step.label;
    row[COL_ONBOARDING.STATUT] = ONBOARDING_STATUS.A_FAIRE;
    row[COL_ONBOARDING.DATE_ECHEANCE] = echeance30;
    row[COL_ONBOARDING.DATE_COMPLETION] = '';
    row[COL_ONBOARDING.RESPONSABLE_EMAIL] = creatorEmail;
    row[COL_ONBOARDING.COMMENTAIRE] = '';
    row[COL_ONBOARDING.CREATED_AT] = now;
    SheetDAO_appendRow(SHEET_NAMES_SIRH.ONBOARDING, row);
  }

  SheetDAO_appendRow(SHEET_NAMES.AUDIT, [
    now, creatorEmail, 'RH', '', 'ONBOARDING_INITIATED', '', '',
    'Onboarding initie pour ' + emailEmp
  ]);

  return { success: true, steps: DEFAULT_ONBOARDING_STEPS.length };
}

/**
 * Retourne les etapes d'onboarding d'un employe
 */
function OnboardingService_getSteps(emailEmp) {
  var rows = SheetDAO_getRowsByKey(SHEET_NAMES_SIRH.ONBOARDING, COL_ONBOARDING.EMAIL_EMP, emailEmp);
  var results = [];

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    results.push({
      onboardingId: r[COL_ONBOARDING.ONBOARDING_ID] || '',
      emailEmp: r[COL_ONBOARDING.EMAIL_EMP] || '',
      etapeKey: r[COL_ONBOARDING.ETAPE_KEY] || '',
      etapeLabel: r[COL_ONBOARDING.ETAPE_LABEL] || '',
      statut: r[COL_ONBOARDING.STATUT] || '',
      dateEcheance: r[COL_ONBOARDING.DATE_ECHEANCE] instanceof Date ? formatDate(r[COL_ONBOARDING.DATE_ECHEANCE]) : String(r[COL_ONBOARDING.DATE_ECHEANCE] || ''),
      dateCompletion: r[COL_ONBOARDING.DATE_COMPLETION] instanceof Date ? formatDate(r[COL_ONBOARDING.DATE_COMPLETION]) : String(r[COL_ONBOARDING.DATE_COMPLETION] || ''),
      responsableEmail: r[COL_ONBOARDING.RESPONSABLE_EMAIL] || '',
      commentaire: r[COL_ONBOARDING.COMMENTAIRE] || ''
    });
  }

  return results;
}

/**
 * Met a jour le statut d'une etape d'onboarding
 */
function OnboardingService_updateStep(onboardingId, newStatut, comment, actorEmail) {
  var sheet = SheetDAO_getSheet(SHEET_NAMES_SIRH.ONBOARDING);
  if (!sheet) throw new Error('Feuille Onboarding non trouvee.');

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][COL_ONBOARDING.ONBOARDING_ID] === onboardingId) {
      var rowNumber = i + 1;
      var updates = {};
      updates[COL_ONBOARDING.STATUT] = newStatut;
      if (comment) updates[COL_ONBOARDING.COMMENTAIRE] = comment;
      if (newStatut === ONBOARDING_STATUS.FAIT) {
        updates[COL_ONBOARDING.DATE_COMPLETION] = new Date();
      }
      SheetDAO_updateCells(SHEET_NAMES_SIRH.ONBOARDING, rowNumber, updates);
      return { success: true };
    }
  }
  throw new Error('Etape d\'onboarding non trouvee.');
}

/**
 * Retourne la liste des onboardings en cours (vue RH)
 */
function OnboardingService_getActiveOnboardings() {
  var allRows = SheetDAO_getAllRawData(SHEET_NAMES_SIRH.ONBOARDING);
  var empMap = {};

  for (var i = 0; i < allRows.length; i++) {
    var email = allRows[i][COL_ONBOARDING.EMAIL_EMP];
    if (!email) continue;
    if (!empMap[email]) {
      empMap[email] = { email: email, total: 0, fait: 0, enCours: 0, aFaire: 0 };
    }
    empMap[email].total++;
    var statut = allRows[i][COL_ONBOARDING.STATUT];
    if (statut === ONBOARDING_STATUS.FAIT) empMap[email].fait++;
    else if (statut === ONBOARDING_STATUS.EN_COURS) empMap[email].enCours++;
    else empMap[email].aFaire++;
  }

  var empData = SheetDAO_getAllRawData(SHEET_NAMES.EMPLOYES);
  var results = [];
  var emails = Object.keys(empMap);

  for (var j = 0; j < emails.length; j++) {
    var entry = empMap[emails[j]];
    if (entry.fait === entry.total) continue;

    for (var k = 0; k < empData.length; k++) {
      if (String(empData[k][COL_EMPLOYES.EMAIL]).toLowerCase() === emails[j].toLowerCase()) {
        entry.nom = empData[k][COL_EMPLOYES.NOM] || '';
        entry.prenom = empData[k][COL_EMPLOYES.PRENOM] || '';
        entry.poste = empData[k][COL_EMPLOYES.POSTE] || '';
        entry.departement = empData[k][COL_EMPLOYES.DEPARTEMENT] || '';
        break;
      }
    }
    entry.progression = Math.round((entry.fait / entry.total) * 100);
    results.push(entry);
  }

  results.sort(function(a, b) { return a.progression - b.progression; });
  return results;
}
