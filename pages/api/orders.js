// api/orders.js (Vercel) — Historique de commandes CÔTÉ ACHETEUR.
//
// Body (JSON) : { idToken } → { items: [{ _key, productKey, produit, prix,
//   devise, vendeur, image, at }] }, plus récent d'abord.
//
// Lit la collection Firestore `orders` (écrite par api/track.js, type="order",
// au clic « Commander via WhatsApp ») filtrée par `uid` — un utilisateur ne
// voit QUE ses propres commandes, via une requête indexée (voir
// firestore.indexes.json, index composite uid+at) plutôt que le chemin
// orders/{uid} de la RTDB (Phase 2 de la migration — voir
// docs/FIRESTORE_SCHEMA.md).

const { verifyUser } = require("../../server/access");
const { app } = require("../../server/grant");
const { setCors, parseBody } = require("../../server/http");
const { reportError } = require("../../server/log");

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken } = parseBody(req);

  let user;
  try { user = await verifyUser(idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  try {
    const snap = await app().firestore()
      .collection("orders")
      .where("uid", "==", user.uid)
      .orderBy("at")
      .get();
    const items = [];
    snap.forEach((d) => items.push({ _key: d.id, ...d.data() }));
    items.reverse(); // plus récent d'abord
    return res.status(200).json({ items });
  } catch (e) {
    await reportError("orders", e, { uid: user.uid });
    return res.status(500).json({ error: e.message });
  }
};
