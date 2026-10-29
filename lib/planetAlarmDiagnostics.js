export const PLANET_ALARM_TEST_ID = 2147483647; // Outside alarmIdFor's range.

export function alarmDiagnosticIssues(status, nowMs = Date.now()) {
  if (!status) return [];
  const issues = [];
  if (!status.exactAlarms) issues.push('Autorisez les alarmes et rappels pour ASRAR PRO.');
  if (!status.notifications) issues.push('Autorisez les notifications de réveil pour pouvoir les arrêter.');
  if (status.volume === 0) issues.push('Le volume des alarmes est à zéro.');
  if (status.interruptionFilter === 3) issues.push('Le mode Ne pas déranger bloque tous les sons.');
  const events = Array.isArray(status.events) ? status.events : [];
  const outcome = [...events].reverse().find((event) => ['ringing', 'failed', 'expired', 'audio-unavailable'].includes(event.stage));
  if (outcome?.stage === 'failed') issues.push('Le dernier réveil n’a pas pu démarrer. Copiez le diagnostic pour identifier le blocage.');
  if (outcome?.stage === 'audio-unavailable') issues.push('Le dernier réveil a démarré, mais sa sonnerie était indisponible.');
  if (outcome?.stage === 'expired') issues.push('Le dernier réveil a été reçu trop tard pour sonner.');
  const missed = events.some((event, index) => event.stage === 'scheduled' && event.triggerAt < nowMs - 120000 &&
    !events.slice(index + 1).some((later) => later.id === event.id && ['received', 'cancelled', 'failed', 'expired', 'ringing'].includes(later.stage)));
  if (missed) issues.push('Un réveil programmé n’a pas été reçu par l’application à l’heure prévue.');
  return issues;
}

export function buildPlanetAlarmTest(prefs, nowMs) {
  return {
    id: PLANET_ALARM_TEST_ID, at: nowMs + 10000, title: 'Test du réveil ASRAR',
    body: 'Test sonore — arrêt automatique après 20 secondes.',
    sound: prefs.soundId, vibration: prefs.vibration, test: true,
  };
}
