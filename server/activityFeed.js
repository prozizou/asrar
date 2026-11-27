// server/activityFeed.js — Rétention du fil d'activité (activity_feed).
//
// Chaque page ouverte et chaque bouton touché y ajoute une entrée
// (pages/api/track.js) : sans nettoyage, le nœud grossit sans fin et chaque
// lecture admin/statistique devient plus lente et plus coûteuse. Le panneau
// d'administration n'affiche de toute façon que les dernières entrées.
//
// Les clés push Firebase commencent par l'horodatage d'écriture (8 caractères
// en base 64 ordonnée) : une requête orderByKey suffit, sans index sur `at`.
const DAY = 86400000;
const ACTIVITY_RETENTION_DAYS = 14;
const PUSH_CHARS = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";

/** Préfixe de clé push correspondant à un instant (ms). */
function pushKeyPrefix(ms) {
  let n = Math.max(0, Math.floor(ms)), out = "";
  for (let i = 0; i < 8; i++) { out = PUSH_CHARS.charAt(n % 64) + out; n = Math.floor(n / 64); }
  return out;
}

// Borné pour tenir dans la durée du cron : au plus BATCHES × BATCH entrées
// par passage ; un retard se résorbe sur les passages suivants.
async function purgeActivityFeed(db, now = Date.now(), { batch = 4000, batches = 25 } = {}) {
  const cutoff = pushKeyPrefix(now - ACTIVITY_RETENTION_DAYS * DAY);
  let deleted = 0;
  for (let i = 0; i < batches; i++) {
    const snap = await db.ref("activity_feed").orderByKey().endBefore(cutoff).limitToFirst(batch).once("value");
    const keys = Object.keys(snap.val() || {});
    if (!keys.length) break;
    await db.ref("activity_feed").update(Object.fromEntries(keys.map((key) => [key, null])));
    deleted += keys.length;
    if (keys.length < batch) break;
  }
  return deleted;
}

module.exports = { purgeActivityFeed, pushKeyPrefix, ACTIVITY_RETENTION_DAYS };
