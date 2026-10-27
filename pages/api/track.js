// api/track.js (Vercel) — Journalisation légère pour le tableau de bord admin.
//
// Body : { idToken, type, page?, productKey? }.
// Les statistiques de visites, vues et activité exigent account_settings.analytics=true.
// La dernière session reste une donnée opérationnelle ; le pays est facultatif.
// L'ancien type « order » est refusé (410) : seule /api/orders crée une demande
// à partir du produit et du vendeur relus côté serveur.

const { verifyUser } = require("../../server/access");
const { app } = require("../../server/grant");
const { setCors, parseBody } = require("../../server/http");
const { rateLimit } = require("../../lib/rateLimit");
const { reportError } = require("../../server/log");
const { resolveCountry } = require("../../lib/countries");

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

  const { idToken, type, page, productKey } = parseBody(req);

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
    const sessionUpdate = { uid: user.uid, email: user.email, lastActivityAt: now };
    if (kind === "visit") {
      Object.assign(sessionUpdate, { lastLoginAt: now }, analyticsEnabled && countryCode ? { country, countryCode } : { country: null, countryCode: null });
    }
    await db.ref("user_sessions/" + user.uid).update(sessionUpdate);
    if (!analyticsEnabled) return res.status(200).json({ ok: true });

    // 1) Compteur de visite (unique par utilisateur et par jour, + total via n).
    const vref = db.ref("analytics/visits/" + date + "/" + user.uid);
    await vref.child("n").transaction((c) => (c || 0) + 1);
    await vref.update({ last: now, email: user.email, ...(countryCode ? { country, countryCode } : {}) });

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

// Clé Firebase valide (les clés produit ne contiennent jamais . # $ / [ ]).
function safeKey(v) { return (v == null ? "" : String(v)).replace(/[.#$/[\]]/g, "").slice(0, 64); }
function str(v, max) { return (v == null ? "" : String(v)).trim().slice(0, max || 120); }
// Champ libre journalisé PUIS affiché dans le tableau de bord admin : on retire
// les caractères d'évasion HTML (chevrons, quotes, backtick, esperluette) pour
// qu'aucune valeur stockée ne puisse porter une XSS vers l'admin.
function clean(v, max) { return str(v, max).replace(/[<>"'`&]/g, " ").trim(); }
