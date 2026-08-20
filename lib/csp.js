// lib/csp.js — Content-Security-Policy, SOURCE UNIQUE (next.config.mjs).
//
// script-src reste en 'unsafe-inline' — DÉLIBÉRÉMENT, après un aller-retour :
// une version antérieure posait un nonce par requête (middleware.js) pour
// fermer ce point. En production, ça a cassé signInWithPopup() (Google Sign-
// In) avec l'erreur Firebase `auth/internal-error` : GAPI/Google Identity
// Services injecte dynamiquement des scripts/iframes de relais (postMessage)
// dont le contenu échappe entièrement à notre contrôle — impossible de leur
// poser NOTRE nonce, donc bloqués par une CSP à nonce sans 'unsafe-inline'.
// Revenir sur ce point (middleware.js supprimé) a immédiatement débloqué la
// connexion. Ce risque était déjà documenté avant l'expérience (voir le
// commentaire GAPI ci-dessous) mais pas vérifié en conditions réelles avec
// un vrai compte Google avant déploiement — d'où la régression.
// Voir ANALYSE.md pour l'historique complet. Si ce point est rouvert un
// jour : tester signInWithPopup ET signInWithRedirect avec un vrai compte
// Google AVANT de déployer, pas seulement `next build && next start` + curl.
export function buildCsp() {
  return [
    "default-src 'self'",
    // GAPI (chargé par signInWithPopup) injecte dynamiquement des
    // scripts/iframes de relais (postMessage) depuis PLUSIEURS sous-domaines
    // Google selon la région/le compte (constaté : blocages CSP en prod avec
    // un allowlist restreint à www.gstatic.com/apis.google.com seuls) —
    // wildcard sur gstatic.com et google.com, comme recommandé par Google
    // pour l'intégration GAPI/Google Identity Services. 'unsafe-inline' :
    // voir le commentaire d'en-tête (nonce essayé, cassait la connexion).
    "script-src 'self' 'unsafe-inline' https://apis.google.com https://*.gstatic.com https://www.google.com https://accounts.google.com",
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
