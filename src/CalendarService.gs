/**
 * CalendarService.gs - Synchronisation Google Calendar
 * Cree des evenements journee entiere pour les conges valides
 */

/**
 * Cree un evenement conge dans le calendrier du collaborateur
 */
function CalendarService_createLeaveEvent(requestData) {
  var syncEnabled = SheetDAO_getConfigValue('CALENDAR_SYNC_ENABLED');
  if (syncEnabled === 'false') return null;

  try {
    var calendar = CalendarApp.getCalendarById(requestData.emailEmp);
    if (!calendar) {
      calendar = CalendarApp.getDefaultCalendar();
    }

    var startDate = parseDate(requestData.dateDebut);
    var endDate = parseDate(requestData.dateFin);
    if (!startDate || !endDate) return null;

    var endDatePlusOne = new Date(endDate);
    endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);

    var title = requestData.typeConge + ' - ' + requestData.prenom + ' ' + requestData.nom;
    var event = calendar.createAllDayEvent(title, startDate, endDatePlusOne, {
      description: 'Demande de conge validee\n' +
        'Type: ' + requestData.typeConge + '\n' +
        'Jours: ' + requestData.nbJours + '\n' +
        'Reference: ' + requestData.requestId
    });

    return event.getId();
  } catch (e) {
    console.error('CalendarService: erreur creation evenement: ' + e.message);
    return null;
  }
}

/**
 * Supprime un evenement conge (en cas d'annulation)
 */
function CalendarService_deleteLeaveEvent(emailEmp, eventId) {
  if (!eventId) return;
  try {
    var calendar = CalendarApp.getCalendarById(emailEmp);
    if (!calendar) calendar = CalendarApp.getDefaultCalendar();
    var event = calendar.getEventById(eventId);
    if (event) event.deleteEvent();
  } catch (e) {
    console.error('CalendarService: erreur suppression evenement: ' + e.message);
  }
}

/**
 * Retourne les absences de l'equipe pour un mois donne (calendrier d'equipe)
 */
function CalendarService_getTeamAbsences(userProfile, year, month) {
  var allRows = SheetDAO_getAllRawData(SHEET_NAMES.DEMANDES);
  var results = [];

  var startOfMonth = new Date(year, month - 1, 1);
  var endOfMonth = new Date(year, month, 0);

  for (var i = 0; i < allRows.length; i++) {
    var statut = allRows[i][COL_DEMANDES.STATUT];
    if (statut !== STATUS.VALIDE && statut !== STATUS.APPROUVE_N1) continue;

    if (!canViewRequest(allRows[i], userProfile)) continue;

    var dateDebut = allRows[i][COL_DEMANDES.DATE_DEBUT];
    var dateFin = allRows[i][COL_DEMANDES.DATE_FIN];
    if (dateDebut instanceof Date) dateDebut = dateDebut;
    else dateDebut = parseDate(String(dateDebut));
    if (dateFin instanceof Date) dateFin = dateFin;
    else dateFin = parseDate(String(dateFin));

    if (!dateDebut || !dateFin) continue;
    if (dateFin < startOfMonth || dateDebut > endOfMonth) continue;

    results.push({
      nom: allRows[i][COL_DEMANDES.NOM] || '',
      prenom: allRows[i][COL_DEMANDES.PRENOM] || '',
      matricule: allRows[i][COL_DEMANDES.MATRICULE] || '',
      departement: allRows[i][COL_DEMANDES.DEPARTEMENT] || '',
      agence: allRows[i][COL_DEMANDES.AGENCE] || '',
      typeConge: allRows[i][COL_DEMANDES.TYPE_CONGE] || '',
      dateDebut: formatDate(dateDebut),
      dateFin: formatDate(dateFin),
      statut: statut
    });
  }

  return results;
}
