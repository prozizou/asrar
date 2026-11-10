// api/product-requests.js — « Demander un produit » dans une boutique du Marché.
//
// Body (JSON) : { idToken, action, vendorId, ... }
//   action="list"   → propriétaire : TOUTES les demandes de sa boutique ;
//                     autre utilisateur : uniquement SES demandes (+ réponse)
//   action="create" → { text }      un client demande un produit (pas le propriétaire)
//   action="reply"  → { id, text }  propriétaire seulement — "" efface la réponse
//   action="delete" → { id }        propriétaire, ou l'auteur pour retirer sa demande
//
// Stockage : product_requests/{vendorId}/{id} = { uid, email, name, text, at,
// reply?:{ text, at } }. Écriture ET lecture réservées au serveur (Admin SDK,
// règles RTDB fermées) : le contenu d'une demande n'est jamais visible des
// autres clients. Le propriétaire est reconnu par son e-mail vérifié
// (lib/productRequests.js isShopOwner), jamais par une donnée du client.

const { verifyUser } = require("../../server/access");
const { app } = require("../../server/grant");
const { setCors, parseBody, isValidKey } = require("../../server/http");
const { rateLimit } = require("../../lib/rateLimit");
const { reportError } = require("../../server/log");
const { publishAndNotify } = require("../../server/notify");
const { vendorKey, emailVendorKey } = require("../../lib/market");
const {
  cleanRequestText, isShopOwner, publicRequest, sortRequests,
  REQUEST_TEXT_MAX, REPLY_TEXT_MAX, MAX_OPEN_PER_USER,
} = require("../../lib/productRequests");
const { productRequestNotification, productRequestReplyNotification } = require("../../lib/notifyTemplates");

export default async function handler(req, res) {
  setCors(req, res); res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée." });

  const body = parseBody(req);
  let user;
  try { user = await verifyUser(body.idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }
  if (!rateLimit("product-requests:" + user.uid, 60, 60000)) {
    return res.status(429).json({ error: "Trop de demandes. Réessayez dans une minute." });
  }

  const { action, vendorId } = body;
  if (!isValidKey(vendorId) || vendorId.length > 128) return res.status(400).json({ error: "Boutique invalide." });

  const db = app().database();
  const base = "product_requests/" + vendorId;
  const owner = isShopOwner(user, vendorId);

  try {
    if (action === "list") {
      let items = [];
      if (owner) {
        const snap = await db.ref(base).orderByChild("at").limitToLast(200).once("value");
        snap.forEach((c) => { items.push(publicRequest(c.key, c.val(), true)); });
        // Mémorise l'uid du propriétaire : sert à le notifier des prochaines
        // demandes sans relire tout le catalogue.
        await db.ref("product_request_owners/" + vendorId).set(user.uid);
      } else {
        const snap = await db.ref(base).orderByChild("uid").equalTo(user.uid).once("value");
        snap.forEach((c) => { items.push(publicRequest(c.key, c.val(), false)); });
      }
      return res.status(200).json({ owner, items: sortRequests(items) });
    }

    if (action === "create") {
      if (owner) return res.status(400).json({ error: "Vous ne pouvez pas faire une demande dans votre propre boutique." });
      const text = cleanRequestText(body.text, REQUEST_TEXT_MAX);
      if (text.length < 3) return res.status(400).json({ error: "Décrivez le produit recherché." });

      const mine = await db.ref(base).orderByChild("uid").equalTo(user.uid).once("value");
      let open = 0;
      mine.forEach((c) => { const v = c.val() || {}; if (!v.reply) open++; });
      if (open >= MAX_OPEN_PER_USER) {
        return res.status(429).json({ error: "Vous avez déjà " + MAX_OPEN_PER_USER + " demandes en attente dans cette boutique." });
      }

      const ownerUids = await findOwnerUids(db, vendorId);
      if (!ownerUids.length) return res.status(404).json({ error: "Boutique introuvable." });

      const id = db.ref(base).push().key;
      const record = { uid: user.uid, email: user.email, name: displayName(user), text, at: Date.now() };
      const requesterName = displayName(user) || "Un client";
      await publishAndNotify(db, base + "/" + id, record, {
        ...productRequestNotification({ requesterName, preview: text }),
        senderName: requesterName,
        targetUrl: "/?shop=" + encodeURIComponent(vendorId),
        meta: { vendorId, tagSuffix: "req-" + vendorId },
      }, { uids: ownerUids.filter((uid) => uid !== user.uid), eventId: "product-request:" + vendorId + ":" + id });
      return res.status(200).json({ ok: true, item: publicRequest(id, record, false) });
    }

    if (action === "reply" || action === "delete") {
      const { id } = body;
      if (!isValidKey(id)) return res.status(400).json({ error: "Demande invalide." });
      const ref = db.ref(base + "/" + id);
      const cur = (await ref.once("value")).val();
      if (!cur) return res.status(404).json({ error: "Demande introuvable." });

      if (action === "delete") {
        if (!owner && cur.uid !== user.uid) return res.status(403).json({ error: "Seul le propriétaire de la boutique peut supprimer cette demande." });
        await ref.remove();
        return res.status(200).json({ ok: true });
      }

      if (!owner) return res.status(403).json({ error: "Seul le propriétaire de la boutique peut répondre." });
      const text = cleanRequestText(body.text, REPLY_TEXT_MAX);
      if (!text) {
        await ref.child("reply").remove();
        return res.status(200).json({ ok: true, item: publicRequest(id, { ...cur, reply: null }, true) });
      }
      const reply = { text, at: Date.now() };
      const shopName = await findShopName(db, vendorId, user.uid);
      if (cur.uid && cur.uid !== user.uid) {
        await publishAndNotify(db, base + "/" + id, { reply }, {
          ...productRequestReplyNotification({ shopName, preview: text }),
          senderName: shopName || "Boutique",
          targetUrl: "/?shop=" + encodeURIComponent(vendorId),
          meta: { vendorId, tagSuffix: "req-reply-" + id },
        }, { uids: [cur.uid], eventId: "product-request-reply:" + vendorId + ":" + id + ":" + reply.at });
      } else {
        await ref.child("reply").set(reply);
      }
      return res.status(200).json({ ok: true, item: publicRequest(id, { ...cur, reply }, true) });
    }

    return res.status(400).json({ error: "Action inconnue." });
  } catch (e) {
    if (!e.statusCode) await reportError("product-requests", e, { action, uid: user.uid });
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
}

function displayName(user) {
  const n = String(user.name || "").trim();
  if (n) return n.slice(0, 80);
  return String(user.email || "").split("@")[0].slice(0, 80);
}

// Uid(s) du propriétaire, pour le notifier. Ordre : uid mémorisé à sa
// dernière consultation, ancienne boutique identifiée par uid, sinon uid des
// produits / fiche boutique dont l'e-mail correspond à la clé.
async function findOwnerUids(db, vendorId) {
  const cached = (await db.ref("product_request_owners/" + vendorId).once("value")).val();
  if (typeof cached === "string" && cached) return [cached];
  if (!vendorId.startsWith("v_")) return [vendorId];
  const uids = new Set();
  const [prods, shops] = await Promise.all([
    db.ref("det_produits").once("value"),
    db.ref("profile_clients").once("value"),
  ]);
  prods.forEach((c) => {
    const v = c.val() || {};
    if (v.uid && vendorKey(v) === vendorId) uids.add(v.uid);
  });
  shops.forEach((c) => {
    const v = c.val() || {};
    if (v.uid && typeof v.email === "string" && emailVendorKey(v.email) === vendorId) uids.add(v.uid);
  });
  return [...uids];
}

// Nom affiché dans la notification de réponse : boutique vendeur
// (sellers/{uid}/shop) ou fiche boutique (profile_clients).
async function findShopName(db, vendorId, ownerUid) {
  const sellerName = (await db.ref("sellers/" + ownerUid + "/shop/name").once("value")).val();
  if (typeof sellerName === "string" && sellerName.trim()) return sellerName.trim().slice(0, 80);
  const snap = await db.ref("profile_clients").once("value");
  let name = "";
  snap.forEach((c) => {
    const v = c.val() || {};
    if (typeof v.email === "string" && emailVendorKey(v.email) === vendorId && v.profile_name) {
      name = String(v.profile_name).slice(0, 80);
      return true;
    }
    return false;
  });
  return name;
}
