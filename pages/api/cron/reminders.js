// Les marqueurs indiquent une mise en file durable, jamais un succès push.
// Les identifiants par session/échéance rendent les passages concurrents
// idempotents ; le worker conserve les accusés par appareil.
const { app } = require("../../../server/grant");
const { reportError } = require("../../../server/log");
const { authorized } = require("../../../server/cronAuth");
const { enqueueNotification } = require("../../../server/notificationQueue");
const { scheduleNotifications } = require("../../../server/notificationScheduler");
const { mapBounded } = require("../../../server/notificationTransport");
const { reminderPurchase } = require("../../../server/notificationValidity");
const {
  shouldSendSessionReminder, SESSION_GRACE_MS, RENEWAL_GRACE_DAYS,
  shouldSendRenewalReminder, shouldSendExpiredNotice, daysUntil, renewalWhatsAppUrl,
} = require("../../../lib/reminders");

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (!authorized(req)) return res.status(401).json({ error: "Non autorisé." });
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ error: "Méthode non autorisée." });
  res.setHeader("Cache-Control", "no-store");
  const db = app().database();
  const now = new Date();
  const stats = { sessionQueued: 0, sessionSkipped: 0, renewalQueued: 0, expiredQueued: 0, renewalNoAccount: 0 };
  try {
    await mapBounded([() => queueSessionReminders(db, now, stats), () => queueRenewalReminders(db, now, stats)], 2, (run) => run());
    await db.ref("cron_health/reminders").set({ at: Date.now(), ...stats });
    return res.status(200).json({ ok: true, ...stats });
  } catch (error) {
    await reportError("cron:reminders", error);
    return res.status(500).json({ error: "Préparation des rappels indisponible." });
  } finally {
    // Même après une panne partielle, les tâches déjà persistées peuvent partir.
    scheduleNotifications(db);
  }
}

async function queueSessionReminders(db, now, stats) {
  const snap = await db.ref("zikr_groups").once("value");
  const groups = [];
  snap.forEach((group) => { groups.push({ gid: group.key, value: group.val() || {} }); });
  await mapBounded(groups, 4, async ({ gid, value: group }) => {
    if (!shouldSendSessionReminder(group.sessionAt, group.sessionReminderSent === true, now)) {
      stats.sessionSkipped++;
      return;
    }
    const members = await db.ref(`zikr_members/${gid}`).once("value");
    const uids = new Set();
    members.forEach((member) => { uids.add(member.key); });
    if (group.ownerUid) uids.add(group.ownerUid);
    if (uids.size) {
      await enqueueNotification(db, { type: "users", uids: [...uids].sort() }, {
        type: "zikr_session", title: "🔔 " + (group.name || "Zikr collectif"),
        body: "Une session de ce zikr collectif commence bientôt.", targetUrl: `/zikr?item=${gid}`,
        expiresAt: Number(group.sessionAt) + SESSION_GRACE_MS,
        meta: { tagSuffix: gid, reminder: { kind: "session", gid, sessionAt: group.sessionAt } },
      }, `session:${gid}:${group.sessionAt}`);
    }
    // Ne jamais marquer une session reprogrammée pendant la mise en file.
    await db.ref(`zikr_groups/${gid}`).transaction((current) => {
      if (!current) return null;
      if (current.sessionAt !== group.sessionAt) return;
      return { ...current, sessionReminderSent: true };
    });
    stats.sessionQueued++;
  });
}

async function queueRenewalReminders(db, now, stats) {
  const [snap, allowedSnap] = await Promise.all([
    db.ref("purchased_user").once("value"), db.ref("allowedUsers").once("value"),
  ]);
  const allowed = allowedSnap.val() || {}, purchases = [];
  snap.forEach((doc) => { purchases.push({ key: doc.key, stored: doc.val() || {} }); });
  await mapBounded(purchases, 4, async ({ key, stored }) => {
    const { purchase } = reminderPurchase(stored, allowed[key], now.getTime());
    const reminder = shouldSendRenewalReminder(purchase, now);
    const expired = shouldSendExpiredNotice(purchase, now);
    if (!reminder && !expired) return;
    const email = key.replace(/,/g, ".");
    let user;
    try { user = await app().auth().getUserByEmail(email); }
    catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
      stats.renewalNoAccount++;
      return;
    }
    const kind = reminder ? "renewal" : "expired";
    const days = daysUntil(purchase.expiresAt, now);
    await enqueueNotification(db, { type: "users", uids: [user.uid] }, {
      type: kind,
      title: reminder ? "⏳ Votre abonnement expire bientôt" : "🔒 Votre abonnement a expiré",
      body: reminder ? `Il vous reste ${days} jour${days > 1 ? "s" : ""} — renouvelez pour garder votre accès à ASRAR PRO.` :
        "Votre accès premium ASRAR PRO a expiré. Renouvelez pour le retrouver.",
      targetUrl: renewalWhatsAppUrl({ email, expiresAt: purchase.expiresAt, expired: !reminder }),
      expiresAt: purchase.expiresAt + (reminder ? 0 : RENEWAL_GRACE_DAYS * 86400000),
      meta: { tagSuffix: kind, reminder: { kind, emailKey: key, expiresAt: purchase.expiresAt } },
    }, `${kind}:${key}:${purchase.expiresAt}`);
    await db.ref(`purchased_user/${key}`).update({
      [reminder ? "renewalReminderForExpiry" : "expiredNoticeForExpiry"]: purchase.expiresAt,
    });
    if (reminder) stats.renewalQueued++; else stats.expiredQueued++;
  });
}
