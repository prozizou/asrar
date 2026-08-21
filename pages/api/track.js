// api/track.js (Vercel) — Journalisation légère pour le tableau de bord admin.
//
// Body (JSON) : { idToken, type, page?, lat?, lng?, city?, order? }
//   type="visit"     → comptage de visite (page) + fil d'activité
//   type="geomancie" → log géomancie AVEC localisation (lat/lng) + activité
//   type="order"     → enregistre la commande CÔTÉ ACHETEUR (orders/{uid}) —
//                       voir api/orders.js pour la relecture (« Mes commandes »)
//   (autre)          → événement générique dans le fil d'activité
//
// Écrit (Admin SDK, nœuds serveur-only) :
//   analytics/visits/{YYYY-MM-DD}/{uid} = { n, last, email }
//   activity_feed/{pushId}             = { uid, email, type, page, at }
//   geomancie_logs/{pushId}            = { uid, email, at, lat, lng, city }
//   orders/{uid}/{pushId}              = { productKey, produit, prix, devise,
//                                           vendeur, image, at }

const { verifyUser } = require("../../server/access");
const { app } = require("../../server/grant");
const { setCors, parseBody, safeUrl } = require("../../server/http");
const { rateLimit } = require("../../lib/rateLimit");
const { reportError } = require("../../server/log");

// Le tracking suit la navigation normale (une entrée par page/action) : une
// limite large, juste assez pour couper un compte compromis qui boucle en
// continu sur cet endpoint (chaque appel écrit dans activity_feed).
const RATE_LIMIT = { max: 60, windowMs: 60_000 };

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken, type, page, lat, lng, city, productKey, order } = parseBody(req);

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

  try {
    // 1) Compteur de visite (unique par utilisateur et par jour, + total via n).
    const vref = db.ref("analytics/visits/" + date + "/" + user.uid);
    await vref.child("n").transaction((c) => (c || 0) + 1);
    await vref.update({ last: now, email: user.email });

    // 2) Fil d'activité global (les N dernières actions visibles côté admin).
    await db.ref("activity_feed").push({ uid: user.uid, email: user.email, type: kind, page: safePage, at: now });

    // 3) Géomancie : log avec localisation si fournie.
    if (kind === "geomancie") {
      await db.ref("geomancie_logs").push({
        uid: user.uid, email: user.email, at: now,
        lat: coord(lat, -90, 90), lng: coord(lng, -180, 180), city: clean(city, 80)
      });
    }

    // 4) Vue produit (Marché) : un enregistrement par visiteur, pour les
    // statistiques boutique (api/shop.js action="stats"). Écrit ici (Admin
    // SDK) car un nœud client direct dépendrait de règles RTDB non gérées
    // dans ce dépôt.
    if (kind === "product_view") {
      const key = safeKey(productKey);
      if (key) await db.ref("views/product/" + key + "/" + user.uid).set(now);
    }

    // 5) Commande (Marché) : snapshot au moment du clic « Commander via
    // WhatsApp » — pour que l'acheteur retrouve son historique dans l'app
    // (rien n'existait avant : la commande ne vivait que dans WhatsApp).
    // Champs figés (pas une référence live au produit) : un produit modifié/
    // supprimé plus tard par le vendeur ne doit pas changer l'historique.
    if (kind === "order" && order && typeof order === "object") {
      const key = safeKey(order.productKey);
      if (key) {
        await db.ref("orders/" + user.uid).push({
          productKey: key,
          produit: clean(order.produit, 120),
          prix: num(order.prix),
          devise: clean(order.devise, 8) || "FCFA",
          vendeur: clean(order.vendeur, 80),
          image: safeUrl(order.image, 500),
          at: now,
        });
      }
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
function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : null; }
// Coordonnée bornée : rejette les valeurs hors [min,max] (protège le dashboard).
function coord(v, min, max) { const n = parseFloat(v); return (Number.isFinite(n) && n >= min && n <= max) ? n : null; }
