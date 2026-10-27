const crypto = require("node:crypto");
const { isValidKey, safeUrl } = require("./http");
const { ORDER_TRANSITIONS } = require("../lib/orderStatus");
const { app } = require("./grant");
const { getBoutiqueByEmail } = require("./sellers");
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const prefix = (uid) => hash(uid) + ":";
const lower = (value) => typeof value === "string" ? value.trim().toLowerCase() : "";

function price(value) {
  if (typeof value !== "string" && typeof value !== "number") throw fail(409, "Le prix de ce produit n'est pas disponible. Contactez la boutique.");
  const text = String(value).replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw fail(409, "Le prix de ce produit doit être vérifié par la boutique.");
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount > 1e12) throw fail(409, "Le prix de ce produit doit être vérifié par la boutique.");
  return amount;
}
function publicOrder(id, order) {
  const { _private, buyerSort, sellerSort, ...value } = order;
  return { _key: id, ...value };
}
function contactLink(id, order) {
  return "/api/wa?order=" + encodeURIComponent(id) + "&token=" + encodeURIComponent(order._private.contactToken);
}

async function createRequest(db, user, productKey, requestId) {
  if (!isValidKey(productKey) || typeof requestId !== "string" || !/^[A-Za-z0-9_-]{16,80}$/.test(requestId)) throw fail(400, "Produit ou référence de demande invalide.");
  const id = hash(user.uid + ":" + requestId), ref = db.ref("orders_v2/" + id);
  let current = (await ref.once("value")).val();
  if (!current) {
    const product = (await db.ref("det_produits/" + productKey).once("value")).val();
    if (!product) throw fail(404, "Ce produit n'est plus disponible.");
    let owner;
    try { owner = product.email ? await app().auth().getUserByEmail(lower(product.email)) : await app().auth().getUser(product.uid || product.vendeurId); }
    catch (error) {
      if (["auth/user-not-found", "auth/invalid-email", "auth/invalid-uid"].includes(error.code)) throw fail(409, "La boutique doit vérifier son compte avant de recevoir une demande.");
      throw error;
    }
    if (owner.disabled || owner.emailVerified !== true) throw fail(409, "La boutique doit vérifier son compte et son adresse e-mail avant de recevoir une demande.");
    const sellerUid = owner.uid;
    const seller = isValidKey(sellerUid) ? (await db.ref("sellers/" + sellerUid).once("value")).val() : null;
    const active = seller?.shopActive && (seller.expiresAt === "lifetime" || (typeof seller.expiresAt === "number" && seller.expiresAt > Date.now()));
    const boutique = !active
      ? await getBoutiqueByEmail(owner.email || product.email) : null;
    if (!active && !boutique) {
      throw fail(409, "Cette boutique n’est pas disponible pour de nouvelles demandes.");
    }
    const phone = String(boutique?.number || seller?.shop?.phone || product.number || "").replace(/\D/g, "");
    if (!isValidKey(sellerUid) || !/^\d{8,15}$/.test(phone)) throw fail(409, "La boutique doit vérifier ses coordonnées avant de recevoir une demande.");
    const at = Date.now(), order = {
      buyerUid: user.uid, sellerUid, productKey, produit: String(product.produit || "Produit").slice(0, 120), prix: price(product.Prix),
      devise: String(product.devise || "FCFA").slice(0, 8), vendeur: String(boutique?.profile_name || seller?.shop?.name || product.vendeur || "Boutique").slice(0, 80),
      image: safeUrl(product.Image, 500), quantity: 1, at, updatedAt: at, status: "whatsapp_request", schemaVersion: 2,
      buyerSort: prefix(user.uid) + String(at).padStart(13, "0") + ":" + id,
      sellerSort: prefix(sellerUid) + String(at).padStart(13, "0") + ":" + id,
      history: { created: { status: "whatsapp_request", at, actorUid: user.uid, role: "buyer" } },
      _private: { sellerEmail: lower(owner.email || product.email), phone, contactToken: crypto.randomBytes(32).toString("hex"), contactUntil: at + 15 * 60000 },
    };
    current = (await ref.transaction((value) => value || order)).snapshot.val();
  }
  if (current.buyerUid !== user.uid || current.productKey !== productKey) throw fail(409, "Cette référence correspond déjà à une autre demande.");
  const contact = current._private.contactUntil < Date.now() ? await refreshContact(db, user, id) : { contactUrl: contactLink(id, current) };
  return { order: publicOrder(id, current), ...contact };
}

async function listOrders(db, user, { seller = false, cursor } = {}) {
  const field = seller ? "sellerSort" : "buyerSort", scope = prefix(user.uid);
  let query = db.ref("orders_v2").orderByChild(field).startAt(scope);
  if (cursor != null) {
    if (typeof cursor !== "string" || !/^\d{13}:[a-f0-9]{64}$/.test(cursor)) throw fail(400, "Page de commandes invalide.");
    query = query.endBefore(scope + cursor);
  } else query = query.endAt(scope + "\uf8ff");
  const snap = await query.limitToLast(51).once("value"), rows = [];
  snap.forEach((child) => { rows.push({ id: child.key, value: child.val() }); });
  rows.reverse();
  const selected = rows.slice(0, 50);
  return { items: selected.map(({ id, value }) => publicOrder(id, value)),
    nextCursor: rows.length > 50 ? selected.at(-1).value[field].slice(scope.length) : null };
}

async function transitionOrder(db, user, id, status, admin, note = "") {
  if (!/^[a-f0-9]{64}$/.test(id || "") || !Object.hasOwn(ORDER_TRANSITIONS, status)) throw fail(400, "Statut ou commande invalide.");
  const at = Date.now(), eventId = crypto.randomUUID();
  let error;
  const tx = await db.ref("orders_v2/" + id).transaction((order) => {
    error = null;
    if (!order) return null;
    const seller = order.sellerUid === user.uid || (order._private.sellerEmail && order._private.sellerEmail === lower(user.email));
    const buyerCancel = order.buyerUid === user.uid && order.status === "whatsapp_request" && status === "cancelled";
    if (!admin && !seller && !buyerCancel) { error = fail(403, "Seule la boutique concernée peut confirmer le paiement ou la livraison."); return; }
    if (order.status === status) return order;
    if (!ORDER_TRANSITIONS[order.status]?.includes(status)) { error = fail(409, "Ce changement n'est plus possible. Actualisez la commande."); return; }
    return { ...order, status, updatedAt: at,
      history: { ...order.history, [eventId]: { status, at, actorUid: user.uid, role: admin ? "admin" : seller ? "seller" : "buyer",
        note: String(note || "").trim().slice(0, 300), ...(status === "paid" ? { paymentMode: "manual_declaration" } : {}) } } };
  });
  if (error) throw error;
  if (!tx.snapshot.exists()) throw fail(404, "Demande introuvable.");
  if (!tx.committed) throw fail(409, "La commande a changé. Actualisez la page.");
  return publicOrder(id, tx.snapshot.val());
}

async function refreshContact(db, user, id) {
  if (!/^[a-f0-9]{64}$/.test(id || "")) throw fail(400, "Référence invalide.");
  const token = crypto.randomBytes(32).toString("hex"), now = Date.now();
  let denied = false;
  const tx = await db.ref("orders_v2/" + id).transaction((order) => {
    if (!order) return null;
    if (order.buyerUid !== user.uid || order.status === "cancelled") { denied = true; return; }
    return { ...order, _private: { ...order._private, contactToken: token, contactUntil: now + 15 * 60000 } };
  });
  if (denied) throw fail(403, "Vous ne pouvez pas contacter la boutique pour cette demande.");
  if (!tx.snapshot.exists()) throw fail(404, "Demande introuvable.");
  return { contactUrl: contactLink(id, tx.snapshot.val()) };
}
module.exports = { createRequest, listOrders, transitionOrder, refreshContact, publicOrder, price };
