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

const { app } = require("../../server/grant");
const { SOURCES } = require("../../server/sources");
const { reportError } = require("../../server/log");
const { normalizeSiteUrl } = require("../../lib/site");

const SHARE_SHOW_TITLES = true;

// Types partageables → page cible (doit rester aligné avec lib/share.js).
// product → "/" : le Marché Mystique est désormais la page d'accueil.
const TARGETS = {
  secret:  { page: "/asrar",                 rubrique: "Secrets Mystiques" },
  book:    { page: "/bibliotheque",   rubrique: "Bibliothèque Almaqtab" },
  product: { page: "/",                     rubrique: "Marché Mystique" }
};

const TITLE_FIELDS = ["faida", "title", "titre", "text", "produit", "name"];
const IMG_FIELDS   = ["img", "image", "Image", "cover"];

const CRAWLER = /(facebookexternalhit|facebot|whatsapp|twitterbot|telegrambot|discordbot|linkedinbot|slackbot|pinterest|tiktok|bytespider|bot|crawler|spider|preview)/i;

export default async function handler(req, res) {
  const site = siteUrl(req);
  const q = req.query || {};

  const kind = safe(q.k, 16);
  const cat  = safe(q.c, 32);
  const key  = safeKey(q.i);
  const code = String(q.r || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

  const target = TARGETS[kind];
  const src    = SOURCES[kind];

  // Destination par défaut : l'application (lien de parrainage simple).
  // Image par défaut : la même carte de partage « professionnelle » que le
  // lien racine (app/layout.js, openGraph.images) — logo + accroche +
  // repère « Installer l'application » sur le fond cosmique de la charte —
  // plutôt que la simple icône carrée, pour un rendu cohérent quel que soit
  // le lien effectivement partagé (racine OU /s?r=<code>).
  let dest  = "/";
  let title = "ASRAR PRO — Sciences mystiques";
  let desc  = "Secrets mystiques, bibliothèque Almaqtab, géomancie, noms d'Allah et marché mystique.";
  let image = site + "/assets/og-banner.jpg";

  // Métadonnées de l'élément pour la page d'accueil du lien (distinctes des
  // balises OG : `title` y porte le suffixe « — ASRAR PRO », et `image` retombe
  // sur l'icône de l'app, déjà affichée comme logo).
  let itemTitle = null;
  let itemImage = null;
  let rubrique  = null;
  const hasItem = !!(target && src && key && (!src.cats || src.cats.includes(cat)));

  if (hasItem) {
    dest = target.page + "?item=" + encodeURIComponent(key) + (cat ? "&cat=" + encodeURIComponent(cat) : "");
    desc = target.rubrique + " · ASRAR PRO — Ouvrez le lien pour consulter cet élément.";
    rubrique = target.rubrique;

    if (SHARE_SHOW_TITLES) {
      try {
        const snap = await app().database().ref(src.ref(cat) + "/" + key).once("value");
        const item = snap.val();
        if (item) {
          const t = pick(item, TITLE_FIELDS);
          const i = pick(item, IMG_FIELDS);
          if (t) { itemTitle = String(t).slice(0, 120); title = itemTitle + " — ASRAR PRO"; }
          if (i) { itemImage = absolute(String(i), site); image = itemImage; }
        }
      } catch (e) {
        // Base indisponible → aperçu générique, la redirection fonctionne quand même.
        await reportError("share", e, { kind, cat, key });
      }
    }
  }

  if (code) dest += (dest.indexOf("?") === -1 ? "?" : "&") + "r=" + encodeURIComponent(code);

  // Statistique de clic (jamais de points ici) — ignore les robots d'aperçu.
  const ua = String((req.headers && req.headers["user-agent"]) || "");
  if (code && !CRAWLER.test(ua)) countClick(code).catch(() => {});

  const shareUrl = site + "/s" + (req.url && req.url.indexOf("?") >= 0 ? req.url.slice(req.url.indexOf("?")) : "");
  const to = site + dest;

  const heading = itemTitle || "Sciences mystiques";
  const subline = hasItem
    ? "Ouvrez ce contenu dans l'application ASRAR PRO."
    : "Secrets mystiques, noms d'Allah, heures planétaires, géomancie et marché mystique.";

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
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<meta name="theme-color" content="#0c0713">
<!-- Le manifeste est indispensable ICI : sans lui, le navigateur ne considère
     pas /s comme installable et n'émet jamais 'beforeinstallprompt' — le
     bouton « Installer » resterait donc muet sur la page de partage. -->
<link rel="manifest" href="/manifest.json">
<!-- Sans JavaScript, on retombe sur l'ancien comportement : redirection sèche
     vers la destination. Les robots d'aperçu (OG) n'exécutent pas de JS non
     plus, mais eux ne lisent que les balises ci-dessus. -->
<noscript><meta http-equiv="refresh" content="0; url=${esc(to)}"></noscript>
<style>
 :root{
   --bg:linear-gradient(135deg,#0c0713,#180d28,#241639);
   --surface:rgba(255,255,255,.06);--border:rgba(255,255,255,.2);
   --text:#fff;--muted:#e0e0e0;--dim:#b0b0b0;
   --accent:#a78bfa;--accent2:#f472b6;--glow:rgba(167,139,250,.4);
 }
 html[data-theme="light"]{
   --bg:linear-gradient(135deg,#eaf6f2,#e8eef6,#e6e8f5);
   --surface:rgba(255,255,255,.62);--border:rgba(20,60,55,.14);
   --text:#16302c;--muted:#4a635e;--dim:#647f79;
   --accent:#14b8a6;--accent2:#0f766e;--glow:rgba(20,184,166,.3);
 }
 *{box-sizing:border-box}
 body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
      background:var(--bg);background-attachment:fixed;color:var(--text);text-align:center;
      font:16px/1.6 Calibri,Carlito,'Segoe UI',system-ui,-apple-system,sans-serif}
 .bg{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none}
 .blob{position:absolute;border-radius:50%;filter:blur(30px)}
 .b1{width:260px;height:260px;left:-70px;top:-40px;opacity:.4;
     background:radial-gradient(circle,var(--accent),transparent 70%);animation:d1 14s ease-in-out infinite}
 .b2{width:220px;height:220px;right:-60px;bottom:80px;opacity:.33;
     background:radial-gradient(circle,var(--accent2),transparent 70%);animation:d2 16s ease-in-out infinite}
 @keyframes d1{0%,100%{transform:translate(-10%,-10%) scale(1)}50%{transform:translate(12%,16%) scale(1.18)}}
 @keyframes d2{0%,100%{transform:translate(14%,10%) scale(1.1)}50%{transform:translate(-12%,-14%) scale(.92)}}
 .card{width:100%;max-width:420px;background:var(--surface);border:1px solid var(--border);
       border-radius:20px;padding:30px 24px;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
       box-shadow:0 8px 32px rgba(0,0,0,.37)}
 .logo{width:76px;height:76px;border-radius:18px;display:block;margin:0 auto 14px}
 .brand{margin:0;font-size:1.45rem;font-weight:700;letter-spacing:2px;
        background:linear-gradient(45deg,var(--accent),var(--accent2));
        -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
 .badge{display:inline-block;margin-top:12px;padding:3px 10px;border-radius:10px;font-size:.7rem;
        font-weight:700;letter-spacing:.04em;color:var(--accent);border:1px solid var(--border)}
 .thumb{width:100%;max-height:170px;object-fit:cover;border-radius:14px;margin-top:14px;border:1px solid var(--border)}
 h1{margin:12px 0 0;font-size:1.1rem;font-weight:700;line-height:1.35}
 .sub{margin:8px 0 0;color:var(--muted);font-size:.9rem}
 .btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:20px;
      padding:14px 20px;border:none;border-radius:30px;cursor:pointer;color:#fff;font:600 1rem/1.2 inherit;
      background:linear-gradient(45deg,var(--accent),var(--accent2));box-shadow:0 8px 24px var(--glow);
      transition:transform .25s ease}
 .btn:hover{transform:translateY(-2px)}
 .cont{display:inline-block;margin-top:14px;color:var(--accent);font-size:.92rem;font-weight:600;text-decoration:none}
 .cont:hover{text-decoration:underline}
 .note{margin-top:16px;font-size:.72rem;color:var(--dim);line-height:1.5}
 .steps{margin-top:18px;text-align:left;display:flex;flex-direction:column;gap:9px}
 .step{display:flex;align-items:flex-start;gap:9px;font-size:.86rem;color:var(--muted)}
 .num{flex:0 0 auto;width:21px;height:21px;border-radius:50%;background:var(--accent);color:#fff;
      font-size:.74rem;font-weight:700;display:flex;align-items:center;justify-content:center}
 [hidden]{display:none!important}
 @media (prefers-reduced-motion:reduce){.blob{animation:none}.btn{transition:none}}
</style>
</head>
<body>
<div class="bg" aria-hidden="true"><div class="blob b1"></div><div class="blob b2"></div></div>

<main class="card">
  <img class="logo" src="/assets/logo-mark.png" alt="">
  <p class="brand">ASRAR PRO</p>
  ${rubrique ? `<span class="badge">${esc(rubrique)}</span>` : ""}
  ${itemImage ? `<img class="thumb" src="${esc(itemImage)}" alt="">` : ""}
  <h1>${esc(heading)}</h1>
  <p class="sub">${esc(subline)}</p>

  <button class="btn" id="install" hidden type="button">📲 Installer l'application</button>

  <div class="steps" id="ios" hidden>
    <div class="step"><span class="num">1</span><span>Appuyez sur <b>Partager</b> ⎋ en bas de Safari</span></div>
    <div class="step"><span class="num">2</span><span>Choisissez <b>« Sur l'écran d'accueil »</b> ➕</span></div>
    <div class="step"><span class="num">3</span><span>Ouvrez <b>ASRAR PRO</b> : le contenu partagé s'affiche directement</span></div>
  </div>

  <p class="sub" id="installed" hidden>✅ Application installée — ouvrez <b>ASRAR PRO</b> depuis votre écran d'accueil.</p>

  <a class="cont" id="continue" href="${esc(to)}">Continuer dans le navigateur →</a>
  <p class="note">Déjà installée ? Ce lien s'ouvre directement dans l'application.</p>
</main>

<script>
(function(){
  var TO = ${js(to)};          // destination absolue
  var DEST = ${js(dest)};      // même destination, en chemin interne
  var CODE = ${js(code)};      // code de parrainage ("" si aucun)
  var HAS_ITEM = ${hasItem ? "true" : "false"};

  // Mêmes clés que l'app — voir lib/share.js (REF_KEY, PENDING_KEY) et le
  // script anti-FOUC de app/layout.js pour le thème.
  var PENDING_KEY = 'asrar_pending_link';
  var REF_KEY = 'asrar_ref';
  var CLAIM_KEY = 'asrar_ref_claimed';

  function safe(fn){ try { return fn(); } catch (e) { return null; } }

  // Thème : on reprend celui déjà choisi dans l'app, pour que le lien partagé
  // ne surgisse pas en sombre chez quelqu'un qui utilise le mode clair.
  if (safe(function(){ return localStorage.getItem('asrar_theme'); }) === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }

  function standalone(){
    return window.matchMedia('(display-mode: standalone)').matches
        || window.matchMedia('(display-mode: fullscreen)').matches
        || window.matchMedia('(display-mode: minimal-ui)').matches
        || window.navigator.standalone === true;
  }

  // App déjà installée et lancée en mode autonome : c'est un vrai deep link,
  // on entre droit dans le contenu sans montrer cet écran intermédiaire.
  if (standalone()) { location.replace(TO); return; }

  // Mémorise la destination AVANT une éventuelle installation : celle-ci lance
  // l'app sur start_url ("/") sans nos paramètres. components/PendingDeepLink.js
  // rejoue ce chemin au premier lancement. Idem pour le parrainage, qui serait
  // sinon perdu par le même détour (captureRef() ne voit jamais le ?r=).
  safe(function(){
    if (HAS_ITEM) localStorage.setItem(PENDING_KEY, JSON.stringify({ path: DEST, at: Date.now() }));
    if (CODE && !localStorage.getItem(CLAIM_KEY)) {
      localStorage.setItem(REF_KEY, JSON.stringify({ code: CODE, at: Date.now() }));
    }
    return true;
  });

  var btn = document.getElementById('install');
  var deferred = null;

  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();          // on choisit NOUS-MÊMES quand l'afficher
    deferred = e;
    btn.hidden = false;
  });

  btn.addEventListener('click', function(){
    if (!deferred) return;
    deferred.prompt();
    var choice = deferred.userChoice;
    deferred = null;
    if (choice && choice.then) choice.then(function(){}, function(){});
  });

  window.addEventListener('appinstalled', function(){
    btn.hidden = true;
    document.getElementById('installed').hidden = false;
  });

  // iOS/iPadOS : 'beforeinstallprompt' n'existe pas — seules des instructions
  // manuelles sont possibles (même repli que components/PwaGate.js).
  var ua = navigator.userAgent || '';
  if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    document.getElementById('ios').hidden = false;
  }

  // Chrome exige un service worker enregistré pour proposer l'installation.
  // public/sw.js ne met rien en cache : l'enregistrer ici est sans effet de bord.
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function(){});
})();
</script>
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
  // normalizeSiteUrl() garantit un schéma (http/https) même si SITE_URL est
  // saisie sans dans les Environment Variables Vercel — sinon les liens de
  // partage et og:image générés ici seraient invalides (repli sur l'hôte de
  // la requête plus bas, non affecté puisqu'il compose lui-même le schéma).
  const fromEnv = normalizeSiteUrl(process.env.SITE_URL);
  if (fromEnv) return fromEnv;
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
// Littéral JS sûr à l'intérieur d'un <script> : JSON.stringify n'échappe pas
// "<", donc une valeur contenant "</script>" refermerait la balise. Les
// valeurs injectées ici sont déjà filtrées (safeKey, catégorie sur liste
// blanche, code alphanumérique), mais l'échappement ne coûte rien et rend la
// garantie locale plutôt que dépendante de chaque appelant.
function js(v) {
  return JSON.stringify(v == null ? "" : v).replace(/</g, "\\u003c");
}
