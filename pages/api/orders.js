// api/orders.js (Vercel) — Historique de commandes CÔTÉ ACHETEUR.
//
// Body (JSON) : { idToken } → { items: [{ _key, productKey, produit, prix,
//   devise, vendeur, image, at }] }, plus récent d'abord.
//
// Lit orders/{uid} (écrit par api/track.js, type="order", au clic
// « Commander via WhatsApp ») — un utilisateur ne voit QUE ses propres
// commandes : la portée `{uid}` est appliquée par le chemin lui-même, pas
// par un filtre après coup.

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
    const snap = await app().database().ref("orders/" + user.uid).orderByChild("at").once("value");
    const items = [];
    snap.forEach((c) => items.push({ _key: c.key, ...(c.val() || {}) }));
    items.reverse(); // plus récent d'abord
    return res.status(200).json({ items });
  } catch (e) {
    await reportError("orders", e, { uid: user.uid });
    return res.status(500).json({ error: e.message });
  }
};
