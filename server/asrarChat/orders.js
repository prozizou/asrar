// server/asrarChat/orders.js — Commandes et accès aux contenus payants.
//
// Paiement DIRECT au vendeur (Wave, PI-SPI, ou lien transmis par WhatsApp) :
// la plateforme ne voit pas passer l'argent, donc aucune confirmation
// automatique n'est possible. Règle absolue : l'accès n'est JAMAIS accordé
// sur la seule déclaration de l'acheteur (référence, capture) — uniquement
// quand le VENDEUR (qui voit son propre relevé Wave/PI-SPI) ou
// l'ADMINISTRATION (après vérification effective) confirme la réception.
//
// ac_orders/{oid} = { ref, postId, postTitle, buyerUid, sellerUid, amount,
//   method, status, paymentRef?, refReused?, commissionRate, commission,
//   createdAt, updatedAt, paidAt?, history: { pushId: { at, by, role, status, note? } } }
const crypto = require("crypto");
const { isValidKey } = require("../http");
const { P, fail, key, read, audit, getProfile, requireProfile, assertNotSuspended, publicProfile, profilesByUid } = require("./core");
const { postCard } = require("./posts");
const { notifyUsers } = require("../notify");
const {
  canTransition, orderRef, commissionOf, waveCheckoutUrl, cleanLine, PAYMENT_METHODS, PAYMENT_REF_MAX,
  ORDER_LABELS, fcfa, entitlementActive,
} = require("../../lib/asrarChat/logic");
const { NOTIF_TYPES } = require("../../lib/notifyTemplates");

const OPEN = ["pending", "declared", "rejected", "disputed"];

const hash = (v) => crypto.createHash("sha256").update(String(v)).digest("hex").slice(0, 40);

async function notify(db, uid, title, body, oid) {
  await notifyUsers(db, [uid], {
    type: NOTIF_TYPES.ASRAR_CHAT_ORDER, title, body, senderName: "Asrar-chat",
    targetUrl: "/asrar-chat?o=" + oid, meta: { tagSuffix: oid },
  }, { eventId: "ac-order:" + oid + ":" + title + ":" + Date.now() }).catch(() => {});
}

// Numéro WhatsApp du vendeur : celui renseigné pour WhatsApp, sinon son
// numéro Wave (souvent le même au Sénégal).
function sellerWhatsapp(s) {
  return s.whatsapp || s.wavePhone || "";
}

function instructions(order, seller) {
  const s = (seller && seller.seller) || {};
  const out = { ref: order.ref, amount: order.amount, method: order.method };
  const what = `« ${order.postTitle} » (${fcfa(order.amount)}), commande ${order.ref} sur Asrar-chat`;
  let text = `Assalamou aleykoum, je souhaite acheter ${what}.`;
  if (order.method === "wave") {
    // Lien Wave Business : paiement direct, montant prérempli. Sinon le
    // vendeur est contacté sur WhatsApp pour le paiement Wave.
    out.waveUrl = waveCheckoutUrl(s.waveLink, order.amount);
    text = out.waveUrl
      ? `Assalamou aleykoum, je viens de payer par Wave ${what}.`
      : `Assalamou aleykoum, je souhaite payer par Wave ${what}. Comment dois-je procéder ?`;
  }
  if (order.method === "pispi") {
    out.pispiAlias = s.pispiAlias || "";
    text = `Assalamou aleykoum, je paie par PI-SPI ${what}.`;
  }
  const phone = sellerWhatsapp(s);
  if (phone) out.whatsappUrl = "https://api.whatsapp.com/send?phone=" + phone + "&text=" + encodeURIComponent(text);
  return out;
}

async function uniqueRef(db, oid) {
  for (let i = 0; i < 5; i++) {
    const ref = orderRef(crypto.randomBytes(8));
    const tx = await db.ref("ac_order_refs/" + ref).transaction((cur) => (cur ? undefined : oid));
    if (tx.committed) return ref;
  }
  fail(503, "Impossible de créer la référence de commande. Réessayez.");
}

async function createOrder(db, user, body) {
  await requireProfile(db, user);
  await assertNotSuspended(db, user.uid);
  const pid = key(body.pid, "Publication");
  const method = PAYMENT_METHODS.includes(body.method) ? body.method : "";
  if (!method) fail(400, "Choisissez un moyen de paiement.");
  const post = await read(db, P.posts + "/" + pid);
  if (!post || post.status !== "published") fail(404, "Publication indisponible.");
  const amount = Math.round(Number(post.price) || 0);
  if (!(amount > 0)) fail(400, "Cette publication est gratuite.");
  if (post.sellerUid === user.uid) fail(400, "Vous êtes l'auteur de cette publication.");
  if (await read(db, P.suspended + "/" + post.sellerUid)) fail(409, "Ce vendeur n'accepte pas de commande pour le moment.");
  if (await read(db, `${P.blocks}/${post.sellerUid}/${user.uid}`)) fail(403, "Ce vendeur n'accepte pas vos commandes.");
  if (entitlementActive(await read(db, `${P.entitlements}/${user.uid}/${pid}`), Date.now())) fail(409, "Vous avez déjà accès à ce contenu.");
  const seller = await getProfile(db, post.sellerUid);
  const s = (seller && seller.seller) || {};
  if (!s.enabled) fail(409, "Ce vendeur n'accepte pas de paiement pour le moment.");
  const available = { wave: !!(s.waveLink || s.wavePhone), pispi: !!s.pispiAlias, whatsapp: !!sellerWhatsapp(s) };
  if (!available[method]) fail(400, "Ce moyen de paiement n'est pas proposé par le vendeur.");

  // Une seule commande ouverte par acheteur et par publication (pas de doublon).
  const mine = (await read(db, `${P.buyerOrders}/${user.uid}`)) || {};
  for (const oid of Object.keys(mine).filter(isValidKey)) {
    const o = await read(db, P.orders + "/" + oid);
    if (o && o.postId === pid && OPEN.includes(o.status)) {
      if (o.status === "pending" && o.method !== method) {
        await db.ref(P.orders + "/" + oid).update({ method, updatedAt: Date.now() });
        o.method = method;
      }
      return { order: { id: oid, ref: o.ref, status: o.status, method: o.method, amount: o.amount }, pay: instructions(o, seller) };
    }
  }

  const oid = db.ref(P.orders).push().key;
  const ref = await uniqueRef(db, oid);
  const rate = Number(await read(db, P.settings + "/commissionRate")) || 0;
  const now = Date.now();
  const order = {
    ref, postId: pid, postTitle: post.title, buyerUid: user.uid, sellerUid: post.sellerUid, amount, method,
    status: "pending", commissionRate: rate, commission: commissionOf(amount, rate), accessDays: Number(post.accessDays) || 0,
    createdAt: now, updatedAt: now,
    history: { h0: { at: now, by: user.uid, role: "buyer", status: "pending" } },
  };
  await db.ref().update({
    [`${P.orders}/${oid}`]: order,
    [`${P.buyerOrders}/${user.uid}/${oid}`]: now,
    [`${P.sellerOrders}/${post.sellerUid}/${oid}`]: now,
  });
  await audit(db, user.uid, "order.create", { oid, ref, pid, amount, method });
  return { order: { id: oid, ref, status: "pending", method, amount }, pay: instructions(order, seller) };
}

async function roleOn(db, user, order, isAdmin) {
  if (order.buyerUid === user.uid) return "buyer";
  if (order.sellerUid === user.uid) return "seller";
  if (isAdmin) return "admin";
  fail(403, "Cette commande ne vous concerne pas.");
}

// Changement d'état atomique : la transaction garantit qu'un double clic ou
// deux confirmations simultanées n'accordent l'accès qu'une seule fois.
async function transition(db, user, oid, to, isAdmin, extra = {}) {
  const order = await read(db, P.orders + "/" + oid);
  if (!order) fail(404, "Commande introuvable.");
  const role = await roleOn(db, user, order, isAdmin);
  // L'administration agit aussi sur les commandes où elle est partie prenante.
  const effective = canTransition(role, order.status, to) ? role : isAdmin && canTransition("admin", order.status, to) ? "admin" : null;
  if (!effective) fail(409, `Action impossible : la commande est « ${ORDER_LABELS[order.status] || order.status} ».`);
  const now = Date.now();
  let from = null;
  const tx = await db.ref(P.orders + "/" + oid).transaction((cur) => {
    // Premier passage possible sur le cache local vide (null) : Firebase
    // relance alors avec la valeur du serveur.
    if (cur === null) return null;
    if (cur.status !== order.status) return undefined;
    from = cur.status;
    const history = { ...(cur.history || {}) };
    history["h" + Object.keys(history).length] = { at: now, by: user.uid, role: effective, status: to, ...(extra.note ? { note: extra.note } : {}) };
    return { ...cur, ...extra.fields, status: to, updatedAt: now, history };
  });
  if (!tx.committed || !tx.snapshot.val()) fail(409, "La commande vient d'être modifiée. Actualisez.");
  return { order: tx.snapshot.val(), role: effective, from };
}

async function grant(db, oid, order) {
  const now = Date.now();
  const days = Number(order.accessDays) || 0;
  await db.ref(`${P.entitlements}/${order.buyerUid}/${order.postId}`).set({
    orderId: oid, grantedAt: now, expiresAt: days ? now + days * 86_400_000 : 0,
  });
  await db.ref(`${P.posts}/${order.postId}/stats/sales`).transaction((n) => (Number(n) || 0) + 1);
  await db.ref(`${P.profiles}/${order.sellerUid}/stats/sales`).transaction((n) => (Number(n) || 0) + 1);
}

async function revoke(db, order) {
  await db.ref(`${P.entitlements}/${order.buyerUid}/${order.postId}`).update({ revoked: true, revokedAt: Date.now() });
  await db.ref(`${P.posts}/${order.postId}/stats/sales`).transaction((n) => Math.max(0, (Number(n) || 0) - 1));
  await db.ref(`${P.profiles}/${order.sellerUid}/stats/sales`).transaction((n) => Math.max(0, (Number(n) || 0) - 1));
}

async function declarePaid(db, user, body) {
  const oid = key(body.oid, "Commande");
  const paymentRef = cleanLine(body.paymentRef, PAYMENT_REF_MAX);
  if (paymentRef.length < 4) fail(400, "Indiquez la référence de transaction reçue par SMS ou dans l'application de paiement.");
  const order = await read(db, P.orders + "/" + oid);
  if (!order || order.buyerUid !== user.uid) fail(404, "Commande introuvable.");
  // Une même référence de transaction ne peut servir qu'une fois par vendeur.
  const refKey = `ac_payment_refs/${order.sellerUid}/${hash(paymentRef.toUpperCase())}`;
  const used = await read(db, refKey);
  const refReused = !!(used && used !== oid);
  const { order: next } = await transition(db, user, oid, "declared", false, { fields: { paymentRef, refReused, declaredAt: Date.now() } });
  if (!used) await db.ref(refKey).set(oid);
  await notify(db, order.sellerUid, "Paiement à vérifier", `${next.ref} : ${fcfa(next.amount)} pour « ${next.postTitle} ». Vérifiez la réception avant de confirmer.`, oid);
  await audit(db, user.uid, "order.declared", { oid, refReused });
  return { ok: true, status: "declared" };
}

async function confirmPaid(db, user, body, isAdmin) {
  const oid = key(body.oid, "Commande");
  if (body.checked !== true) fail(400, "Confirmez avoir vérifié la réception effective du paiement.");
  const { order, role } = await transition(db, user, oid, "paid", isAdmin, { fields: { paidAt: Date.now(), confirmedBy: user.uid } });
  await grant(db, oid, order);
  await notify(db, order.buyerUid, "Contenu déverrouillé", `« ${order.postTitle} » est disponible dans vos achats.`, oid);
  await audit(db, user.uid, "order.paid", { oid, ref: order.ref, amount: order.amount, role });
  return { ok: true, status: "paid" };
}

async function rejectPaid(db, user, body, isAdmin) {
  const oid = key(body.oid, "Commande");
  const note = cleanLine(body.note, 200) || "Paiement non reçu";
  const { order, role } = await transition(db, user, oid, "rejected", isAdmin, { note });
  await notify(db, order.buyerUid, "Paiement non reçu", `${order.ref} : ${note}. Vous pouvez corriger la référence ou ouvrir un litige.`, oid);
  await audit(db, user.uid, "order.rejected", { oid, role });
  return { ok: true, status: "rejected" };
}

async function cancelOrder(db, user, body, isAdmin) {
  const oid = key(body.oid, "Commande");
  const { order, role } = await transition(db, user, oid, "cancelled", isAdmin, { note: cleanLine(body.note, 200) || undefined });
  if (role === "admin") await notify(db, order.buyerUid, "Commande annulée", `${order.ref} a été annulée par l'administration.`, oid);
  await audit(db, user.uid, "order.cancelled", { oid, role });
  return { ok: true, status: "cancelled" };
}

async function openDispute(db, user, body) {
  const oid = key(body.oid, "Commande");
  const note = cleanLine(body.note, 500);
  if (note.length < 10) fail(400, "Décrivez le problème (10 caractères minimum).");
  const { order } = await transition(db, user, oid, "disputed", false, { note, fields: { disputedAt: Date.now(), disputeFrom: (await read(db, P.orders + "/" + oid)).status } });
  await notify(db, order.sellerUid, "Litige ouvert", `${order.ref} : l'acheteur a ouvert un litige. L'administration va l'examiner.`, oid);
  await audit(db, user.uid, "order.disputed", { oid });
  return { ok: true, status: "disputed" };
}

async function refundOrder(db, user, body, isAdmin) {
  const oid = key(body.oid, "Commande");
  const note = cleanLine(body.note, 300) || "Remboursement";
  const before = await read(db, P.orders + "/" + oid);
  const { order, role } = await transition(db, user, oid, "refunded", isAdmin, { note, fields: { refundedAt: Date.now() } });
  // L'accès n'existait que si la commande avait été payée.
  if (before && (before.status === "paid" || before.paidAt)) await revoke(db, order);
  await notify(db, order.buyerUid, "Commande remboursée", `${order.ref} : ${note}.`, oid);
  await audit(db, user.uid, "order.refunded", { oid, role });
  return { ok: true, status: "refunded" };
}

// Litige tranché par l'administration : accès accordé, remboursé, ou annulé.
async function resolveDispute(db, user, body, isAdmin) {
  if (!isAdmin) fail(403, "Réservé à l'administration.");
  const decision = body.decision;
  if (decision === "paid") return confirmPaid(db, user, { ...body, checked: true }, true);
  if (decision === "refunded") return refundOrder(db, user, body, true);
  if (decision === "cancelled") return cancelOrder(db, user, body, true);
  fail(400, "Décision invalide.");
}

function orderOut(id, o, role, profiles) {
  const out = {
    id, ref: o.ref, postId: o.postId, postTitle: o.postTitle, amount: o.amount, method: o.method, status: o.status,
    createdAt: o.createdAt, updatedAt: o.updatedAt, paidAt: o.paidAt || 0, paymentRef: o.paymentRef || "",
    refReused: !!o.refReused, commission: Number(o.commission) || 0, role,
    history: Object.values(o.history || {}).sort((a, b) => a.at - b.at).map((h) => ({ at: h.at, role: h.role, status: h.status, note: h.note || "" })),
  };
  if (profiles) {
    out.buyer = profiles[o.buyerUid] || null;
    out.seller = profiles[o.sellerUid] || null;
  }
  return out;
}

async function loadOrders(db, index) {
  const ids = Object.keys(index || {}).filter(isValidKey).sort((a, b) => index[b] - index[a]).slice(0, 200);
  const rows = await Promise.all(ids.map(async (id) => [id, await read(db, P.orders + "/" + id)]));
  return rows.filter(([, o]) => o);
}

async function myOrders(db, user) {
  const rows = await loadOrders(db, await read(db, `${P.buyerOrders}/${user.uid}`));
  const profiles = await profilesByUid(db, rows.map(([, o]) => o.sellerUid));
  const sellers = {};
  for (const [, o] of rows) if (!sellers[o.sellerUid]) sellers[o.sellerUid] = await getProfile(db, o.sellerUid);
  return {
    orders: rows.map(([id, o]) => ({
      ...orderOut(id, o, "buyer", profiles),
      ...(["pending", "rejected"].includes(o.status) ? { pay: instructions(o, sellers[o.sellerUid]) } : {}),
    })),
  };
}

async function getOrder(db, user, body, isAdmin) {
  const oid = key(body.oid, "Commande");
  const o = await read(db, P.orders + "/" + oid);
  if (!o) fail(404, "Commande introuvable.");
  const role = await roleOn(db, user, o, isAdmin);
  const profiles = await profilesByUid(db, [o.buyerUid, o.sellerUid]);
  const out = orderOut(oid, o, role, profiles);
  if (role === "buyer" && ["pending", "rejected"].includes(o.status)) out.pay = instructions(o, await getProfile(db, o.sellerUid));
  return { order: out };
}

async function sales(db, user) {
  const rows = await loadOrders(db, await read(db, `${P.sellerOrders}/${user.uid}`));
  const profiles = await profilesByUid(db, rows.map(([, o]) => o.buyerUid));
  const since30 = Date.now() - 30 * 86_400_000;
  const summary = { gross: 0, gross30: 0, commissionDue: 0, salesCount: 0, toVerify: 0, disputes: 0, refunded: 0 };
  for (const [, o] of rows) {
    if (o.status === "paid") {
      summary.gross += o.amount; summary.salesCount++; summary.commissionDue += Number(o.commission) || 0;
      if ((o.paidAt || 0) >= since30) summary.gross30 += o.amount;
    }
    if (o.status === "declared" || o.status === "pending") summary.toVerify += o.status === "declared" ? 1 : 0;
    if (o.status === "disputed") summary.disputes++;
    if (o.status === "refunded") summary.refunded += o.amount;
  }
  summary.net = summary.gross - summary.commissionDue;
  return { summary, orders: rows.map(([id, o]) => orderOut(id, o, "seller", profiles)) };
}

async function library(db, user) {
  const ents = (await read(db, `${P.entitlements}/${user.uid}`)) || {};
  const now = Date.now();
  const ids = Object.keys(ents).filter(isValidKey).sort((a, b) => (ents[b].grantedAt || 0) - (ents[a].grantedAt || 0));
  const cards = await Promise.all(ids.map(async (pid) => {
    const card = await postCard(db, pid, user.uid);
    if (!card || card.unavailable) return null;
    return { ...card, grantedAt: ents[pid].grantedAt || 0, expiresAt: Number(ents[pid].expiresAt) || 0, active: entitlementActive(ents[pid], now), revoked: !!ents[pid].revoked };
  }));
  return { items: cards.filter((c) => c && !c.revoked) };
}

module.exports = {
  createOrder, declarePaid, confirmPaid, rejectPaid, cancelOrder, openDispute, refundOrder, resolveDispute,
  myOrders, getOrder, sales, library, orderOut, OPEN, publicProfile,
};
