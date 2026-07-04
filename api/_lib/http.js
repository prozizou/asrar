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

module.exports = { setCors, parseBody };
