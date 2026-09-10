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
// Body (JSON) : { idToken, cat, key, action, text?, stars? }
//   cat    → catégorie (id de catégorie de secret, ou "product"/"vendor"/
//            "formation" pour les avis — voir lib/reviews.js)
//   key    → clé du secret / produit / vendeur / formation
//   action → "get" (lit tout, nécessite cat+key) | "toggle-like" (cat+key) |
//            "comment" (cat+key+text, stars? 1-5 — un AVIS est un commentaire
//            qui porte `stars`, voir lib/reviews.js) | "market-popularity"
//            (bulk, tous produits — remplace l'ancien
//            get(ref(db,'ratings|comments/product')) direct de app/page.js) |
//            "vendor-likes" (bulk, tous vendeurs — likes ET commentaires/avis,
//            remplace get(ref(db,'ratings/vendor'))) | "formation-popularity"
//            (bulk, toutes formations — avis uniquement, pas de likes)
//
// MIGRATION FIRESTORE (Phase 4, voir docs/FIRESTORE_SCHEMA.md) :
//   likes/{cat}:{itemKey}    = { cat, itemKey, uids: {uid: valeur}, count }
//   comments/{id}            = { cat, itemKey, uid, email?, photo?, text,
//                                 timestamp, stars? }
// remplacent ratings/{cat}/{key}/{uid} et comments/{cat}/{key}/{id} (RTDB).
// "market-popularity"/"vendor-likes"/"formation-popularity" reconstituent la
// forme imbriquée `{itemKey: {...}}` attendue par les appelants existants
// (app/page.tsx) à partir des requêtes plates ci-dessus — aucun changement
// côté client.

const { verifyUser } = require("../../server/access");
const { app } = require("../../server/grant");
const { setCors, parseBody } = require("../../server/http");
const { rateLimit } = require("../../lib/rateLimit");
const { reportError } = require("../../server/log");
const { cleanStars } = require("../../lib/reviews");

// Like + commentaire restent des actions ponctuelles (pas de boucle de
// rafraîchissement serveur ici) : une limite large, surtout là pour couper un
// compte compromis qui spammerait des commentaires.
const RATE_LIMIT = { max: 60, windowMs: 60_000 };

// Clé Firebase valide (les clés secret/produit/catégorie ne contiennent jamais . # $ / [ ]).
function safeKey(v) { return (v == null ? "" : String(v)).replace(/[.#$/[\]]/g, "").slice(0, 64); }
// Même bornage que l'ancienne règle RTDB comments/*/*/*.validate (longueur 1-500).
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

  const firestore = app().firestore();

  try {
    // — Lectures agrégées (page Marché : cartes produit + boutiques, avant
    // même l'ouverture d'un produit précis) — aucun cat/key requis. —
    if (action === "market-popularity") {
      const [likes, coms, orderCountsSnap] = await Promise.all([
        likesByCat(firestore, "product"),
        commentsByCat(firestore, "product"),
        firestore.collection("order_counts").get(),
      ]);
      const orders = {};
      orderCountsSnap.forEach((d) => { orders[d.id] = Number((d.data() || {}).count) || 0; });
      return res.status(200).json({ likes, comments: coms, orders });
    }

    if (action === "vendor-likes") {
      const [vendorLikes, vendorComments] = await Promise.all([
        likesByCat(firestore, "vendor"),
        commentsByCat(firestore, "vendor"),
      ]);
      // vendorComments (avis, avec `stars`? — voir lib/reviews.js avgStars) :
      // champ AJOUTÉ, jamais retiré — compat ascendante avec les appelants
      // qui ne lisaient jusqu'ici que vendorLikes.
      return res.status(200).json({ vendorLikes, vendorComments });
    }

    if (action === "formation-popularity") {
      // Pas de likes pour les formations, seulement des avis (étoiles) —
      // voir lib/reviews.js avgStars.
      const comments = await commentsByCat(firestore, "formation");
      return res.status(200).json({ comments });
    }

    // — Actions ciblées sur un secret/produit/vendeur précis —
    if (!cat || !key) return res.status(400).json({ error: "Catégorie/clé manquante." });
    const likeRef = firestore.collection("likes").doc(cat + ":" + key);
    const commentsQuery = firestore.collection("comments")
      .where("cat", "==", cat).where("itemKey", "==", key).orderBy("timestamp");

    if (action === "get") {
      const [likeSnap, commentsSnap] = await Promise.all([likeRef.get(), commentsQuery.get()]);
      const uids = likeSnap.exists ? (likeSnap.data().uids || {}) : {};
      const comments = [];
      commentsSnap.forEach((doc) => {
        const c = doc.data() || {};
        comments.push({
          id: doc.id,
          email: c.email || c.pseudo || "Utilisateur",
          photo: c.photo || "",
          text: c.text || "",
          stars: cleanStars(c.stars), // null si ce commentaire n'est pas un avis
        });
      });
      return res.status(200).json({
        liked: !!uids[user.uid],
        likeCount: Object.keys(uids).length,
        comments,
      });
    }

    if (action === "toggle-like") {
      let liked, likeCount;
      await firestore.runTransaction(async (tx) => {
        const snap = await tx.get(likeRef);
        const uids = { ...((snap.exists && snap.data().uids) || {}) };
        const already = !!uids[user.uid];
        if (already) delete uids[user.uid];
        // Valeur numérique arbitraire (1) : seule la PRÉSENCE de la clé compte
        // (existence testée partout ailleurs — jamais la valeur elle-même).
        else uids[user.uid] = 1;
        const count = Object.keys(uids).length;
        tx.set(likeRef, { cat, itemKey: key, uids, count });
        liked = !already;
        likeCount = count;
      });
      return res.status(200).json({ liked, likeCount });
    }

    if (action === "comment") {
      const text = cleanComment(body.text);
      if (!text) return res.status(400).json({ error: "Commentaire vide." });
      // `stars` (1-5) : présent → cet commentaire est un AVIS (boutique/
      // formation), voir lib/reviews.js. Absent/invalide → commentaire
      // ordinaire, comme avant (Secrets, Marché produit).
      const stars = cleanStars(body.stars);
      const photo = user.picture || "";
      const record = { cat, itemKey: key, uid: user.uid, email: user.email || "", photo, text, timestamp: Date.now() };
      if (stars != null) record.stars = stars;
      const ref = await firestore.collection("comments").add(record);
      return res.status(200).json({ comment: { id: ref.id, email: user.email || "", photo, text, stars } });
    }

    return res.status(400).json({ error: "Action inconnue." });
  } catch (e) {
    await reportError("social", e, { uid: user.uid, cat, key, action });
    return res.status(500).json({ error: e.message });
  }
};

// Reconstitue { itemKey: { uid: valeur } } (forme RTDB attendue par les
// appelants existants) à partir de la collection plate `likes` — un seul doc
// par item, filtré par catégorie.
async function likesByCat(firestore, cat) {
  const snap = await firestore.collection("likes").where("cat", "==", cat).get();
  const out = {};
  snap.forEach((doc) => { out[doc.data().itemKey] = doc.data().uids || {}; });
  return out;
}

// Reconstitue { itemKey: { commentId: {...} } } à partir de la collection
// plate `comments` — plusieurs docs par item, regroupés ici par itemKey.
async function commentsByCat(firestore, cat) {
  const snap = await firestore.collection("comments").where("cat", "==", cat).get();
  const out = {};
  snap.forEach((doc) => {
    const k = doc.data().itemKey;
    if (!out[k]) out[k] = {};
    out[k][doc.id] = doc.data();
  });
  return out;
}
