const webpush = require("web-push");
const { app } = require("./grant");
const { sendWebPush } = require("./webPush");
const { storeNotification } = require("./notificationStore");
const { ackDelivery, failDevice, updateOwned, MAX_ATTEMPTS } = require("./notificationQueue");
const { channelIdForNotifType, channelById } = require("../lib/pushChannels");

async function mapBounded(values, max, action) {
  let index = 0;
  const errors = [];
  const results = await Promise.allSettled(Array.from({ length: Math.min(max, values.length) }, async () => {
    while (index < values.length) {
      try { await action(values[index++]); }
      catch (error) { errors.push(error); }
    }
  }));
  if (errors.length) throw errors[0];
  const failed = results.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
}

function vapidReady() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const secret = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!pub || !secret || !subject) return false;
  webpush.setVapidDetails(subject, pub, secret);
  return true;
}

async function deliverNotification(db, job, { now = Date.now } = {}) {
  const notif = job.notification;
  if (!job.progress?.inApp) {
    await storeNotification(db, job.uid, notif, job.notificationId);
    await ackDelivery(db, job, "inApp");
  }
  const [webSnap, fcmSnap] = await Promise.all([
    db.ref(`push_subscriptions/${job.uid}`).orderByChild("updatedAt").limitToLast(10).once("value"),
    db.ref(`fcm_devices/${job.uid}`).orderByChild("updatedAt").limitToLast(10).once("value"),
  ]);
  const targets = [];
  webSnap.forEach((child) => {
    if (!job.progress?.web?.[child.key]) targets.push({ channel: "web", key: child.key, value: child.val() });
  });
  fcmSnap.forEach((child) => {
    const device = child.val();
    if (device?.enabled !== false && !job.progress?.fcm?.[child.key]) targets.push({ channel: "fcm", key: child.key, value: device });
  });
  const tag = notif.type + (notif.meta?.tagSuffix ? ":" + notif.meta.tagSuffix : "");
  const payload = JSON.stringify({ title: notif.title, body: notif.body, url: notif.targetUrl, tag });
  // Limiter aussi le stockage chez le fournisseur lorsqu'un appareil est hors ligne.
  const ttlMs = Math.max(0, Math.min(86400000, notif.expiresAt == null ? 86400000 : notif.expiresAt - now()));
  const eligible = targets.filter((target) => {
    const failure = job.progress?.failures?.[target.channel]?.[target.key];
    return !failure || (failure.attempts < MAX_ATTEMPTS && failure.availableAt <= now());
  });
  // Deux appareils au plus par passage, même si le compte en possède dix.
  await mapBounded(eligible.slice(0, 2), 2, async (target) => {
    try {
      // FCM n'a pas d'émulateur. Les tests d'intégration ne doivent jamais
      // appeler Google ni un vrai fournisseur push, même avec un jeton semé.
      if (process.env.FIREBASE_TEST_MODE === "true") throw Object.assign(new Error("Push externe désactivé dans les émulateurs."), { code: "EMULATOR_PUSH_DISABLED" });
      if (target.channel === "web") {
        // Une configuration Web incorrecte ne bloque jamais FCM.
        if (!vapidReady()) throw Object.assign(new Error("Configuration VAPID absente."), { code: "VAPID_NOT_CONFIGURED" });
        await sendWebPush(target.value, payload, { TTL: Math.floor(ttlMs / 1000) });
      } else {
        const channelId = channelIdForNotifType(notif.type);
        const channel = channelById(channelId);
        await app().messaging().send({
          token: target.value.token, notification: { title: notif.title, body: notif.body },
          data: { url: notif.targetUrl, type: notif.type, tag },
          android: { ttl: ttlMs, priority: channel.importance >= 4 ? "high" : "normal",
            notification: { channelId, tag, sound: "asrar_notification.mp3", icon: "ic_stat_asrar", color: "#A78BFA" } },
        });
      }
    } catch (error) {
      const code = error?.errorInfo?.code || error?.code;
      const expired = target.channel === "web" ? [404, 410].includes(error?.statusCode)
        : ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(code);
      if (expired) {
        const base = target.channel === "web" ? "push_subscriptions" : "fcm_devices";
        await db.ref(`${base}/${job.uid}/${target.key}`).transaction((current) => {
          if (!current) return null;
          // Ne pas supprimer de nouvelles clés enregistrées pendant l'envoi.
          const same = target.channel === "fcm" ? current.token === target.value.token :
            current.endpoint === target.value.endpoint && current.keys?.p256dh === target.value.keys?.p256dh &&
            current.keys?.auth === target.value.keys?.auth;
          return same ? null : undefined;
        });
        await ackDelivery(db, job, target.channel, target.key);
      } else await failDevice(db, job, target.channel, target.key, error, now());
      return;
    }
    // Une panne de persistance n'est pas une erreur du fournisseur push.
    await ackDelivery(db, job, target.channel, target.key);
  });
  const current = await updateOwned(db, job.id, job.owner, (value) => value);
  const remaining = targets.filter((target) => !current.progress?.[target.channel]?.[target.key]);
  const active = remaining.filter((target) =>
    (current.progress?.failures?.[target.channel]?.[target.key]?.attempts || 0) < MAX_ATTEMPTS);
  return { pending: active.length > 0, dead: remaining.length > 0 && active.length === 0,
    availableAt: active.length ? Math.min(...active.map((target) =>
      Math.max(now(), current.progress?.failures?.[target.channel]?.[target.key]?.availableAt || 0))) : null };
}

module.exports = { deliverNotification, mapBounded };
