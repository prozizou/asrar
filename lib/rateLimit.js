// lib/rateLimit.js — Limite de fréquence légère, en mémoire du processus
// (pas de dépendance React/Firebase : importable côté serveur via require(),
// même interop que lib/plans.js et lib/csp.js).
//
// PAS distribuée : chaque instance serverless a son propre compteur, remis à
// zéro à chaque cold start. Ce n'est donc pas une garantie stricte (un
// attaquant réparti sur plusieurs instances la contourne), mais une
// protection réelle contre un compte compromis qui spamme depuis UNE
// session : borne le débit à `limit` requêtes par fenêtre glissante de
// `windowMs`, par clé (typiquement "action:" + uid). Pour une garantie dure
// multi-instance, migrer vers un store partagé (Upstash Redis, Vercel KV…) —
// cf. ANALYSE.md.

const buckets = new Map(); // clé -> tableau de timestamps (fenêtre glissante)
let lastSweep = Date.now();

// Purge périodique des clés inactives (au plus 1×/min) pour éviter une fuite
// mémoire lente sur une instance qui vit longtemps.
function sweep(maxAgeMs, now) {
  if (now - lastSweep < 60000) return;
  lastSweep = now;
  for (const [key, arr] of buckets) {
    const fresh = arr.filter((t) => now - t < maxAgeMs);
    if (fresh.length === 0) buckets.delete(key);
    else buckets.set(key, fresh);
  }
}

/**
 * @param {string} key clé unique (ex. "track:" + uid)
 * @param {number} limit nombre de requêtes autorisées par fenêtre
 * @param {number} windowMs durée de la fenêtre en millisecondes
 * @param {number} [now] horloge injectable (tests) — Date.now() par défaut
 * @returns {boolean} true si la requête est autorisée (et comptée)
 */
export function rateLimit(key, limit, windowMs, now = Date.now()) {
  sweep(Math.max(windowMs, 300000), now);
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    buckets.set(key, arr);
    return false;
  }
  arr.push(now);
  buckets.set(key, arr);
  return true;
}

// Test-only : vide l'état global entre les cas de test (aucun usage en prod).
export function __resetRateLimitForTests() {
  buckets.clear();
  lastSweep = Date.now();
}
