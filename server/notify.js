// server/notify.js — Notifications in-app + push, PARTAGÉES par les trois
// déclencheurs demandés (Secret publié, document publié, message Zikr
// collectif) et par tout futur type de notification.
//
// TROIS effets par appel, jamais l'un sans les autres :
//   1. Persistance in-app : notifications/{uid}/{id} = { type, title, body,
//      senderName, targetUrl, createdAt, read, meta? } + un compteur non-lu
//      dénormalisé (notifications_meta/{uid}/unread) — évite de recompter
//      toute la liste à chaque affichage du badge (pages/api/notifications.js
//      action="list" le renvoie tel quel).
//   2. Push Web (VAPID) best-effort (même infra que pages/api/zikr.js,
//      pages/api/cron/reminders.js, pages/api/cron/planet-push.js — dupliqué
//      une 4e fois ici plutôt que factorisé avec eux, même raisonnement que
//      pages/api/zikr.js : contextes d'appel trop différents pour partager
//      un seul point d'entrée sans complexifier chacun) : couvre le cas où
//      l'utilisateur n'a pas l'app au premier plan (navigateur/PWA).
//   3. Push FCM best-effort (fcm_devices/{uid}/{deviceId}, voir pages/api/
//      push-fcm-register.js et lib/fcmNative.js) : même déclencheurs, pour
//      les appareils où l'app est installée via la coquille Capacitor
//      (Android). Canal DISTINCT de (2) — un même utilisateur peut recevoir
//      les deux à la fois (navigateur ET app installée), chacun purgé
//      indépendamment si son jeton/abonnement devient invalide.
//
// Ni (2) ni (3) ne bloquent JAMAIS (1) — un push qui échoue (abonnement
// expiré, VAPID/FCM mal configuré) ne doit jamais faire perdre la
// notification elle-même. Écriture in-app TOUJOURS effectuée, même si VAPID
// et FCM sont tous deux absents — le centre de notifications (badge,
// historique) reste la source de vérité ; le push est un plus, pas une
// dépendance.

const webpush = require("web-push");
const { reportError } = require("./log");
const { app } = require("./grant");
const { channelIdForNotifType, channelById } = require("../lib/pushChannels");

// Nombre de notifications conservées par utilisateur (pages/api/notifications.js
// ne relit de toute façon que les N plus récentes) — purge légère à l'écriture
// plutôt qu'un cron de nettoyage séparé : un utilisateur actif n'accumule
// jamais un historique illimité, sans tâche planifiée supplémentaire à
// maintenir pour une première version.
const MAX_PER_USER = 200;

function configureVapid() {
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;
  if (!vapidPublic || !vapidPrivate || !vapidSubject) return false;
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  return true;
}

// Envoie `payload` à TOUS les abonnements push de `uid`, en nettoyant ceux
// devenus invalides (404/410) — même politique que les 3 autres copies de
// cette fonction dans le dépôt (voir en-tête).
async function sendPushToUid(db, uid, payload) {
  const subsSnap = await db.ref("push_subscriptions/" + uid).once("value");
  if (!subsSnap.exists()) return;
  const tasks = [];
  subsSnap.forEach((subSnap) => {
    const key = subSnap.key;
    const sub = subSnap.val() || {};
    if (!sub.endpoint || !sub.keys) return;
    tasks.push(
      webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload).catch(async (e) => {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) {
          await db.ref("push_subscriptions/" + uid + "/" + key).remove();
        } else {
          await reportError("notify:push", e, { uid });
        }
      })
    );
  });
  await Promise.all(tasks);
}

// Envoie `notif` (title/body/targetUrl/type — PAS le payload JSON du Web
// Push, FCM veut des champs structurés) à TOUS les appareils FCM de `uid`,
// en nettoyant ceux devenus invalides (jeton désinstallé/expiré) — même
// politique de purge que sendPushToUid(), codes d'erreur FCM équivalents
// aux 404/410 Web Push.
async function sendFcmToUid(db, uid, notif, tag) {
  const devicesSnap = await db.ref("fcm_devices/" + uid).once("value");
  if (!devicesSnap.exists()) return;

  const channelId = channelIdForNotifType(notif.type);
  const channel = channelById(channelId);
  const messaging = app().messaging();

  const tasks = [];
  devicesSnap.forEach((deviceSnap) => {
    const key = deviceSnap.key;
    const device = deviceSnap.val() || {};
    if (!device.token || device.enabled === false) return;
    tasks.push(
      messaging.send({
        token: device.token,
        notification: { title: notif.title, body: notif.body },
        data: { url: notif.targetUrl || "", type: notif.type || "", tag: tag || "" },
        android: {
          priority: channel.importance >= 4 ? "high" : "normal",
          notification: { channelId, sound: "asrar_notification.mp3" },
        },
      }).catch(async (e) => {
        const code = e && e.errorInfo && e.errorInfo.code;
        if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token" || code === "messaging/invalid-argument") {
          await db.ref("fcm_devices/" + uid + "/" + key).remove();
        } else {
          await reportError("notify:fcm", e, { uid });
        }
      })
    );
  });
  await Promise.all(tasks);
}

// Purge les plus anciennes notifications d'un utilisateur au-delà de
// MAX_PER_USER — appelée après chaque écriture, jamais bloquante pour
// l'appelant principal (voir notifyUsers).
async function pruneOldest(db, uid) {
  const snap = await db.ref("notifications/" + uid)
    .orderByChild("createdAt")
    .limitToLast(MAX_PER_USER + 1)
    .once("value");
  if (snap.numChildren() <= MAX_PER_USER) return;
  const keys = [];
  snap.forEach((c) => keys.push(c.key));
  const toRemove = keys.slice(0, keys.length - MAX_PER_USER);
  const updates = {};
  toRemove.forEach((k) => { updates[k] = null; });
  await db.ref("notifications/" + uid).update(updates);
}

/**
 * Notifie UN ensemble d'utilisateurs déjà identifiés par uid (message Zikr
 * collectif : les autres membres du groupe ; toute future notification
 * ciblée). Pure fan-out — pas de résolution d'audience ici, voir
 * notifyAllUsers() pour le cas « broadcast à tous les utilisateurs connus ».
 *
 * @param {import('firebase-admin').database.Database} db
 * @param {string[]} uids destinataires (dédoublonnés, sans le uid de l'auteur)
 * @param {{type:string, title:string, body:string, senderName?:string,
 *          targetUrl:string, meta?:object}} notif
 */
async function notifyUsers(db, uids, notif) {
  const targets = [...new Set(uids)].filter(Boolean);
  if (!targets.length) return;

  const createdAt = Date.now();
  const record = {
    type: notif.type,
    title: notif.title,
    body: notif.body,
    senderName: notif.senderName || null,
    targetUrl: notif.targetUrl,
    createdAt,
    read: false,
    ...(notif.meta ? { meta: notif.meta } : {}),
  };

  // Même `tag` pour les deux canaux (Web Push et FCM) — un second message du
  // même type (ex. deux messages Zikr consécutifs) remplace la notification
  // système précédente plutôt que de les empiler.
  const tag = notif.type + (notif.meta && notif.meta.tagSuffix ? ":" + notif.meta.tagSuffix : "");
  const pushPayload = JSON.stringify({
    title: record.title,
    body: record.body,
    url: record.targetUrl,
    tag,
  });
  const vapidReady = configureVapid();

  await Promise.all(targets.map(async (uid) => {
    const ref = db.ref("notifications/" + uid).push();
    await ref.set(record);
    // Compteur non-lu : transaction (concurrence possible si l'utilisateur
    // reçoit plusieurs notifications au même instant, ex. rattrapage cron).
    await db.ref("notifications_meta/" + uid + "/unread").transaction((c) => (c || 0) + 1);
    await pruneOldest(db, uid).catch(() => {}); // best-effort, jamais bloquant
    if (vapidReady) await sendPushToUid(db, uid, pushPayload).catch(() => {});
    await sendFcmToUid(db, uid, notif, tag).catch(() => {});
  }));
}

/**
 * Notifie TOUS les utilisateurs connus de l'app (annuaire = user_sessions,
 * alimenté par pages/api/track.js à chaque connexion — voir son en-tête).
 * Utilisé pour les publications admin (Secret, document) : contenu
 * broadcast, sans destinataire précis (aucune fonctionnalité d'envoi ciblé
 * n'existe pour ces deux modules — voir la revue produit du 2026-09-20).
 *
 * @param {import('firebase-admin').database.Database} db
 * @param {{type:string, title:string, body:string, senderName?:string,
 *          targetUrl:string, meta?:object}} notif
 */
async function notifyAllUsers(db, notif) {
  const snap = await db.ref("user_sessions").once("value");
  const uids = [];
  snap.forEach((c) => uids.push(c.key));
  await notifyUsers(db, uids, notif);
}

module.exports = { notifyUsers, notifyAllUsers, MAX_PER_USER };
