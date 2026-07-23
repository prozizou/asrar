// api/_lib/http.js — utilitaires HTTP communs aux fonctions Vercel.

// CORS : origine fixe via SITE_URL ; à défaut, on renvoie l'origine appelante
// (évite le "*" passe-partout). Pas de cookies → sûr.
function setCors(req, res, methods = "POST, OPTIONS") {
  const origin = process.env.SITE_URL || (req && req.headers && req.headers.origin) || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", methods);
}

// Body JSON robuste (objet déjà parsé OU chaîne brute).
function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

// Caractères interdits dans une URL affichée : espaces, quotes, chevrons,
// backtick, antislash — tout ce qui permettrait une évasion d'attribut HTML/JS.
const BAD_URL_CHARS = /["'<>`\\\s]/;

// URL sûre pour un contexte d'affichage (src d'image, lien PDF).
// N'autorise QUE https:// / http:// / un chemin relatif "/…", et rejette tout
// caractère d'évasion. Retourne "" si l'URL est invalide : impossible de stocker
// un javascript:/data: ni une URL piégée susceptible de casser le HTML.
function safeUrl(v, max = 800) {
  const s = (v == null ? "" : String(v)).trim().slice(0, max);
  if (!s) return "";
  if (BAD_URL_CHARS.test(s)) return "";
  if (!/^(https?:\/\/|\/)[^\s]+$/i.test(s)) return "";
  return s;
}

module.exports = { setCors, parseBody, safeUrl };
