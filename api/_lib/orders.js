// api/_lib/orders.js — Commandes du Marché (achat de PRODUITS, PAS d'abonnement).
//
// Règle métier : l'acheteur paie le PRIX VENDEUR. Le prix fait foi CÔTÉ SERVEUR
// (lu dans det_produits) — jamais celui envoyé par le navigateur. L'administration
// retient COMMISSION_RATE (5 %) du total ; le reste (95 %) revient au vendeur et est
// journalisé pour règlement.
//
// Stockage :
//   orders/{buyerUid}/{orderId}            → commande (lisible par l'acheteur)
//   vendor_sales/{vendorId}/{orderId}      → journal des ventes (lecture serveur uniquement)

const { app } = require("./grant");

const COMMISSION_RATE = 0.05; // 5 % administration ; 95 % vendeur.

/** Calcule total + commission + ventilation par vendeur à partir des PRIX SERVEUR. */
async function buildOrder(items, /* user */ _user) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("Panier vide.");
  if (items.length > 50) throw new Error("Trop d'articles dans le panier.");

  const db = app().database();
  let total = 0;
  let devise = null;
  const lines = [];
  const vendors = {};

  for (const it of items) {
    const key = it && it.key;
    if (!key) throw new Error("Article invalide.");
    let qty = parseInt(it && it.quantity, 10);
    if (!Number.isFinite(qty) || qty < 1) qty = 1;
    if (qty > 99) qty = 99;

    const snap = await db.ref("det_produits/" + key).once("value");
    const p = snap.val();
    if (!p) throw new Error("Produit introuvable : " + key);

    const price = parseInt(p.Prix, 10);
    if (!Number.isFinite(price) || price <= 0) throw new Error("Prix invalide pour : " + key);

    const cur = p.devise || "FCFA";
    if (devise === null) devise = cur;
    else if (devise !== cur) throw new Error("Devises mélangées dans le panier.");

    const vendorId = p.uid || p.vendeurId || "inconnu";
    const vendorName = p.vendeur || "Vendeur";
    const lineTotal = price * qty;
    total += lineTotal;

    lines.push({ key, name: p.produit || key, price, quantity: qty, lineTotal, vendorId, vendorName });

    if (!vendors[vendorId]) vendors[vendorId] = { vendorName, subtotal: 0 };
    vendors[vendorId].subtotal += lineTotal;
  }

  const commission = Math.round(total * COMMISSION_RATE); // part administration
  const sellerPayout = total - commission;                // part vendeur

  // Ventilation commission / reversement par vendeur (au prorata).
  Object.keys(vendors).forEach((v) => {
    const sub = vendors[v].subtotal;
    vendors[v].commission = Math.round(sub * COMMISSION_RATE);
    vendors[v].payout = sub - vendors[v].commission;
  });

  return { total, commission, sellerPayout, devise: devise || "FCFA", lines, vendors };
}

/** Réserve un identifiant de commande (clé push) sans rien écrire encore. */
function reserveOrderId(buyerUid) {
  return app().database().ref("orders/" + buyerUid).push().key;
}

/** Enregistre la commande EN ATTENTE (clé sous l'uid acheteur → lisible par lui). */
async function savePendingOrder({ user, orderId, order, token }) {
  await app().database().ref("orders/" + user.uid + "/" + orderId).set({
    status: "pending",
    buyerId: user.uid,
    email: user.email,
    at: Date.now(),
    total: order.total,
    commission: order.commission,   // 5 % administration
    sellerPayout: order.sellerPayout, // 95 % vendeur
    devise: order.devise,
    items: order.lines,
    vendors: order.vendors,
    token: token || null
  });
  return orderId;
}

/**
 * Marque la commande PAYÉE (idempotent) + journalise les ventes par vendeur.
 * custom_data PayDunya attendu : { kind:'order', buyerId, orderId }.
 */
async function markOrderPaid(custom = {}, meta = {}) {
  const { buyerId, orderId } = custom;
  if (!buyerId || !orderId) throw new Error("Référence de commande manquante.");

  const db = app().database();
  const ref = db.ref("orders/" + buyerId + "/" + orderId);
  const cur = (await ref.once("value")).val();
  if (!cur) throw new Error("Commande introuvable : " + orderId);

  if (cur.status === "paid") return { orderId, status: "paid" }; // déjà traité

  await ref.update({
    status: "paid",
    paidAt: Date.now(),
    paidAmount: meta.amount || cur.total,
    token: meta.token || cur.token || null
  });

  // Journal des ventes par vendeur (pour les règlements administration → vendeurs).
  const vendors = cur.vendors || {};
  await Promise.all(Object.keys(vendors).map((vid) =>
    db.ref("vendor_sales/" + vid + "/" + orderId).set({
      buyerId,
      at: Date.now(),
      subtotal: vendors[vid].subtotal,
      commission: vendors[vid].commission,
      payout: vendors[vid].payout,
      devise: cur.devise || "FCFA"
    })
  ));

  return { orderId, status: "paid" };
}

module.exports = { buildOrder, reserveOrderId, savePendingOrder, markOrderPaid, COMMISSION_RATE };
