const { emailKey } = require("./access");
const { publicOrder } = require("./orderStore");

async function accountSummary(db, user, authUser, access) {
  const [settings, manual, request] = await Promise.all([
    db.ref("account_settings/" + user.uid).once("value"), db.ref("allowedUsers/" + emailKey(user.email)).once("value"),
    db.ref("privacy_requests/" + user.uid).once("value"),
  ]);
  const lastExpiry = Math.max(Number(access.purchase?.expiresAt) || 0, Number(access.purchase?.referralAccess?.expiresAt) || 0,
    typeof manual.val() === "number" ? manual.val() : Number(manual.val()?.until) || 0);
  return {
    account: { uid: user.uid, email: user.email, name: authUser.displayName || "", emailVerified: authUser.emailVerified,
      createdAt: authUser.metadata?.creationTime || null },
    subscription: { allowed: access.allowed, admin: access.admin, vip: access.vip, level: access.level === Infinity ? 999999 : access.level,
      expiresAt: access.expiresAt, lastExpiresAt: lastExpiry || null },
    settings: { analytics: settings.val()?.analytics === true, pushEnabled: settings.val()?.pushEnabled !== false },
    privacyRequest: request.val() || null,
  };
}

async function availableExport(db, user, summary) {
  const [orders, legacy, notifications, session] = await Promise.all([
    db.ref("orders_v2").orderByChild("buyerUid").equalTo(user.uid).limitToLast(501).once("value"),
    db.ref("orders/" + user.uid).orderByChild("at").limitToLast(501).once("value"),
    db.ref("notifications/" + user.uid).orderByChild("createdAt").limitToLast(200).once("value"),
    db.ref("user_sessions/" + user.uid).once("value"),
  ]);
  const items = [];
  orders.forEach((child) => {
    const order = publicOrder(child.key, child.val());
    order.history = Object.fromEntries(Object.entries(order.history || {}).map(([key, event]) =>
      [key, { status: event.status, at: event.at, role: event.role, paymentMode: event.paymentMode || null }]));
    items.push(order);
  });
  return { exportedAt: new Date().toISOString(), ...summary, orders: items.slice(0, 500), legacyRequests: Object.fromEntries(Object.entries(legacy.val() || {}).slice(0, 500)),
    notifications: notifications.val() || {}, session: session.val() || null,
    scope: "Compte, abonnement, réglages, demandes et commandes acheteur, notifications et dernière session. Les contenus partagés et historiques complémentaires sont disponibles sur demande.",
    truncated: orders.numChildren() > 500 || legacy.numChildren() > 500 };
}

async function requestPrivacy(db, user, kind) {
  if (!["export", "delete"].includes(kind)) throw Object.assign(new Error("Type de demande invalide."), { statusCode: 400 });
  const now = Date.now();
  const tx = await db.ref("privacy_requests/" + user.uid).transaction((current) => {
    if (current && ["pending", "processing"].includes(current.status)) return current;
    return { uid: user.uid, email: user.email, kind, status: "pending", requestedAt: now, updatedAt: now };
  });
  return tx.snapshot.val();
}

module.exports = { accountSummary, availableExport, requestPrivacy };
