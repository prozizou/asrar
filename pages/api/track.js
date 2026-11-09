// api/track.js (Vercel) — Journalisation légère pour le tableau de bord admin.
//
// Body : { idToken, type, page?, productKey?, adStats? }.
// type="ad_stats" : compteurs agrégés de la pub au clic (lib/actionAd.ts) —
// ajoutés à analytics/ads/{jour}, sans visite ni entrée dans le fil d'activité.
// Le journal détaillé (visites par compte, vues, activité) exige account_settings.analytics=true ;
// les compteurs d'audience anonymes (analytics/daily, analytics/geo) valent pour tous.
// La dernière session reste une donnée opérationnelle ; le pays est facultatif.
// L'ancien type « order » est refusé (410) : seule /api/orders crée une demande
// à partir du produit et du vendeur relus côté serveur.

const { verifyUser } = require("../../server/access");
const { app } = require("../../server/grant");
const { setCors, parseBody } = require("../../server/http");
const { rateLimit } = require("../../lib/rateLimit");
const { reportError } = require("../../server/log");
const { resolveCountry } = require("../../lib/countries");
const { platformOf } = require("../../lib/platform");

// Géolocalisation IP : Vercel ajoute ces en-têtes à toute requête passée par
// son réseau edge (aucune clé/API tierce, aucun coût, aucune permission
// navigateur) — absents en local (`next dev`) ou hors Vercel, d'où le repli
// silencieux sur un pays inconnu plutôt qu'une erreur.
// Doc : https://vercel.com/docs/edge-network/headers#request-headers
function geoFromRequest(req) {
  const code = req.headers["x-vercel-ip-country"];
  return resolveCountry(code);
}

// Le tracking suit la navigation normale (une entrée par page/action) : une
// limite large, juste assez pour couper un compte compromis qui boucle en
// continu sur cet endpoint (chaque appel écrit dans activity_feed).
const RATE_LIMIT = { max: 60, windowMs: 60_000 };

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken, type, page, productKey, adStats } = parseBody(req);

  let user;
  try { user = await verifyUser(idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  if (!rateLimit("track:" + user.uid, RATE_LIMIT.max, RATE_LIMIT.windowMs)) {
    // Le tracking ne doit jamais casser l'expérience (cf. plus bas) : 200 silencieux.
    return res.status(200).json({ ok: false, reason: "rate_limited" });
  }

  const db = app().database();
  const now = Date.now();
  const date = new Date(now).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const safePage = clean(page, 80);
  const kind = clean(type, 24) || "visit";
  if (kind === "order") return res.status(410).json({ error: "Ouvrez la fiche produit pour créer une demande avec le prix vérifié." });
  const { country, countryCode } = geoFromRequest(req);

  try {
    const analyticsEnabled = (await db.ref("account_settings/" + user.uid + "/analytics").once("value")).val() === true;
    // 2bis) Session utilisateur (inscription/connexion + dernière activité) —
    // un seul nœud par utilisateur (merge), source de la répartition par
    // pays et du flux de connexions récentes côté panneau d'administration.
    // `lastLoginAt` n'est mis à jour que sur une VRAIE connexion (type="visit",
    // envoyé une fois par session app par trackVisit()) ; les autres types
    // d'événements (product_view, order…) ne rafraîchissent que
    // `lastActivityAt`, sans écraser le pays/heure de connexion avec une valeur
    // moins significative.
    const sessionRef = db.ref("user_sessions/" + user.uid);
    const sessionUpdate = { uid: user.uid, email: user.email, lastActivityAt: now };
    let previousVisitDay = "";
    if (kind === "visit") {
      previousVisitDay = String((await sessionRef.child("lastVisitDay").once("value")).val() || "");
      Object.assign(sessionUpdate, { lastLoginAt: now, lastVisitDay: date }, analyticsEnabled && countryCode ? { country, countryCode } : { country: null, countryCode: null });
    }
    await sessionRef.update(sessionUpdate);

    // 2ter) Mesure d'audience ANONYME, pour tous les comptes : de simples
    // compteurs agrégés (aucun uid, aucun e-mail, aucune page) — visites du
    // jour, visiteurs uniques du jour, type d'appareil, pays (jour et mois).
    // Sans ces compteurs, le panneau d'administration affichait 0 visite et
    // aucun pays, puisque presque personne ne coche la mesure détaillée
    // (account_settings.analytics, décochée par défaut) : celle-ci reste
    // réservée aux comptes qui l'acceptent (journal par compte ci-dessous).
    if (kind === "visit") await countAudience(db, date, previousVisitDay, countryCode, platformOf(req.headers["user-agent"]));
    if (!analyticsEnabled) return res.status(200).json({ ok: true });

    // 0) Compteurs de la pub au clic : un envoi groupé par session environ
    // (lib/actionAd.ts). Valeurs bornées : un client ne peut pas gonfler les
    // totaux au-delà de ce qu'un envoi légitime peut contenir.
    if (kind === "ad_stats") {
      const counts = adCounts(adStats);
      if (counts) {
        await Promise.all(Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) =>
          db.ref("analytics/ads/" + date + "/" + k).transaction((c) => (c || 0) + n)));
      }
      return res.status(200).json({ ok: true });
    }

    // 1) Compteur de visite (unique par utilisateur et par jour, + total via n).
    const vref = db.ref("analytics/visits/" + date + "/" + user.uid);
    await vref.child("n").transaction((c) => (c || 0) + 1);
    // platform : catégorie d'appareil (lib/platform.js), lue par l'administration.
    await vref.update({ last: now, email: user.email, platform: platformOf(req.headers["user-agent"]), ...(countryCode ? { country, countryCode } : {}) });

    // 2) Fil d'activité global (les N dernières actions visibles côté admin).
    await db.ref("activity_feed").push({
      uid: user.uid, email: user.email, type: kind, page: safePage, at: now,
      ...(countryCode ? { country, countryCode } : {}),
    });



    // 4) Vue produit (Marché) : un enregistrement par visiteur, pour les
    // statistiques boutique (api/shop.js action="stats"). Écrit ici (Admin
    // SDK) car un nœud client direct dépendrait de règles RTDB non gérées
    // dans ce dépôt.
    if (kind === "product_view") {
      const key = safeKey(productKey);
      if (key) await db.ref("views/product/" + key + "/" + user.uid).set(now);
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    // Le tracking ne doit jamais casser l'expérience : on renvoie 200 malgré l'erreur.
    await reportError("track", e, { uid: user.uid, kind });
    return res.status(200).json({ ok: false });
  }
};

// Compteurs anonymes : analytics/daily/{jour}/{visits,unique,platforms/*,countries/*}
// et analytics/geo/{AAAA-MM}/{pays} (utilisateurs distincts du mois).
// « XX » = pays inconnu (en-tête de géolocalisation absent).
async function countAudience(db, date, previousVisitDay, countryCode, platform) {
  const inc = (path) => db.ref(path).transaction((c) => (Number(c) || 0) + 1);
  const code = /^[A-Z]{2}$/.test(countryCode || "") ? countryCode : "XX";
  const day = "analytics/daily/" + date;
  const jobs = [inc(day + "/visits")];
  if (previousVisitDay !== date) {
    jobs.push(inc(day + "/unique"), inc(day + "/platforms/" + platform), inc(day + "/countries/" + code));
    if (previousVisitDay.slice(0, 7) !== date.slice(0, 7)) jobs.push(inc("analytics/geo/" + date.slice(0, 7) + "/" + code));
  }
  await Promise.all(jobs);
}

// Compteurs de pub : entiers 0..AD_COUNT_MAX, quick+closed+open ≤ opened.
const AD_COUNT_MAX = 100;
const AD_KEYS = ["opened", "quick", "closed", "open"];
function adCounts(v) {
  if (!v || typeof v !== "object") return null;
  const out = {};
  for (const k of AD_KEYS) out[k] = Math.max(0, Math.min(AD_COUNT_MAX, Math.floor(Number(v[k]) || 0)));
  if (out.quick + out.closed + out.open > out.opened) return null;
  return out;
}

// Clé Firebase valide (les clés produit ne contiennent jamais . # $ / [ ]).
function safeKey(v) { return (v == null ? "" : String(v)).replace(/[.#$/[\]]/g, "").slice(0, 64); }
function str(v, max) { return (v == null ? "" : String(v)).trim().slice(0, max || 120); }
// Champ libre journalisé PUIS affiché dans le tableau de bord admin : on retire
// les caractères d'évasion HTML (chevrons, quotes, backtick, esperluette) pour
// qu'aucune valeur stockée ne puisse porter une XSS vers l'admin.
function clean(v, max) { return str(v, max).replace(/[<>"'`&]/g, " ").trim(); }
