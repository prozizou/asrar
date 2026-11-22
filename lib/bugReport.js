// lib/bugReport.js — Rapports de bugs et de lenteurs envoyés par l'application
// (components/BugReporter.js, components/ReportProblem.js) et reçus par
// pages/api/client-error.js. Logique pure, sans Firebase : partagée par le
// client (filtrage avant envoi) et le serveur (validation, regroupement).
//
// Quatre familles :
//  - « error »  : exception JavaScript non rattrapée, promesse rejetée sans
//                 gestionnaire, plantage d'un écran React, erreur serveur 5xx ;
//  - « lag »    : interface gelée, page longue à charger, requête trop lente ;
//  - « user »   : problème décrit par l'utilisateur (« Signaler un problème »).
//
// Les occurrences d'un même bug sont REGROUPÉES par une empreinte calculée
// côté serveur (jamais celle du client) : même famille, même message (chiffres
// et identifiants neutralisés), même première ligne de pile (sans numéros de
// ligne, qui changent à chaque déploiement). Un signalement utilisateur forme
// toujours son propre groupe.
//
// Données conservées : message, pile tronquée, page (chemin, sans paramètres),
// type d'appareil, version de l'app. Jamais le contenu des champs saisis, ni
// l'adresse complète (la requête « ?… » est retirée).

const KINDS = ['error', 'lag', 'user'];
const MAX_BATCH = 10;
const LIMITS = { message: 300, stack: 3000, detail: 1000, page: 120, label: 80 };

// Bruit connu, sans valeur pour corriger l'application : erreurs opaques des
// scripts tiers (« Script error. »), boucle bénigne de ResizeObserver,
// extensions du navigateur, annulations volontaires, scripts publicitaires.
const NOISE = [
  /^script error\.?$/i,
  /resizeobserver loop/i,
  /(chrome|moz|safari(-web)?)-extension:\/\//i,
  /^AbortError\b/i,
  /the (operation|user) (was )?abort(ed)?/i,
  /\b(adsterra|googlesyndication|doubleclick|unityads|levelplay)\b/i,
  /^Non connecté\.?$/i,
];

function clip(value, max) {
  return (value == null ? '' : String(value)).replace(/\u0000/g, '').trim().slice(0, max);
}

// « /zikr/abc?x=1#y » → « /zikr/abc » ; URL complète → chemin seul.
function pageOf(value) {
  let raw = clip(value, 600);
  if (!raw) return '/';
  try { raw = new URL(raw, 'https://x.invalid').pathname; } catch { raw = raw.split(/[?#]/)[0]; }
  raw = raw.replace(/[^\w\-/.~%]/g, '').replace(/\/{2,}/g, '/');
  return (raw.startsWith('/') ? raw : '/' + raw).slice(0, LIMITS.page) || '/';
}

function isNoise(message, stack = '') {
  const parts = [String(message || '').trim(), String(stack || '')];
  return NOISE.some((re) => parts.some((part) => re.test(part)));
}

/**
 * Valide et normalise un rapport brut. Renvoie null s'il est invalide ou du bruit.
 * @param {any} raw
 * @returns {null | {kind: string, message: string, stack: string, detail: string, page: string, label: string, durationMs: number, version: string}}
 */
function sanitizeReport(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = KINDS.includes(raw.kind) ? raw.kind : 'error';
  const message = clip(raw.message, LIMITS.message);
  const detail = clip(raw.detail, LIMITS.detail);
  if (kind === 'user' ? !detail : !message) return null;
  const stack = clip(raw.stack, LIMITS.stack);
  if (kind === 'error' && isNoise(message, stack)) return null;
  const duration = Math.round(Number(raw.durationMs));
  const version = /^[\w.\-]{1,24}$/.test(String(raw.version || '')) ? String(raw.version) : '';
  return {
    kind,
    message: message || (kind === 'user' ? 'Signalement' : ''),
    stack,
    detail,
    page: pageOf(raw.page || raw.url),
    label: clip(raw.label, LIMITS.label),
    durationMs: Number.isFinite(duration) && duration > 0 ? Math.min(duration, 600_000) : 0,
    version,
  };
}

// Message sans les parties variables : nombres, identifiants, adresses.
function normalizeMessage(message) {
  return String(message || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/\b[0-9a-f]{8,}\b/g, '<id>')
    .replace(/\d+/g, 'N')
    .replace(/\s+/g, ' ')
    .trim();
}

// Première ligne de pile utile, sans numéros de ligne/colonne ni empreinte de
// fichier (« page-3f2a1b.js » → « page.js »).
function topFrame(stack) {
  const lines = String(stack || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const frame = lines.find((l) => /^at\s|@/.test(l)) || '';
  return frame
    .replace(/\?[^\s)]*/g, '')
    .replace(/:\d+(:\d+)?/g, '')
    .replace(/[-.][0-9a-f]{6,}(?=\.js)/gi, '')
    .replace(/https?:\/\/[^/\s)]+/g, '')
    .slice(0, 200);
}

// FNV-1a 32 bits (même fonction que lib/market.js), en base 36.
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

/**
 * Empreinte de regroupement d'un rapport normalisé. Les lenteurs sont groupées
 * par nature (label) et par page ; les erreurs par message et origine dans le code.
 * @param {{kind: string, message?: string, stack?: string, page?: string, label?: string, detail?: string}} r
 * @param {string} [unique] identifiant propre (signalement utilisateur)
 */
function fingerprintOf(r, unique = '') {
  if (r.kind === 'user') return 'u_' + (unique || fnv1a(r.detail + Date.now()));
  if (r.kind === 'lag') return 'l_' + fnv1a([r.label || r.message, r.page].join('|'));
  return 'e_' + fnv1a([normalizeMessage(r.message), topFrame(r.stack)].join('|'));
}

// Clé Firebase sûre pour une version (« v46.93 » → « v46,93 »).
const versionKey = (v) => String(v || 'inconnue').replace(/[.#$/[\]]/g, ',').slice(0, 24) || 'inconnue';

module.exports = {
  KINDS, MAX_BATCH, LIMITS,
  sanitizeReport, fingerprintOf, normalizeMessage, topFrame, isNoise, pageOf, versionKey, fnv1a,
};
