// api/cron/reminders.js — Envoi des rappels programmés : wird quotidien
// (reminder_settings/{uid}, réglé via pages/api/reminders.js) et session Zikr
// collectif à venir (zikr_groups/{gid}.sessionAt, réglé par le créateur —
// voir lib/zikrLogic.js normalizeGroupInput).
//
// Déclenché PÉRIODIQUEMENT par un planificateur externe (même mécanisme que
// pages/api/cron/planet-push.js — voir server/cronAuth.js), à une cadence
// non garantie : toute la logique de décision (lib/reminders.js
// shouldSendWird/shouldSendSessionReminder) est donc À BASE D'ÉTAT (dernier
// envoi mémorisé, fenêtre tolérante) plutôt qu'à correspondance exacte
// d'horaire — reste correcte quel que soit l'écart réel entre deux passages.
//
// Réutilise push_subscriptions/{uid}/{subId} (pages/api/push-subscribe.js) —
// le MÊME abonnement navigateur que l'heure planétaire, sans exiger de
// position (lat/lng optionnels pour ce endpoint).

const webpush = require("web-push");
const { app } = require("../../../server/grant");
const { reportError } = require("../../../server/log");
const { authorized } = require("../../../server/cronAuth");
const { shouldSendWird, shouldSendSessionReminder, localDateKey } = require("../../../lib/reminders");

export default async function handler(req, res) {
  if (!authorized(req)) return res.status(401).json({ error: "Non autorisé." });

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;
  if (!vapidPublic || !vapidPrivate || !vapidSubject) {
    return res.status(500).json({ error: "VAPID non configuré (variables d'environnement manquantes)." });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const db = app().database();
  const now = new Date();
  const stats = { wirdSent: 0, wirdSkipped: 0, sessionSent: 0, sessionSkipped: 0, removed: 0, errors: 0 };

  try {
    await Promise.all([sendWirdReminders(db, now, stats), sendSessionReminders(db, now, stats)]);
    return res.status(200).json({ ok: true, ...stats });
  } catch (e) {
    await reportError("cron:reminders", e);
    return res.status(500).json({ error: e.message });
  }
}

// Envoie `payload` à TOUS les abonnements push de `uid`, en nettoyant ceux
// devenus invalides (même politique que pages/api/cron/planet-push.js) —
// jamais bloquant : une erreur d'envoi n'empêche pas les autres.
async function pushToUser(db, uid, payload, stats) {
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
          stats.removed++;
        } else {
          await reportError("cron:reminders", e, { uid });
          stats.errors++;
        }
      })
    );
  });
  await Promise.all(tasks);
}

// ── Wird quotidien ───────────────────────────────────────────────
async function sendWirdReminders(db, now, stats) {
  const snap = await db.ref("reminder_settings").once("value");
  const tasks = [];
  snap.forEach((userSnap) => {
    const uid = userSnap.key;
    const settings = userSnap.val() || {};
    if (!shouldSendWird(settings, now)) { stats.wirdSkipped++; return; }
    const payload = JSON.stringify({
      title: '🤲 Rappel de wird',
      body: "C'est l'heure de votre wird quotidien.",
      url: '/rappels',
      tag: 'wird-reminder',
    });
    tasks.push(
      pushToUser(db, uid, payload, stats).then(() =>
        db.ref("reminder_settings/" + uid).update({
          lastSentDate: localDateKey(now, settings.tz || "UTC"),
          lastSentAt: now.getTime(),
        })
      ).then(() => { stats.wirdSent++; })
    );
  });
  await Promise.all(tasks);
}

// ── Session Zikr collectif à venir ──────────────────────────────
// Prévient le créateur ET tous les membres déjà acceptés (zikr_members) — pas
// les demandes en attente, qui n'ont pas encore accès au groupe.
async function sendSessionReminders(db, now, stats) {
  const snap = await db.ref("zikr_groups").once("value");
  const tasks = [];
  snap.forEach((g) => {
    const gid = g.key;
    const v = g.val() || {};
    if (!shouldSendSessionReminder(v.sessionAt, v.sessionReminderSent === true, now)) {
      stats.sessionSkipped++;
      return;
    }
    tasks.push(
      (async () => {
        const payload = JSON.stringify({
          title: '🔔 ' + (v.name || 'Zikr collectif'),
          body: 'Une session de ce zikr collectif commence bientôt.',
          url: '/s?k=zikr&i=' + gid,
          tag: 'zikr-session-' + gid,
        });
        const membersSnap = await db.ref("zikr_members/" + gid).once("value");
        const uids = new Set();
        membersSnap.forEach((m) => uids.add(m.key));
        if (v.ownerUid) uids.add(v.ownerUid);
        await Promise.all([...uids].map((uid) => pushToUser(db, uid, payload, stats)));
        await db.ref("zikr_groups/" + gid).update({ sessionReminderSent: true });
        stats.sessionSent++;
      })()
    );
  });
  await Promise.all(tasks);
}
