// api/social.js (Vercel) — Likes & commentaires (secrets ET produits Marché),
// via HTTPS (Admin SDK), PAS via le SDK client Firebase Realtime Database.
//
// Avant : components/useProductSocial.js et useSecretRealtime.js ouvraient
// chacun un onValue() (écouteur RTDB temps réel) DIRECTEMENT depuis le
// navigateur — un WebSocket vers s-*.firebaseio.com. Même symptôme que
// /api/check-access (cf. son commentaire) : sur certains réseaux, ce canal
// reste bloqué en silence, sans jamais déclencher le callback — les likes et
// commentaires n'apparaissaient alors jamais, MEME quand le reste de la page
// (données produit, via /api/shop) s'affichait normalement (chemin HTTPS
// séparé, non affecté). D'où le passage de CE flux aussi par HTTPS.
//
// Contrepartie assumée : ce n'est plus du "temps réel" pur (un like/commentaire
// d'un AUTRE visiteur n'apparaît qu'au prochain "get", pas instantanément) —
// cohérent avec le reste de l'app, entièrement HTTPS/à la demande, plutôt que
// de garder un canal RTDB direct fragile pour ce seul gain.
//
// Body (JSON) : { idToken, cat, key, action, text? }
//   cat    → catégorie (id de catégorie de secret, ou "product"/"vendor" pour le Marché)
//   key    → clé du secret / produit / vendeur
//   action → "get" (lit tout, nécessite cat+key) | "toggle-like" (cat+key) |
//            "comment" (cat+key+text) | "market-popularity" (bulk, tous
//            produits — remplace l'ancien get(ref(db,'ratings|comments/product'))
//            direct de app/page.js) | "vendor-likes" (bulk, tous vendeurs —
//            remplace get(ref(db,'ratings/vendor')))
//
// Nœuds partagés (inchangés) : ratings/{cat}/{key}/{uid}, comments/{cat}/{key}/{id}.

const { verifyUser } = require("../../server/access");
const { app } = require("../../server/grant");
const { setCors, parseBody } = require("../../server/http");
const { rateLimit } = require("../../lib/rateLimit");
const { reportError } = require("../../server/log");

// Like + commentaire restent des actions ponctuelles (pas de boucle de
// rafraîchissement serveur ici) : une limite large, surtout là pour couper un
// compte compromis qui spammerait des commentaires.
const RATE_LIMIT = { max: 60, windowMs: 60_000 };

// Clé Firebase valide (les clés secret/produit/catégorie ne contiennent jamais . # $ / [ ]).
function safeKey(v) { return (v == null ? "" : String(v)).replace(/[.#$/[\]]/g, "").slice(0, 64); }
// Même bornage que la règle RTDB comments/*/*/*.validate (longueur 1-500) —
// répliqué ici car l'Admin SDK contourne les règles de sécurité.
function cleanComment(v) { return (v == null ? "" : String(v)).trim().slice(0, 500); }

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const body = parseBody(req);
  const { idToken, action } = body;
  const cat = safeKey(body.cat);
  const key = safeKey(body.key);

  let user;
  try { user = await verifyUser(idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  if (!rateLimit("social:" + user.uid, RATE_LIMIT.max, RATE_LIMIT.windowMs)) {
    return res.status(429).json({ error: "Trop de requêtes, réessaie dans un instant." });
  }

  const db = app().database();

  try {
    // — Lectures agrégées (page Marché : cartes produit + boutiques, avant
    // même l'ouverture d'un produit précis) — aucun cat/key requis. —
    if (action === "market-popularity") {
      const [likesSnap, comsSnap, ordersSnap] = await Promise.all([
        db.ref("ratings/product").once("value"),
        db.ref("comments/product").once("value"),
        db.ref("orders_count").once("value"),
      ]);
      return res.status(200).json({
        likes: likesSnap.val() || {},
        comments: comsSnap.val() || {},
        orders: ordersSnap.val() || {},
      });
    }

    if (action === "vendor-likes") {
      const snap = await db.ref("ratings/vendor").once("value");
      return res.status(200).json({ vendorLikes: snap.val() || {} });
    }

    // — Actions ciblées sur un secret/produit/vendeur précis —
    if (!cat || !key) return res.status(400).json({ error: "Catégorie/clé manquante." });
    const likesRef = db.ref(`ratings/${cat}/${key}`);
    const commentsRef = db.ref(`comments/${cat}/${key}`);

    if (action === "get") {
      const [likesSnap, commentsSnap] = await Promise.all([
        likesRef.once("value"),
        commentsRef.once("value"),
      ]);
      const likes = likesSnap.val() || {};
      const comments = [];
      commentsSnap.forEach((child) => {
        const c = child.val() || {};
        comments.push({ id: child.key, email: c.email || c.pseudo || "Utilisateur", photo: c.photo || "", text: c.text || "" });
      });
      return res.status(200).json({
        liked: !!likes[user.uid],
        likeCount: Object.keys(likes).length,
        comments,
      });
    }

    if (action === "toggle-like") {
      const uidRef = likesRef.child(user.uid);
      const snap = await uidRef.once("value");
      if (snap.exists()) await uidRef.remove();
      // Valeur numérique arbitraire (1) : seule la PRÉSENCE de la clé compte
      // (existence testée partout ailleurs — jamais la valeur elle-même).
      else await uidRef.set(1);
      const likesSnap = await likesRef.once("value");
      const likes = likesSnap.val() || {};
      return res.status(200).json({ liked: !!likes[user.uid], likeCount: Object.keys(likes).length });
    }

    if (action === "comment") {
      const text = cleanComment(body.text);
      if (!text) return res.status(400).json({ error: "Commentaire vide." });
      const photo = user.picture || "";
      const ref = await commentsRef.push({
        uid: user.uid,
        email: user.email || "",
        photo,
        text,
        timestamp: Date.now(),
      });
      return res.status(200).json({ comment: { id: ref.key, email: user.email || "", photo, text } });
    }

    return res.status(400).json({ error: "Action inconnue." });
  } catch (e) {
    await reportError("social", e, { uid: user.uid, cat, key, action });
    return res.status(500).json({ error: e.message });
  }
};
