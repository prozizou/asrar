// Cache local borné, réservé aux métadonnées déjà filtrées. Aucun jeton,
// droit d'accès ni contenu payant. Les autres instances expirent à 30 s.
const symbol = Symbol.for("asrar.publicCatalogCache");
const caches = globalThis[symbol] ||= new WeakMap();
const TTL_MS = 30000, MAX_BYTES = 8 * 1024 * 1024, MAX_ENTRY = 2 * 1024 * 1024;

async function publicCatalog(db, path, read) {
  let entries = caches.get(db);
  if (!entries) { entries = new Map(); caches.set(db, entries); }
  const existing = entries.get(path);
  if (existing?.pending) return JSON.parse(await existing.pending);
  if (existing && existing.until > Date.now()) return JSON.parse(existing.json);
  entries.delete(path);
  const entry = {};
  entry.pending = Promise.resolve().then(read).then((value) => {
    const json = JSON.stringify(value), bytes = Buffer.byteLength(json);
    if (entries.get(path) === entry) {
      entries.delete(path);
      if (bytes <= MAX_ENTRY) {
        for (const [key, value] of entries) if (!value.pending && value.until <= Date.now()) entries.delete(key);
        let total = [...entries.values()].reduce((sum, value) => sum + (value.bytes || 0), 0);
        while (entries.size && (total + bytes > MAX_BYTES || entries.size >= 31)) {
          const key = entries.keys().next().value;
          total -= entries.get(key).bytes || 0;
          entries.delete(key);
        }
        entries.set(path, { json, bytes, until: Date.now() + TTL_MS });
      }
    }
    return json;
  }).catch((error) => { if (entries.get(path) === entry) entries.delete(path); throw error; });
  while (entries.size >= 32) entries.delete(entries.keys().next().value);
  entries.set(path, entry);
  return JSON.parse(await entry.pending);
}

function invalidatePublicCatalog(db, changedPath) {
  const entries = caches.get(db);
  if (!entries) return;
  for (const path of entries.keys()) {
    if (path === changedPath || changedPath.startsWith(path + "/") || path.startsWith(changedPath + "/")) entries.delete(path);
  }
}

module.exports = { publicCatalog, invalidatePublicCatalog, TTL_MS };
