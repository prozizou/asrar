const { effectiveAccess } = require("../lib/accessStatus");

function reminderPurchase(stored, allowed, now) {
  const access = effectiveAccess(stored, allowed, now);
  const expiresAt = access.allowed ? access.expiresAt : Math.max(
    typeof stored.expiresAt === "number" ? stored.expiresAt : 0,
    Number(stored.referralAccess?.expiresAt) || 0);
  return { purchase: { ...stored, expiresAt: expiresAt || null }, allowed: access.allowed };
}

async function notificationIsCurrent(db, notification, now) {
  if (notification.expiresAt != null && notification.expiresAt <= now) return false;
  const reminder = notification.meta?.reminder;
  if (!reminder) return true;
  if (reminder.kind === "session") {
    const group = (await db.ref(`zikr_groups/${reminder.gid}`).once("value")).val();
    return !!group && group.sessionAt === reminder.sessionAt;
  }
  const [purchase, allowed] = await Promise.all([
    db.ref(`purchased_user/${reminder.emailKey}`).once("value"),
    db.ref(`allowedUsers/${reminder.emailKey}`).once("value"),
  ]);
  const current = reminderPurchase(purchase.val() || {}, allowed.val(), now);
  return current.purchase.expiresAt === reminder.expiresAt &&
    (reminder.kind === "renewal" ? current.allowed : !current.allowed);
}

module.exports = { notificationIsCurrent, reminderPurchase };
