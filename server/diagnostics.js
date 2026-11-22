const { createHash } = require('node:crypto');
const { sanitizeDiagnostic } = require('../lib/diagnosticPrivacy');
const DAY = 86400000;
const day = now => new Date(now).toISOString().slice(0, 10).replace(/-/g, '');
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 32);
async function allowance(db, key, max) {
  const result = await db.ref('app_diagnostic_limits/' + key).transaction(n => {
    if ((Number(n) || 0) >= max) return;
    return (Number(n) || 0) + 1;
  });
  return result.committed;
}
// Quotas partagés entre instances ; l'empreinte de l'IP change chaque jour.
async function recordDiagnostic(db, input, context = {}, now = Date.now()) {
  const event = sanitizeDiagnostic(input);
  if (event.kind === 'server' && !context.server) {
    event.kind = 'javascript'; event.title = 'Erreur JavaScript';
  }
  const bucket = day(now);
  const source = hash(bucket + ':' + (context.source || 'anonymous'));
  if (!await allowance(db, bucket + '_total', 2000)) return false;
  if (!await allowance(db, bucket + '_' + source, 100)) return false;
  const fingerprint = hash(JSON.stringify([event.kind, event.name, event.page, event.endpoint, event.stack, event.version, context.platform || 'server', event.statusCode]));
  const key = bucket + '_' + fingerprint;
  await db.ref('app_diagnostics/' + key).transaction(current => ({
    ...event, platform: context.platform || 'server',
    firstAt: Math.min(current?.firstAt || now, now), lastAt: Math.max(current?.lastAt || now, now),
    count: (Number(current?.count) || 0) + 1,
    maxDurationMs: Math.max(Number(current?.maxDurationMs) || 0, event.durationMs),
    status: 'open', resolvedAt: null, resolvedBy: null,
    lastUid: context.uid || null,
  }));
  return true;
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
module.exports = { recordDiagnostic, purgeDiagnostics };
