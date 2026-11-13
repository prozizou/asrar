// server/asrarChat/moderation.js — Signalements et administration.
//
// Modération des contenus privés : l'administration ne lit JAMAIS une
// discussion privée de sa propre initiative. Un signalement joint une copie
// du seul élément signalé (message, publication, profil), que l'administration
// examine ; elle peut alors supprimer l'élément, retirer la publication ou
// suspendre le compte. Chaque décision est journalisée (ac_audit).
const { isValidKey } = require("../http");
const { P, fail, key, read, audit, requireProfile, profilesByUid, publicProfile, getProfile } = require("./core");
const { deliver } = require("./media");
const { orderOut } = require("./orders");
const { REPORT_REASONS, REPORT_TARGETS, cleanLine, COMMISSION_MAX } = require("../../lib/asrarChat/logic");
const { notifyUsers } = require("../notify");
const { NOTIF_TYPES } = require("../../lib/notifyTemplates");

function requireAdmin(isAdmin) {
  if (!isAdmin) fail(403, "Réservé à l'administration.");
}

async function report(db, user, body) {
  await requireProfile(db, user);
  const target = REPORT_TARGETS.includes(body.target) ? body.target : "";
  if (!target) fail(400, "Élément à signaler invalide.");
  const reason = REPORT_REASONS.some((r) => r.id === body.reason) ? body.reason : "";
  if (!reason) fail(400, "Choisissez un motif.");
  const note = cleanLine(body.note, 500);
  const entry = { target, reason, note, reporterUid: user.uid, at: Date.now(), status: "open" };
  if (target === "user") {
    entry.uid = key(body.uid, "Profil");
  } else if (target === "post") {
    entry.pid = key(body.pid, "Publication");
    const post = await read(db, P.posts + "/" + entry.pid);
    if (!post) fail(404, "Publication introuvable.");
    entry.uid = post.sellerUid;
    entry.snapshot = { title: post.title, description: post.description || "", price: post.price || 0 };
  } else if (target === "message") {
    entry.cid = key(body.cid, "Discussion");
    entry.mid = key(body.mid, "Message");
    // Seul un participant peut signaler un message (il le voit déjà).
    const member = await read(db, `${P.members}/${entry.cid}/${user.uid}`);
    const conv = await read(db, `${P.convs}/${entry.cid}`);
    if (!member && !(conv && conv.visibility === "public")) fail(403, "Discussion privée.");
    const msg = await read(db, `${P.messages}/${entry.cid}/${entry.mid}`);
    if (!msg || msg.deleted) fail(404, "Message introuvable.");
    entry.uid = msg.uid;
    entry.snapshot = { text: msg.text || "", ...(msg.asset ? { asset: msg.asset } : {}), ...(msg.postId ? { postId: msg.postId } : {}), at: msg.at };
  } else if (target === "conv") {
    entry.cid = key(body.cid, "Discussion");
    const conv = await read(db, `${P.convs}/${entry.cid}`);
    if (!conv) fail(404, "Discussion introuvable.");
    entry.uid = conv.ownerUid;
    entry.snapshot = { title: conv.title || "", about: conv.about || "", type: conv.type };
  }
  if (entry.uid === user.uid) fail(400, "Vous ne pouvez pas vous signaler vous-même.");
  // Un même compte ne signale pas deux fois le même élément.
  const dedupe = [target, entry.uid, entry.pid || "", entry.cid || "", entry.mid || "", user.uid].join(":");
  const tx = await db.ref("ac_report_keys/" + Buffer.from(dedupe).toString("base64url").slice(0, 700)).transaction((cur) => (cur ? undefined : Date.now()));
  if (!tx.committed) return { ok: true, duplicate: true };
  await db.ref(P.reports).push(entry);
  return { ok: true };
}

async function adminOverview(db, user, isAdmin) {
  requireAdmin(isAdmin);
  const [profiles, posts, orders, reports, suspended, settings] = await Promise.all([
    read(db, P.profiles), read(db, P.posts), read(db, P.orders), read(db, P.reports), read(db, P.suspended), read(db, P.settings),
  ]);
  const stats = {
    users: Object.keys(profiles || {}).length,
    sellers: Object.values(profiles || {}).filter((p) => p && p.seller && p.seller.enabled).length,
    posts: Object.values(posts || {}).filter((p) => p && p.status === "published").length,
    paidPosts: Object.values(posts || {}).filter((p) => p && p.status === "published" && Number(p.price) > 0).length,
    sales: 0, volume: 0, commission: 0, disputes: 0, toVerify: 0,
    openReports: Object.values(reports || {}).filter((r) => r && r.status === "open").length,
    suspended: Object.keys(suspended || {}).length,
  };
  const bySeller = {};
  for (const o of Object.values(orders || {})) {
    if (!o) continue;
    if (o.status === "paid") {
      stats.sales++; stats.volume += o.amount; stats.commission += Number(o.commission) || 0;
      const s = (bySeller[o.sellerUid] = bySeller[o.sellerUid] || { sales: 0, volume: 0, commission: 0 });
      s.sales++; s.volume += o.amount; s.commission += Number(o.commission) || 0;
    }
    if (o.status === "disputed") stats.disputes++;
    if (o.status === "declared") stats.toVerify++;
  }
  const top = Object.entries(bySeller).sort(([, a], [, b]) => b.volume - a.volume).slice(0, 30);
  const sellerProfiles = await profilesByUid(db, top.map(([uid]) => uid));
  return {
    stats,
    commissionRate: Number(settings && settings.commissionRate) || 0,
    sellers: top.map(([uid, s]) => ({ ...(sellerProfiles[uid] || { uid }), ...s })),
  };
}

async function adminReports(db, user, body, isAdmin) {
  requireAdmin(isAdmin);
  const snap = await db.ref(P.reports).orderByChild("status").equalTo(body.status === "closed" ? "closed" : "open").limitToLast(100).once("value");
  const rows = [];
  snap.forEach((child) => { rows.push([child.key, child.val()]); });
  const profiles = await profilesByUid(db, rows.flatMap(([, r]) => [r.uid, r.reporterUid]));
  return {
    reports: rows.reverse().map(([id, r]) => ({
      id, target: r.target, reason: r.reason, note: r.note || "", at: r.at, status: r.status, decision: r.decision || "",
      pid: r.pid || "", cid: r.cid || "", mid: r.mid || "",
      user: profiles[r.uid] || { uid: r.uid }, reporter: profiles[r.reporterUid] || { uid: r.reporterUid },
      snapshot: r.snapshot ? { ...r.snapshot, ...(r.snapshot.asset ? { media: deliver(r.snapshot.asset), asset: undefined } : {}) } : null,
    })),
  };
}

async function suspend(db, admin, uid, reason) {
  await db.ref(P.suspended + "/" + uid).set({ at: Date.now(), by: admin.uid, reason: cleanLine(reason, 200) });
  await notifyUsers(db, [uid], {
    type: NOTIF_TYPES.ASRAR_CHAT, title: "Compte Asrar-chat suspendu",
    body: "Votre compte a été suspendu à la suite d'un signalement. Contactez l'administration.", senderName: "ASRAR PRO", targetUrl: "/asrar-chat",
  }, { eventId: "ac-suspend:" + uid + ":" + Date.now() }).catch(() => {});
}

async function resolveReport(db, user, body, isAdmin) {
  requireAdmin(isAdmin);
  const rid = key(body.rid, "Signalement");
  const r = await read(db, P.reports + "/" + rid);
  if (!r) fail(404, "Signalement introuvable.");
  const decision = ["dismiss", "removeContent", "suspend", "removeAndSuspend"].includes(body.decision) ? body.decision : "";
  if (!decision) fail(400, "Décision invalide.");
  if (decision === "removeContent" || decision === "removeAndSuspend") {
    if (r.target === "post" && r.pid) await db.ref(P.posts + "/" + r.pid).update({ status: "removed", removedAt: Date.now() });
    if (r.target === "message" && r.cid && r.mid) await db.ref(`${P.messages}/${r.cid}/${r.mid}`).set({ uid: r.uid, at: r.snapshot?.at || Date.now(), deleted: true, deletedBy: "admin" });
    if (r.target === "conv" && r.cid) await db.ref(`${P.convs}/${r.cid}/removed`).set(true);
  }
  if ((decision === "suspend" || decision === "removeAndSuspend") && isValidKey(r.uid)) await suspend(db, user, r.uid, r.reason);
  await db.ref(P.reports + "/" + rid).update({ status: "closed", decision, decidedBy: user.uid, decidedAt: Date.now() });
  await audit(db, user.uid, "report.resolve", { rid, decision, target: r.target, uid: r.uid });
  return { ok: true };
}

async function setSuspended(db, user, body, isAdmin) {
  requireAdmin(isAdmin);
  const uid = key(body.uid, "Profil");
  if (body.suspended === false) await db.ref(P.suspended + "/" + uid).remove();
  else await suspend(db, user, uid, body.reason || "Décision de l'administration");
  await audit(db, user.uid, body.suspended === false ? "user.unsuspend" : "user.suspend", { uid });
  return { ok: true };
}

async function setCommission(db, user, body, isAdmin) {
  requireAdmin(isAdmin);
  const rate = Number(body.rate);
  if (!(rate >= 0 && rate <= COMMISSION_MAX)) fail(400, `Taux invalide (0 à ${COMMISSION_MAX} %).`);
  await db.ref(P.settings + "/commissionRate").set(Math.round(rate * 10) / 10);
  await audit(db, user.uid, "settings.commission", { rate });
  return { ok: true };
}

async function adminOrders(db, user, body, isAdmin) {
  requireAdmin(isAdmin);
  const status = ["disputed", "declared", "pending", "paid", "refunded"].includes(body.status) ? body.status : "disputed";
  const snap = await db.ref(P.orders).orderByChild("status").equalTo(status).limitToLast(100).once("value");
  const rows = [];
  snap.forEach((child) => { rows.push([child.key, child.val()]); });
  const profiles = await profilesByUid(db, rows.flatMap(([, o]) => [o.buyerUid, o.sellerUid]));
  return { orders: rows.reverse().map(([id, o]) => orderOut(id, o, "admin", profiles)) };
}

async function adminUsers(db, user, body, isAdmin) {
  requireAdmin(isAdmin);
  const q = cleanLine(body.q, 40).toLowerCase().replace(/^@/, "");
  const suspended = (await read(db, P.suspended)) || {};
  let rows = [];
  if (q) {
    const snap = await db.ref(P.profiles).orderByChild("handle").startAt(q).endAt(q + "").limitToFirst(30).once("value");
    snap.forEach((child) => { rows.push([child.key, child.val()]); });
  } else {
    for (const uid of Object.keys(suspended).slice(0, 50)) rows.push([uid, await getProfile(db, uid)]);
  }
  return {
    users: rows.filter(([, p]) => p).map(([uid, p]) => ({ ...publicProfile(uid, p), suspended: !!suspended[uid], suspendedReason: suspended[uid]?.reason || "" })),
  };
}

async function adminAudit(db, user, isAdmin) {
  requireAdmin(isAdmin);
  const snap = await db.ref(P.audit).orderByChild("at").limitToLast(100).once("value");
  const rows = [];
  snap.forEach((child) => { rows.push({ id: child.key, ...child.val() }); });
  return { entries: rows.reverse() };
}

module.exports = { report, adminOverview, adminReports, resolveReport, setSuspended, setCommission, adminOrders, adminUsers, adminAudit };
