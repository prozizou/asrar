// api/cron/reminders.js — Envoi des rappels programmés : wird quotidien et
// contenu quotidien — verset/hadith/dua, lib/dailyContent.js — (tous deux
// dans reminder_settings/{uid}, réglés via pages/api/reminders.js), session
// Zikr collectif à venir (zikr_groups/{gid}.sessionAt, réglé par le créateur
// — voir lib/zikrLogic.js normalizeGroupInput) et relance de réabonnement
// (access_purchases/{emailKey}, écrite par admin-asrar-pro — voir
// shouldSendRenewalReminder/shouldSendExpiredNotice, lib/reminders.js).
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
// Réutilise la collection Firestore push_subscriptions (pages/api/
// push-subscribe.js) — le MÊME abonnement navigateur que l'heure planétaire,
// sans exiger de position (lat/lng optionnels pour ce endpoint).
//
// MIGRATION FIRESTORE (Phase 6, voir docs/FIRESTORE_SCHEMA.md) : plus aucun
// accès RTDB dans ce fichier — reminder_settings, push_subscriptions,
// zikr_groups/members (Phase 5) et cron_health sont désormais tous sur
// Firestore.

const webpush = require("web-push");
const { app } = require("../../../server/grant");
const { reportError } = require("../../../server/log");
const { authorized } = require("../../../server/cronAuth");
const {
  shouldSendWird, shouldSendDailyContent, shouldSendSessionReminder,
  shouldSendRenewalReminder, shouldSendExpiredNotice, daysUntil, renewalWhatsAppUrl,
  localDateKey,
} = require("../../../lib/reminders");
const { todayContent, pushBody, CONTENT_TYPE_LABEL } = require("../../../lib/dailyContent");

export default async function handler(req, res) {
  if (!authorized(req)) return res.status(401).json({ error: "Non autorisé." });

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;
  if (!vapidPublic || !vapidPrivate || !vapidSubject) {
    return res.status(500).json({ error: "VAPID non configuré (variables d'environnement manquantes)." });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const firestore = app().firestore();
  const now = new Date();
  const stats = {
    wirdSent: 0, wirdSkipped: 0, contentSent: 0, contentSkipped: 0,
    sessionSent: 0, sessionSkipped: 0,
    renewalSent: 0, renewalSkipped: 0, expiredSent: 0, expiredSkipped: 0, renewalNoAccount: 0,
    removed: 0, errors: 0,
  };

  try {
    await Promise.all([
      sendDailyReminders(firestore, now, stats),
      sendSessionReminders(firestore, now, stats),
      sendRenewalReminders(firestore, now, stats),
    ]);
    // Dernière exécution + statistiques — consultable côté admin (console
    // Firebase, même principe que les autres nœuds admin-only du projet) pour
    // repérer un planificateur externe qui se serait arrêté (surveillance,
    // revue de sécurité). Best-effort : ne doit jamais faire échouer la
    // réponse si l'écriture rate.
    firestore.collection("cron_health").doc("reminders").set({ at: now.getTime(), ...stats }).catch(() => {});
    return res.status(200).json({ ok: true, ...stats });
  } catch (e) {
    await reportError("cron:reminders", e);
    return res.status(500).json({ error: e.message });
  }
}

// Envoie `payload` à TOUS les abonnements push de `uid`, en nettoyant ceux
// devenus invalides (même politique que pages/api/cron/planet-push.js) —
// jamais bloquant : une erreur d'envoi n'empêche pas les autres.
async function pushToUser(firestore, uid, payload, stats) {
  const subsSnap = await firestore.collection("push_subscriptions").where("uid", "==", uid).get();
  if (subsSnap.empty) return;
  const tasks = [];
  subsSnap.forEach((doc) => {
    const sub = doc.data() || {};
    if (!sub.endpoint || !sub.keys) return;
    tasks.push(
      webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload).catch(async (e) => {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) {
          await doc.ref.delete();
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

// ── Wird quotidien + contenu quotidien ───────────────────────────────────
// UN SEUL passage sur reminder_settings pour les deux rappels (au lieu de
// deux scans complets de la collection) — chaque document peut déclencher
// l'un, l'autre, les deux, ou aucun, indépendamment (deux booléens/deux
// dates de dernier envoi séparés, voir pages/api/reminders.js).
async function sendDailyReminders(firestore, now, stats) {
  const snap = await firestore.collection("reminder_settings").get();
  const tasks = [];
  snap.forEach((doc) => {
    const uid = doc.id;
    const settings = doc.data() || {};
    const tz = settings.tz || "UTC";
    const update = {};

    if (shouldSendWird(settings, now)) {
      const payload = JSON.stringify({
        title: '🤲 Rappel de wird',
        body: "C'est l'heure de votre wird quotidien.",
        // /rappels n'existe pas (aucune route sous app/ ne le sert — 404) :
        // le réglage du wird (WirdReminderToggle.js) vit dans /zikr, seule
        // destination réelle où l'utilisateur peut agir sur ce rappel
        // (revue de sécurité, P0).
        url: '/zikr',
        tag: 'wird-reminder',
      });
      tasks.push(
        pushToUser(firestore, uid, payload, stats).then(() => { stats.wirdSent++; })
      );
      update.lastSentDate = localDateKey(now, tz);
      update.lastSentAt = now.getTime();
    } else {
      stats.wirdSkipped++;
    }

    if (shouldSendDailyContent(settings, now)) {
      const item = todayContent(now);
      const payload = JSON.stringify({
        title: '🌙 ' + (CONTENT_TYPE_LABEL[item.type] || 'Contenu du jour'),
        body: pushBody(item),
        // /menu affiche la même carte (components/DailyContentCard.js,
        // même sélection déterministe par jour) — cohérent avec ce que le
        // push vient d'annoncer.
        url: '/menu',
        tag: 'daily-content',
      });
      tasks.push(
        pushToUser(firestore, uid, payload, stats).then(() => { stats.contentSent++; })
      );
      update.lastContentSentDate = localDateKey(now, tz);
      update.lastContentSentAt = now.getTime();
    } else {
      stats.contentSkipped++;
    }

    if (Object.keys(update).length > 0) tasks.push(doc.ref.update(update));
  });
  await Promise.all(tasks);
}

// ── Session Zikr collectif à venir ──────────────────────────────
// Prévient le créateur ET tous les membres déjà acceptés (sous-collection
// members) — pas les demandes en attente, qui n'ont pas encore accès au
// groupe.
async function sendSessionReminders(firestore, now, stats) {
  const snap = await firestore.collection("zikr_groups").get();
  const tasks = [];
  snap.forEach((g) => {
    const gid = g.id;
    const v = g.data() || {};
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
        const membersSnap = await g.ref.collection("members").get();
        const uids = new Set();
        membersSnap.forEach((m) => uids.add(m.id));
        if (v.ownerUid) uids.add(v.ownerUid);
        await Promise.all([...uids].map((uid) => pushToUser(firestore, uid, payload, stats)));
        await g.ref.update({ sessionReminderSent: true });
        stats.sessionSent++;
      })()
    );
  });
  await Promise.all(tasks);
}

// ── Relance de réabonnement ───────────────────────────────────────────────
// Lit access_purchases (Firestore, PARTAGÉE avec admin-asrar-pro — voir
// server/access.js hasActiveAccess) : collection écrite par l'admin
// (octroi/prolongation), jamais par ce cron, qui ne fait qu'y ajouter deux
// marqueurs d'envoi (renewalReminderForExpiry/expiredNoticeForExpiry — voir
// leur commentaire dans lib/reminders.js pour pourquoi une PROLONGATION
// redéclenche automatiquement un futur rappel, sans action de l'admin).
//
// AUCUN opt-in ici (contrairement au wird/contenu quotidien) : c'est une
// notification liée au COMPTE (comme un reçu d'achat), pas un rappel de
// pratique — mais toujours limitée aux comptes ayant un abonnement PUSH
// actif (renewalNoAccount / silencieux si aucun compte Firebase Auth ne
// correspond à l'e-mail : accès jamais accordé à un compte réel, ex. saisie
// erronée côté admin).
async function sendRenewalReminders(firestore, now, stats) {
  const snap = await firestore.collection("access_purchases").get();
  const tasks = [];
  snap.forEach((doc) => {
    const p = doc.data() || {};
    // emailKey() (server/access.js) : '.' → ',' — décodage identique à
    // admin-asrar-pro (api/users.js, action="list_access").
    const email = String(doc.id).replace(/,/g, ".");

    const wantsReminder = shouldSendRenewalReminder(p, now);
    const wantsExpired = shouldSendExpiredNotice(p, now);
    if (!wantsReminder && !wantsExpired) { stats.renewalSkipped++; stats.expiredSkipped++; return; }

    tasks.push(
      (async () => {
        // Un compte Firebase Auth doit exister pour cet e-mail — access_purchases
        // peut contenir un octroi fait AVANT la première connexion du client
        // (voir pages/api/reminders.js, wird : même situation), ou une faute
        // de frappe côté admin : jamais bloquant, on passe juste ce document.
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
          await pushToUser(firestore, userRecord.uid, payload, stats);
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
          await pushToUser(firestore, userRecord.uid, payload, stats);
          update.expiredNoticeForExpiry = p.expiresAt;
          stats.expiredSent++;
        } else {
          stats.expiredSkipped++;
        }

        if (Object.keys(update).length > 0) await doc.ref.update(update);
      })()
    );
  });
  await Promise.all(tasks);
}
