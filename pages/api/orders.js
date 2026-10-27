const { verifyUser, isAdmin } = require("../../server/access");
const { app } = require("../../server/grant");
const { setCors, parseBody } = require("../../server/http");
const { rateLimit } = require("../../lib/rateLimit");
const { reportError } = require("../../server/log");
const { createRequest, listOrders, transitionOrder, refreshContact } = require("../../server/orderStore");

export default async function handler(req, res) {
  setCors(req, res); res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée." });
  const body = parseBody(req);
  let user;
  try { user = await verifyUser(body.idToken, true); }
  catch (error) { return res.status(error.statusCode || 401).json({ error: error.message }); }
  if (!rateLimit("orders:" + user.uid, 60, 60000)) return res.status(429).json({ error: "Trop de demandes. Réessayez dans une minute." });
  try {
    const db = app().database(), action = body.action || "list";
    if (action === "create") return res.json(await createRequest(db, user, body.productKey, body.requestId));
    if (action === "contact") return res.json(await refreshContact(db, user, body.orderId));
    if (action === "transition") return res.json({ order: await transitionOrder(db, user, body.orderId, body.status, await isAdmin(user), body.note) });
    if (action === "admin-list") {
      if (!(await isAdmin(user))) return res.status(403).json({ error: "Accès administrateur requis." });
      const { publicOrder } = require("../../server/orderStore");
      const snap = await db.ref("orders_v2").orderByChild("at").limitToLast(100).once("value"), items = [];
      snap.forEach((child) => { items.push(publicOrder(child.key, child.val())); });
      return res.json({ items: items.reverse(), nextCursor: null });
    }
    if (["list", "seller-list"].includes(action)) {
      const result = await listOrders(db, user, { seller: action === "seller-list", cursor: body.cursor });
      if (action === "list" && !body.cursor) {
        const legacy = await db.ref("orders/" + user.uid).orderByChild("at").limitToLast(50).once("value");
        legacy.forEach((child) => {
          const old = child.val() || {};
          result.items.push({ _key: "legacy-" + child.key, produit: typeof old.produit === "string" ? old.produit.slice(0, 120) : "Produit",
            prix: typeof old.prix === "number" && Number.isFinite(old.prix) ? old.prix : null,
            devise: typeof old.devise === "string" ? old.devise.slice(0, 8) : "FCFA", vendeur: typeof old.vendeur === "string" ? old.vendeur.slice(0, 80) : "Boutique",
            at: typeof old.at === "number" && Number.isFinite(old.at) ? old.at : 0,
            status: "legacy_request", schemaVersion: 1 });
        });
        result.items.sort((a, b) => b.at - a.at);
      }
      return res.json(result);
    }
    return res.status(400).json({ error: "Action inconnue." });
  } catch (error) {
    if (!error.statusCode) await reportError("orders", error, { uid: user.uid });
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : "Impossible de traiter votre demande. Réessayez avec la même référence." });
  }
}
