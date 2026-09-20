// api/cron/reminders.js — Envoi des rappels programmés : session Zikr
// collectif à venir (zikr_groups/{gid}.sessionAt, réglé par le créateur —
// voir lib/zikrLogic.js normalizeGroupInput) et relance de réabonnement
// (purchased_user/{emailKey}, écrite par admin-asrar-pro — voir
// shouldSendRenewalReminder/shouldSendExpiredNotice, lib/reminders.js).
//
// Déclenché PÉRIODIQUEMENT par un planificateur externe (même mécanisme que
// pages/api/cron/planet-push.js — voir server/cronAuth.js), à une cadence
// non garantie : toute la logique de décision (lib/reminders.js
// shouldSendSessionReminder/...) est donc À BASE D'ÉTAT (dernier envoi
// mémorisé, fenêtre tolérante) plutôt qu'à correspondance exacte d'horaire —
// IDEMPOTENTE quel que soit l'écart réel entre deux passages
// (sessionReminderSent/renewalReminderForExpiry empêchent tout doublon même
// si le planificateur repasse deux fois de suite).
//
// CADENCE (revue de sécurité, P0) : vercel.json ne programme ce endpoint
// qu'UNE FOIS par jour (limite du plan Vercel Hobby — les cron jobs plus
// fréquents qu'1×/jour exigent le plan Pro, cf. `vercel plan` du projet).
// Or shouldSendSessionReminder() n'ouvre qu'une fenêtre étroite autour de
// l'horaire fixé par le créateur (SESSION_LEAD_MS/GRACE_MS, lib/
// reminders.js — 40 minutes au total) : avec un seul passage quotidien à
// heure fixe, la quasi-totalité des sessions programmées tombent hors de
// cette fenêtre et ne déclenchent jamais leur rappel. Solution retenue SANS
// dépendre d'un upgrade de plan : .github/workflows/reminders-cron.yml
// appelle ce endpoint toutes les 10 minutes via GitHub Actions (gratuit, pas
// de limite de fréquence) — nécessite un secret de DÉPÔT GitHub `CRON_SECRET`
// portant la même valeur que la variable d'environnement Vercel du même nom,
// voir le fichier de workflow. Le cron Vercel ci-dessus reste un filet de
// secours si jamais le workflow GitHub est désactivé.
//
// Réutilise push_subscriptions/{uid}/{subId} (pages/api/push-subscribe.js) —
// le MÊME abonnement navigateur que l'heure planétaire, sans exiger de
// position (lat/lng optionnels pour ce endpoint).
//
// (Anciens rappels « wird quotidien » et « contenu quotidien » retirés avec
// leurs seules interfaces d'activation, components/WirdReminderToggle.js et
// components/DailyContentCard.js — voir lib/reminders.js.)

const webpush = require("web-push");
const { app } = require("../../../server/grant");
const { reportError } = require("../../../server/log");
const { authorized } = require("../../../server/cronAuth");
const {
  shouldSendSessionReminder,
  shouldSendRenewalReminder, shouldSendExpiredNotice, daysUntil, renewalWhatsAppUrl,
} = require("../../../lib/reminders");

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
  const stats = {
    sessionSent: 0, sessionSkipped: 0,
    renewalSent: 0, renewalSkipped: 0, expiredSent: 0, expiredSkipped: 0, renewalNoAccount: 0,
    removed: 0, errors: 0,
  };

  try {
    await Promise.all([
      sendSessionReminders(db, now, stats),
      sendRenewalReminders(db, now, stats),
    ]);
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

// ── Relance de réabonnement ───────────────────────────────────────────────
// Lit purchased_user (RTDB, PARTAGÉE avec admin-asrar-pro — voir
// server/access.js hasActiveAccess) : nœud écrit par l'admin (octroi/
// prolongation), jamais par ce cron, qui ne fait qu'y ajouter deux
// marqueurs d'envoi (renewalReminderForExpiry/expiredNoticeForExpiry — voir
// leur commentaire dans lib/reminders.js pour pourquoi une PROLONGATION
// redéclenche automatiquement un futur rappel, sans action de l'admin).
//
// AUCUN opt-in ici : c'est une notification liée au COMPTE (comme un reçu
// d'achat), pas un rappel de pratique — mais toujours limitée aux comptes
// ayant un abonnement PUSH actif (renewalNoAccount / silencieux si aucun
// compte Firebase Auth ne correspond à l'e-mail : accès jamais accordé à un
// compte réel, ex. saisie erronée côté admin).
async function sendRenewalReminders(db, now, stats) {
  const snap = await db.ref("purchased_user").once("value");
  const tasks = [];
  snap.forEach((doc) => {
    const p = doc.val() || {};
    // emailKey() (server/access.js) : '.' → ',' — décodage identique à
    // admin-asrar-pro (api/users.js, action="list_access").
    const email = String(doc.key).replace(/,/g, ".");

    const wantsReminder = shouldSendRenewalReminder(p, now);
    const wantsExpired = shouldSendExpiredNotice(p, now);
    if (!wantsReminder && !wantsExpired) { stats.renewalSkipped++; stats.expiredSkipped++; return; }

    tasks.push(
      (async () => {
        // Un compte Firebase Auth doit exister pour cet e-mail — purchased_user
        // peut contenir un octroi fait AVANT la première connexion du client,
        // ou une faute de frappe côté admin : jamais bloquant, on passe juste
        // ce document.
        let userRecord;
        try {
          userRecord = await app().auth().getUserByEmail(email);
        } catch {
          stats.renewalNoAccount++;
          return;
        }
        const update = {};

        if (wantsReminder) {
          const days = daysUntil(p.expiresAt, now);
          const payload = JSON.stringify({
            title: '⏳ Votre abonnement expire bientôt',
            body: `Il vous reste ${days} jour${days > 1 ? 's' : ''} — renouvelez pour garder votre accès à ASRAR PRO.`,
            url: renewalWhatsAppUrl({ email, expiresAt: p.expiresAt, expired: false }),
            tag: 'renewal-reminder',
          });
          await pushToUser(db, userRecord.uid, payload, stats);
          update.renewalReminderForExpiry = p.expiresAt;
          stats.renewalSent++;
        } else {
          stats.renewalSkipped++;
        }

        if (wantsExpired) {
          const payload = JSON.stringify({
            title: '🔒 Votre abonnement a expiré',
            body: "Votre accès premium ASRAR PRO a expiré. Renouvelez pour le retrouver.",
            url: renewalWhatsAppUrl({ email, expiresAt: p.expiresAt, expired: true }),
            tag: 'renewal-expired',
          });
          await pushToUser(db, userRecord.uid, payload, stats);
          update.expiredNoticeForExpiry = p.expiresAt;
          stats.expiredSent++;
        } else {
          stats.expiredSkipped++;
        }

        if (Object.keys(update).length > 0) await db.ref("purchased_user/" + doc.key).update(update);
      })()
    );
  });
  await Promise.all(tasks);
}
