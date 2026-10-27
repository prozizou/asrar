// api/_lib/http.js — utilitaires HTTP communs aux fonctions Vercel.

const { normalizeSiteUrl } = require("../lib/site");

// CORS : origine fixe via SITE_URL ; à défaut, on renvoie l'origine appelante
// (évite le "*" passe-partout). Pas de cookies → sûr. normalizeSiteUrl()
// garantit un schéma (http/https) même si la variable d'env est saisie sans
// — sinon un en-tête Access-Control-Allow-Origin sans schéma est invalide et
// silencieusement rejeté par les navigateurs (CORS cassé, sans erreur claire).
function setCors(req, res, methods = "POST, OPTIONS") {
  const origin = normalizeSiteUrl(process.env.SITE_URL) || (req && req.headers && req.headers.origin) || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", methods);
}

// Body JSON robuste (objet déjà parsé OU chaîne brute).
function parseBody(req) {
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) return req.body;
  if (typeof req.body === "string") {
    try {
      const body = JSON.parse(req.body);
      return body && typeof body === "object" && !Array.isArray(body) ? body : {};
    } catch { return {}; }
  }
  return {};
}

// Une clé désigne un seul enfant Firebase, jamais un chemin ou une valeur
// convertie implicitement en chaîne. Ne pas « nettoyer » un identifiant :
// deux entrées différentes pourraient alors désigner le même document.
function isValidKey(value) {
  return typeof value === "string" && value.length > 0 &&
    Buffer.byteLength(value, "utf8") <= 768 &&
    !/[.#$\[\]\/\u0000-\u001F\u007F]/.test(value);
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

module.exports = { setCors, parseBody, safeUrl, isValidKey };
