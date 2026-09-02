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
// d'horaire — IDEMPOTENTE quel que soit l'écart réel entre deux passages
// (lastSentDate/sessionReminderSent empêchent tout doublon même si le
// planificateur repasse deux fois de suite).
//
// CADENCE (revue de sécurité, P0) : vercel.json ne programme ce endpoint
// qu'UNE FOIS par jour (limite du plan Vercel Hobby — les cron jobs plus
// fréquents qu'1×/jour exigent le plan Pro, cf. `vercel plan` du projet).
// Or shouldSendWird() n'évalue qu'à l'instant où ce handler tourne : avec un
// seul passage quotidien à heure fixe, tout utilisateur dont l'heure de wird
// choisie tombe APRÈS cet instant local ne reçoit jamais son rappel (jamais
// vrai que « heure locale actuelle ≥ heure cible » avant le lendemain, où le
// même passage se reproduit trop tard une fois de plus). Solution retenue
// SANS dépendre d'un upgrade de plan : .github/workflows/reminders-cron.yml
// appelle ce endpoint toutes les 10 minutes via GitHub Actions (gratuit, pas
// de limite de fréquence) — nécessite un secret de DÉPÔT GitHub `CRON_SECRET`
// portant la même valeur que la variable d'environnement Vercel du même nom,
// voir le fichier de workflow. Le cron Vercel ci-dessus reste un filet de
// secours si jamais le workflow GitHub est désactivé.
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
    // Dernière exécution + statistiques — consultable côté admin (console
    // Firebase, même principe que les autres nœuds admin-only du projet) pour
    // repérer un planificateur externe qui se serait arrêté (surveillance,
    // revue de sécurité). Best-effort : ne doit jamais faire échouer la
    // réponse si l'écriture rate.
    db.ref("cron_health/reminders").set({ at: now.getTime(), ...stats }).catch(() => {});
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
      // /rappels n'existe pas (aucune route sous app/ ne le sert — 404) : le
      // réglage du wird (WirdReminderToggle.js) vit dans /zikr, seule
      // destination réelle où l'utilisateur peut agir sur ce rappel (revue
      // de sécurité, P0).
      url: '/zikr',
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
