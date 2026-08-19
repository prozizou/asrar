// lib/csp.js — Content-Security-Policy, SOURCE UNIQUE.
//
// Utilisée par next.config.mjs (repli statique, avec 'unsafe-inline' sur
// script-src — s'applique aux routes /api/* que middleware.js ne couvre pas)
// ET par middleware.js (politique par requête avec un nonce pour script-src,
// sur les pages). IMPORTANT : Next.js ne FUSIONNE PAS deux en-têtes
// Content-Security-Policy de même nom — celui posé par middleware.js
// REMPLACE entièrement celui de next.config.mjs sur les routes qu'il couvre.
// buildCsp() doit donc toujours renvoyer la politique COMPLÈTE (pas
// seulement script-src), qu'un nonce soit fourni ou non.
export function buildCsp(nonce) {
  const scriptSrc = nonce
    ? `'self' 'nonce-${nonce}' https://apis.google.com https://*.gstatic.com https://www.google.com https://accounts.google.com`
    : `'self' 'unsafe-inline' https://apis.google.com https://*.gstatic.com https://www.google.com https://accounts.google.com`;

  return [
    "default-src 'self'",
    // GAPI (chargé par signInWithPopup) injecte dynamiquement des
    // scripts/iframes de relais (postMessage) depuis PLUSIEURS sous-domaines
    // Google selon la région/le compte (constaté : blocages CSP en prod avec
    // un allowlist restreint à www.gstatic.com/apis.google.com seuls) —
    // wildcard sur gstatic.com et google.com, comme recommandé par Google
    // pour l'intégration GAPI/Google Identity Services.
    `script-src ${scriptSrc}`,
    // 'unsafe-inline' reste nécessaire sur style-src (attribut style="" posé
    // par le rendu serveur de React) : fermer ce point demanderait de migrer
    // les styles inline vers des classes CSS, hors périmètre ici.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    // Cloudinary (boutique/marché/secrets) + avatars Google (auth).
    "img-src 'self' data: blob: https://res.cloudinary.com https://*.googleusercontent.com https://*.gstatic.com",
    // Firebase Auth/Realtime DB/Messaging, Google Fonts, popup Google
    // Sign-In, Sunrise-Sunset + BigDataCloud (module Planète), AlQuran Cloud
    // (texte Uthmani, module Al Qalam) — sans ces domaines ici, le navigateur
    // bloque silencieusement les appels et l'app retombe sur ses solutions
    // de repli hors-ligne, moins complètes.
    "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://res.cloudinary.com https://api.cloudinary.com https://accounts.google.com https://api.sunrise-sunset.org https://api.bigdatacloud.net https://api.alquran.cloud",
    "frame-src 'self' https://asrar-bc059.firebaseapp.com https://accounts.google.com https://content.googleapis.com",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ');
}
