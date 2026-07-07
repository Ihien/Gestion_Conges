/**
 * LeaveService.gs - Logique metier pour les demandes de conge
 */

/**
 * Soumet une nouvelle demande de conge
 */
function LeaveService_submitRequest(formData, userProfile) {
  // Validation serveur
  var matricule = sanitizeInput(formData.matricule);
  if (!validateMatricule(matricule)) {
    throw new Error('Matricule invalide. Format attendu : M suivi de 4 chiffres.');
  }

  var typeConge = sanitizeInput(formData.typeConge);
  if (typeConge !== LEAVE_TYPES.PAID && typeConge !== LEAVE_TYPES.EXCEPTIONAL) {
    throw new Error('Type de conge invalide.');
  }

  var motif = sanitizeInput(formData.motif || '');
  if (typeConge === LEAVE_TYPES.EXCEPTIONAL && !motif) {
    throw new Error('Le motif est obligatoire pour une absence exceptionnelle.');
  }

  var dateDebut = parseDate(formData.dateDebut);
  var dateFin = parseDate(formData.dateFin);

  if (!dateDebut || !dateFin) {
    throw new Error('Les dates sont obligatoires.');
  }

  if (dateFin < dateDebut) {
    throw new Error('La date de fin doit etre egale ou posterieure a la date de debut.');
  }

  var nbJours = calculateBusinessDays(dateDebut, dateFin);
  if (nbJours <= 0) {
    throw new Error('Le nombre de jours ouvres doit etre superieur a 0.');
  }

  // Verifier le solde pour les conges payes
  if (typeConge === LEAVE_TYPES.PAID) {
    var solde = LeaveCounter_getBalance(userProfile.email);
    if (nbJours > solde) {
      throw new Error('Solde insuffisant. Solde actuel : ' + solde + ' jours. Demande : ' + nbJours + ' jours.');
    }
  }

  // Lookup manager
  var managerEmail = userProfile.managerEmail;
  var managerName = '';
  if (managerEmail) {
    var managerRow = SheetDAO_getRowByKey(SHEET_NAMES.EMPLOYES, COL_EMPLOYES.EMAIL, managerEmail);
    if (managerRow) {
      var managerProfile = buildEmployeeObject(managerRow);
      managerName = managerProfile.prenom + ' ' + managerProfile.nom;
    }
  }

  // Generer l'ID de la demande
  var requestId = generateUUID();
  var now = new Date();

  // Construire la ligne
  var row = [];
  row[COL_DEMANDES.REQUEST_ID] = requestId;
  row[COL_DEMANDES.TIMESTAMP] = now;
  row[COL_DEMANDES.EMAIL_EMP] = userProfile.email;
  row[COL_DEMANDES.MATRICULE] = matricule;
  row[COL_DEMANDES.NOM] = sanitizeInput(formData.nom || userProfile.nom);
  row[COL_DEMANDES.PRENOM] = sanitizeInput(formData.prenom || userProfile.prenom);
  row[COL_DEMANDES.POSTE] = sanitizeInput(formData.poste || userProfile.poste);
  row[COL_DEMANDES.DEPARTEMENT] = sanitizeInput(formData.departement || userProfile.departement);
  row[COL_DEMANDES.AGENCE] = sanitizeInput(formData.agence || userProfile.agence || '');
  row[COL_DEMANDES.TYPE_CONGE] = typeConge;
  row[COL_DEMANDES.MOTIF] = motif;
  row[COL_DEMANDES.DATE_DEBUT] = dateDebut;
  row[COL_DEMANDES.DATE_FIN] = dateFin;
  row[COL_DEMANDES.NB_JOURS] = nbJours;
  row[COL_DEMANDES.MANAGER_EMAIL] = managerEmail || '';
  row[COL_DEMANDES.MANAGER_NAME] = managerName;
  row[COL_DEMANDES.STATUT] = STATUS.SOUMIS;
  row[COL_DEMANDES.COMMENT_MANAGER] = '';
  row[COL_DEMANDES.DATE_APPROBATION] = '';
  row[COL_DEMANDES.AVIS_RH] = '';
  row[COL_DEMANDES.COMMENT_RH] = '';
  row[COL_DEMANDES.COMMENT_VALIDATEUR] = '';
  row[COL_DEMANDES.DATE_SUBMIT] = now;
  row[COL_DEMANDES.DATE_AVIS_RH] = '';
  row[COL_DEMANDES.DATE_DECISION_FINALE] = '';
  row[COL_DEMANDES.PDF_URL] = '';
  row[COL_DEMANDES.VALIDATEUR_FINAL_EMAIL] = '';

  // Sauvegarder
  SheetDAO_appendRow(SHEET_NAMES.DEMANDES, row);

  // Journal d'audit
  var auditRow = [
    now,
    userProfile.email,
    userProfile.role,
    requestId,
    ACTIONS.SUBMIT,
    '',
    STATUS.SOUMIS,
    'Demande soumise'
  ];
  SheetDAO_appendRow(SHEET_NAMES.AUDIT, auditRow);

  // Notification : employe + manager (quel que soit le role du manager)
  try {
    NotificationService_onSubmit(buildRequestObject(row), userProfile);
  } catch (e) {
    console.error('Erreur notification soumission: ' + e.message);
  }

  return { success: true, requestId: requestId };
}

/**
 * Retourne les demandes de l'utilisateur connecte
 */
function LeaveService_getMyRequests(userProfile) {
  var allRows = SheetDAO_getAllRawData(SHEET_NAMES.DEMANDES);
  var results = [];

  for (var i = 0; i < allRows.length; i++) {
    if (String(allRows[i][COL_DEMANDES.EMAIL_EMP]).toLowerCase() === userProfile.email.toLowerCase()) {
      results.push(buildRequestObject(allRows[i]));
    }
  }

  // Trier par date de soumission descendante
  results.sort(function(a, b) {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  return results;
}

/**
 * Retourne les demandes de l'equipe (pour managers et RH)
 */
function LeaveService_getTeamRequests(userProfile) {
  var allRows = SheetDAO_getAllRawData(SHEET_NAMES.DEMANDES);
  var results = [];

  for (var i = 0; i < allRows.length; i++) {
    if (canViewRequest(allRows[i], userProfile) &&
        String(allRows[i][COL_DEMANDES.EMAIL_EMP]).toLowerCase() !== userProfile.email.toLowerCase()) {
      results.push(buildRequestObject(allRows[i]));
    }
  }

  results.sort(function(a, b) {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  return results;
}

/**
 * Retourne toutes les demandes (RH, Directeurs)
 */
function LeaveService_getAllRequests(userProfile) {
  var allRows = SheetDAO_getAllRawData(SHEET_NAMES.DEMANDES);
  var results = [];

  for (var i = 0; i < allRows.length; i++) {
    results.push(buildRequestObject(allRows[i]));
  }

  results.sort(function(a, b) {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  return results;
}

/**
 * Retourne les demandes en attente d'action de l'utilisateur
 */
function LeaveService_getPendingForMe(userProfile) {
  var allRows = SheetDAO_getAllRawData(SHEET_NAMES.DEMANDES);
  var results = [];

  for (var i = 0; i < allRows.length; i++) {
    var actions = getAvailableActions(allRows[i], userProfile);
    if (actions.length > 0) {
      var req = buildRequestObject(allRows[i]);
      req.availableActions = actions;
      results.push(req);
    }
  }

  return results;
}

/**
 * Retourne le detail d'une demande par son ID
 */
function LeaveService_getRequestById(requestId, userProfile) {
  var row = SheetDAO_getRowByKey(SHEET_NAMES.DEMANDES, COL_DEMANDES.REQUEST_ID, requestId);
  if (!row) {
    throw new Error('Demande non trouvee: ' + requestId);
  }

  if (!canViewRequest(row, userProfile)) {
    throw new Error('Acces refuse a cette demande.');
  }

  var request = buildRequestObject(row);
  request.availableActions = getAvailableActions(row, userProfile);

  return request;
}

/**
 * Retourne la liste des employes (admin)
 */
function LeaveService_getEmployeeList() {
  var allRows = SheetDAO_getAllRawData(SHEET_NAMES.EMPLOYES);
  var results = [];

  for (var i = 0; i < allRows.length; i++) {
    results.push(buildEmployeeObject(allRows[i]));
  }

  return results;
}

/**
 * Met a jour un employe (admin)
 */
function LeaveService_updateEmployee(data) {
  if (!data || !data.email) {
    throw new Error('Email employe requis.');
  }

  var rowNumber = SheetDAO_getRowNumber(SHEET_NAMES.EMPLOYES, COL_EMPLOYES.EMAIL, data.email);
  if (rowNumber === -1) {
    throw new Error('Employe non trouve: ' + data.email);
  }

  var updates = {};
  if (data.role !== undefined) updates[COL_EMPLOYES.ROLE] = data.role;
  if (data.departement !== undefined) updates[COL_EMPLOYES.DEPARTEMENT] = data.departement;
  if (data.agence !== undefined) updates[COL_EMPLOYES.AGENCE] = data.agence;
  if (data.managerEmail !== undefined) updates[COL_EMPLOYES.MANAGER_EMAIL] = data.managerEmail;
  if (data.soldeConges !== undefined) updates[COL_EMPLOYES.SOLDE_CONGES] = parseInt(data.soldeConges);
  if (data.actif !== undefined) updates[COL_EMPLOYES.ACTIF] = data.actif;

  SheetDAO_updateCells(SHEET_NAMES.EMPLOYES, rowNumber, updates);

  return { success: true };
}
