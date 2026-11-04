// lib/cspReport.js — Lecture des rapports de violation CSP envoyés par les
// navigateurs (pages/api/csp-report.js). Logique pure, sans Firebase.
//
// Deux formats coexistent selon le navigateur :
//  - « report-uri » (Firefox, Safari, anciens Chrome) : Content-Type
//    application/csp-report, corps { "csp-report": { "blocked-uri",
//    "violated-directive" | "effective-directive", "document-uri", … } } ;
//  - « report-to » / Reporting API (Chrome récent) : Content-Type
//    application/reports+json, corps [ { type: "csp-violation", body: {
//    blockedURL, effectiveDirective, documentURL, … } }, … ].
//
// But : savoir quels domaines la CSP de lib/csp.js bloque réellement chez les
// visiteurs (ex. scripts ou mesures d'audience des régies publicitaires), en
// ne gardant que (directive, domaine) — aucune URL complète, aucune donnée
// personnelle.

const MAX_REPORTS = 20; // un envoi groupé de la Reporting API, au plus
const DIRECTIVES = new Set([
  'script-src', 'script-src-elem', 'script-src-attr', 'style-src', 'style-src-elem', 'style-src-attr',
  'img-src', 'font-src', 'connect-src', 'frame-src', 'child-src', 'media-src', 'worker-src',
  'object-src', 'form-action', 'base-uri', 'frame-ancestors', 'manifest-src', 'prefetch-src', 'default-src',
]);

// « script-src-elem 'self' … » → « script-src-elem » ; directive inconnue → null.
function directiveOf(value) {
  const name = String(value || '').trim().split(/\s+/)[0].toLowerCase();
  return DIRECTIVES.has(name) ? name : null;
}

// Domaine bloqué, ou catégorie pour ce qui n'est pas une URL (« inline »,
// « eval », « data », « blob »…). Jamais le chemin ni les paramètres.
function blockedOf(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'inconnu';
  if (['inline', 'eval', 'wasm-eval', 'trusted-types-policy', 'trusted-types-sink'].includes(raw)) return raw;
  if (/^(data|blob|about|chrome-extension|moz-extension|safari-extension|safari-web-extension):?/.test(raw)) {
    return raw.split(':')[0]; // extensions du navigateur, data:, blob: …
  }
  try {
    const host = new URL(raw).hostname;
    return /^[a-z0-9.-]{1,120}$/.test(host) ? host : 'inconnu';
  } catch {
    return 'inconnu';
  }
}

function hostOf(value) {
  try { return new URL(String(value || '')).hostname.toLowerCase(); } catch { return ''; }
}

/**
 * @param {unknown} body corps JSON déjà décodé (l'un des deux formats)
 * @param {(documentHost: string) => boolean} isOwnHost la page d'origine est-elle la nôtre ?
 * @returns {{directive: string, blocked: string}[]}
 */
function parseCspReports(body, isOwnHost) {
  const raw = Array.isArray(body)
    ? body.filter((r) => r && r.type === 'csp-violation').map((r) => r.body || {})
    : body && typeof body === 'object' && body['csp-report'] ? [body['csp-report']] : [];
  const out = [];
  for (const r of raw.slice(0, MAX_REPORTS)) {
    if (!r || typeof r !== 'object') continue;
    if (!isOwnHost(hostOf(r.documentURL || r['document-uri']))) continue;
    const directive = directiveOf(r.effectiveDirective || r['effective-directive'] || r['violated-directive']);
    if (!directive) continue;
    out.push({ directive, blocked: blockedOf(r.blockedURL || r['blocked-uri']) });
  }
  return out;
}

// Clé Firebase : « . » interdit → « , » (même convention que les e-mails).
const firebaseKey = (host) => host.replace(/\./g, ',');

module.exports = { parseCspReports, firebaseKey, MAX_REPORTS };
