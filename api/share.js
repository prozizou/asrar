// api/share.js (Vercel) — Lien PARTAGEABLE d'un élément (secret, livre, produit).
//
// URL publique (voir la réécriture "/s" dans vercel.json) :
//   /s?k=secret&c=deblocage&i=<clé>&r=<code parrain>
//   /s?r=<code parrain>                      → simple lien de l'application
//
// Rôle :
//   1) Servir une page d'APERÇU avec les balises Open Graph (titre + image),
//      pour que WhatsApp / Facebook / TikTok / Telegram affichent une vignette.
//   2) Rediriger le visiteur humain vers la page du hub, avec ?item=&cat=&r=
//      (le module ouvre alors l'élément ; le paywall reste inchangé).
//   3) Compter le clic pour les statistiques de parrainage (AUCUN point ici :
//      les points sont crédités par /api/referral, à l'inscription du filleul).
//
// IMPORTANT — confidentialité : cette page est PUBLIQUE (les robots des réseaux
// sociaux ne peuvent pas se connecter). Elle n'expose QUE le titre et l'image
// (métadonnées déjà visibles dans les listes). Le contenu payant (sirr, pdf,
// description vendeur) n'est JAMAIS lu ici. Passez SHARE_SHOW_TITLES à false
// pour n'afficher qu'un aperçu générique.

const { app } = require("./_lib/grant");
const { SOURCES } = require("./_lib/sources");

const SHARE_SHOW_TITLES = true;

// Types partageables → page cible (doit rester aligné avec js/share.js).
const TARGETS = {
  secret:  { page: "/asrar/asrar.html",                 rubrique: "Secrets Mystiques" },
  book:    { page: "/bibliotheque/bibliotheque.html",   rubrique: "Bibliothèque Almaqtab" },
  product: { page: "/marche/marche.html",               rubrique: "Marché Mystique" }
};

const TITLE_FIELDS = ["faida", "title", "titre", "text", "produit", "name"];
const IMG_FIELDS   = ["img", "image", "Image", "cover"];

const CRAWLER = /(facebookexternalhit|facebot|whatsapp|twitterbot|telegrambot|discordbot|linkedinbot|slackbot|pinterest|tiktok|bytespider|bot|crawler|spider|preview)/i;

module.exports = async (req, res) => {
  const site = siteUrl(req);
  const q = req.query || {};

  const kind = safe(q.k, 16);
  const cat  = safe(q.c, 32);
  const key  = safeKey(q.i);
  const code = String(q.r || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

  const target = TARGETS[kind];
  const src    = SOURCES[kind];

  // Destination par défaut : l'application (lien de parrainage simple).
  let dest  = "/index.html";
  let title = "ASRAR PRO — Sciences mystiques";
  let desc  = "Secrets mystiques, bibliothèque Almaqtab, géomancie, noms d'Allah et marché mystique.";
  let image = site + "/assets/icon-512.png";

  if (target && src && key && (!src.cats || src.cats.includes(cat))) {
    dest = target.page + "?item=" + encodeURIComponent(key) + (cat ? "&cat=" + encodeURIComponent(cat) : "");
    desc = target.rubrique + " · ASRAR PRO — Ouvrez le lien pour consulter cet élément.";

    if (SHARE_SHOW_TITLES) {
      try {
        const snap = await app().database().ref(src.ref(cat) + "/" + key).once("value");
        const item = snap.val();
        if (item) {
          const t = pick(item, TITLE_FIELDS);
          const i = pick(item, IMG_FIELDS);
          if (t) title = String(t).slice(0, 120) + " — ASRAR PRO";
          if (i) image = absolute(String(i), site);
        }
      } catch (e) {
        // Base indisponible → aperçu générique, la redirection fonctionne quand même.
        console.error("share:", e.message);
      }
    }
  }

  if (code) dest += (dest.indexOf("?") === -1 ? "?" : "&") + "r=" + encodeURIComponent(code);

  // Statistique de clic (jamais de points ici) — ignore les robots d'aperçu.
  const ua = String((req.headers && req.headers["user-agent"]) || "");
  if (code && !CRAWLER.test(ua)) countClick(code).catch(() => {});

  const shareUrl = site + "/s" + (req.url && req.url.indexOf("?") >= 0 ? req.url.slice(req.url.indexOf("?")) : "");
  const to = site + dest;

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(
`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="robots" content="noindex,follow">
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="ASRAR PRO">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(shareUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<link rel="icon" type="image/png" href="/assets/favicon.png">
<meta http-equiv="refresh" content="0; url=${esc(to)}">
<style>
 body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:#0f2027;color:#f5e6c4;font:16px/1.6 system-ui,-apple-system,sans-serif;text-align:center;padding:24px}
 img{width:84px;height:84px;border-radius:18px;margin-bottom:14px}
 a{color:#c9a961}
</style>
</head>
<body>
<div>
  <img src="/assets/logo-mark.png" alt="ASRAR PRO">
  <h1 style="font-size:1.15rem;font-weight:600;margin:0 0 6px">${esc(title)}</h1>
  <p style="opacity:.75;margin:0 0 14px">Ouverture d'ASRAR PRO…</p>
  <a href="${esc(to)}">Continuer</a>
</div>
<script>location.replace(${JSON.stringify(to)});</script>
</body>
</html>`
  );
};

// ── Compteur de clics pour le tableau de bord parrainage ──────
async function countClick(code) {
  const db = app().database();
  const uid = (await db.ref("referral_codes/" + code).once("value")).val();
  if (!uid) return;
  await db.ref("referrals/" + uid + "/clicks").transaction((c) => (c || 0) + 1);
  await db.ref("referrals/" + uid + "/lastClickAt").set(Date.now());
}

// ── Utilitaires ───────────────────────────────────────────────
function siteUrl(req) {
  if (process.env.SITE_URL) return String(process.env.SITE_URL).replace(/\/+$/, "");
  const host = (req.headers && (req.headers["x-forwarded-host"] || req.headers.host)) || "";
  const proto = (req.headers && req.headers["x-forwarded-proto"]) || "https";
  return host ? proto + "://" + host : "";
}
function safe(v, max) { return String(v == null ? "" : v).trim().slice(0, max); }
// Clés Firebase : alphanumérique + - _ (les clés push et les clés manuelles sûres).
function safeKey(v) { return String(v == null ? "" : v).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64); }
function pick(obj, fields) { for (const f of fields) if (obj[f]) return obj[f]; return null; }
function absolute(url, site) {
  if (/^https?:\/\//i.test(url)) return url;
  return site + (url.charAt(0) === "/" ? "" : "/") + url;
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
