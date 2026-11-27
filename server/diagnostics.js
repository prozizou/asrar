const { createHash } = require('node:crypto');
const { sanitizeDiagnostic } = require('../lib/diagnosticPrivacy');
const DAY = 86400000;
const day = now => new Date(now).toISOString().slice(0, 10).replace(/-/g, '');
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 32);
// Réserve jusqu'à `wanted` unités d'un quota partagé en UNE transaction
// (au lieu d'une transaction par événement) : renvoie le nombre accordé.
async function reserve(db, key, max, wanted) {
  let granted = 0;
  const result = await db.ref('app_diagnostic_limits/' + key).transaction(n => {
    const used = Number(n) || 0;
    granted = Math.min(wanted, max - used);
    if (granted <= 0) return;
    return used + granted;
  });
  return result.committed ? granted : 0;
}
const isLag = event => ['freeze', 'slow_api', 'slow_task'].includes(event.kind);
// Quotas partagés entre instances ; l'empreinte de l'IP change chaque jour.
// Un lot coûte 2 transactions de quota + 1 par groupe distinct, en parallèle,
// quel que soit le nombre d'événements (auparavant 3 transactions
// séquentielles par événement, dont une sur le compteur global très disputé).
async function recordDiagnostics(db, inputs, context = {}, now = Date.now()) {
  const events = [];
  for (const input of inputs) {
    if (!input || typeof input !== 'object') continue;
    const event = sanitizeDiagnostic(input);
    if (event.kind === 'server' && !context.server) {
      event.kind = 'javascript'; event.title = 'Erreur JavaScript';
    }
    if (isLag(event) && event.durationMs <= 1000) continue;
    events.push(event);
  }
  if (!events.length) return 0;
  const bucket = day(now);
  const source = hash(bucket + ':' + (context.source || 'anonymous'));
  const total = await reserve(db, bucket + '_total', 2000, events.length);
  if (!total) return 0;
  const allowed = await reserve(db, bucket + '_' + source, 100, total);
  if (!allowed) return 0;
  const platform = context.platform || 'server';
  const groups = new Map();
  for (const event of events.slice(0, allowed)) {
    const fingerprint = hash(JSON.stringify([event.kind, event.name, event.page, event.endpoint, event.stack, event.version, event.details.task, event.details.phase, event.kind === 'resource' ? event.details.sourceFile : '', platform, event.statusCode]));
    const group = groups.get(fingerprint);
    if (!group) { groups.set(fingerprint, { event, occurrences: event.occurrences, maxDurationMs: event.durationMs }); continue; }
    group.occurrences += event.occurrences;
    if (event.durationMs >= group.maxDurationMs) { group.event = event; group.maxDurationMs = event.durationMs; }
  }
  await Promise.all([...groups].map(([fingerprint, group]) => db.ref('app_diagnostics/' + bucket + '_' + fingerprint).transaction(current => ({
    ...group.event, platform,
    firstAt: Math.min(current?.firstAt || now, now), lastAt: Math.max(current?.lastAt || now, now),
    count: (Number(current?.count) || 0) + group.occurrences,
    maxDurationMs: Math.max(Number(current?.maxDurationMs) || 0, group.maxDurationMs),
    status: 'open', resolvedAt: null, resolvedBy: null,
    lastUid: context.uid || null,
  }))));
  return allowed;
}
async function recordDiagnostic(db, input, context = {}, now = Date.now()) {
  return (await recordDiagnostics(db, [input], context, now)) > 0;
}
async function purgeDiagnostics(db, now = Date.now()) {
  const cutoff = day(now - 29 * DAY); // fenêtre de 30 dates UTC, nettoyage quotidien
  let deleted = 0;
  for (const root of ['app_diagnostics', 'app_diagnostic_limits']) {
    for (let i = 0; i < 3; i++) {
      const snap = await db.ref(root).orderByKey().endBefore(cutoff).limitToFirst(2000).once('value');
      const keys = Object.keys(snap.val() || {});
      if (!keys.length) break;
      await db.ref(root).update(Object.fromEntries(keys.map(key => [key, null])));
      deleted += keys.length;
      if (keys.length < 2000) break;
    }
  }
  return deleted;
}
module.exports = { recordDiagnostic, recordDiagnostics, purgeDiagnostics };
