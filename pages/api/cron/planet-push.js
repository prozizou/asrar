// api/cron/planet-push.js — Envoi des notifications push d'heure planétaire.
//
// Déclenché PÉRIODIQUEMENT par un planificateur externe (Vercel Cron —
// voir vercel.json — ou tout service de cron capable d'appeler une URL avec
// un en-tête ; voir server/cronAuth.js pour CRON_SECRET), PAS par un
// utilisateur : aucun jeton Firebase ici, protection par secret partagé
// uniquement. Même mécanisme d'autorisation que pages/api/cron/reminders.js.
//
// Deux mécanismes, une même route (le plan Vercel Hobby n'autorise que 2 crons
// au total, déjà pris) :
//
//   1. ABONNEMENT GLOBAL (PlanetPushToggle) — pour CHAQUE abonnement
//      (push_subscriptions/{uid}/{subId}, écrit par pages/api/push-subscribe.js),
//      calcule l'heure planétaire actuelle à SA position (lib/planete.js) et
//      notifie SEULEMENT si la planète a changé depuis le dernier envoi
//      (lastPlanet) — pas de doublon.
//
//   2. ALARMES WEB PAR PLANÈTE (opt-in, planet_web_alarms/{uid}/{slug}, écrit
//      par pages/api/planet-web-alarm.js) — pendant web des alarmes locales
//      natives : envoie un push à l'heure d'une planète COCHÉE (avec délai),
//      vers TOUS les abonnements du compte. Voir lib/planetWebAlarms.js.
//
// CADENCE REQUISE : la précision de (2) — et de (1) — dépend de la FRÉQUENCE
// d'appel de cette route. Un push « à l'heure de Jupiter » suppose un appel au
// moins une fois par WEB_ALARM_WINDOW_MS (≈ chaque minute). Le cron Vercel
// Hobby ne tourne qu'UNE fois par jour (voir vercel.json) : pour un vrai
// fonctionnement, passer le planificateur à `* * * * *` (Vercel Pro) ou
// pointer un pinger externe (cron-job.org, GitHub Actions…) sur cette URL avec
// l'en-tête CRON_SECRET. Sans cadence fréquente, la plupart des occurrences
// tombent hors fenêtre et aucun push n'est envoyé.

const webpush = require("web-push");
const { app } = require("../../../server/grant");
const { computePday, currentHour, natureOf, buildHourList } = require("../../../lib/planete");
const { dueWebAlarms, planetFromSlug } = require("../../../lib/planetWebAlarms");
const { reportError } = require("../../../server/log");
const { authorized } = require("../../../server/cronAuth");

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
  let sent = 0, skipped = 0, removed = 0, errors = 0;

  try {
    const snap = await db.ref("push_subscriptions").once("value");
    const tasks = [];

    snap.forEach((userSnap) => {
      const uid = userSnap.key;
      userSnap.forEach((subSnap) => {
        const key = subSnap.key;
        const sub = subSnap.val() || {};
        tasks.push(processSubscription(db, uid, key, sub, now));
      });
    });

    const results = await Promise.allSettled(tasks);
    for (const r of results) {
      if (r.status !== "fulfilled") { errors++; continue; }
      if (r.value === "sent") sent++;
      else if (r.value === "removed") removed++;
      else skipped++;
    }

    // Pass 2 : alarmes web par planète (opt-in). Indépendant de la pass 1 :
    // un échec ici n'empêche pas de renvoyer le bilan de la pass 1.
    let alarmsSent = 0, alarmsErrors = 0;
    try {
      const res2 = await processWebAlarmsAll(db, now);
      alarmsSent = res2.sent;
      alarmsErrors = res2.errors;
    } catch (e) {
      await reportError("cron:planet-push:web-alarms", e);
      alarmsErrors++;
    }

    return res.status(200).json({ ok: true, sent, skipped, removed, errors, alarmsSent, alarmsErrors });
  } catch (e) {
    await reportError("cron:planet-push", e);
    return res.status(500).json({ error: e.message });
  }
}

async function processSubscription(db, uid, key, sub, now) {
  if (sub.lat == null || sub.lng == null || !sub.endpoint || !sub.keys) return "skipped";

  const pday = computePday(now, sub.lat, sub.lng, {});
  const cur = currentHour(now, pday);
  if (sub.lastPlanet === cur.planet) return "skipped"; // toujours la même heure, rien à annoncer

  const nature = natureOf(cur.planet, cur.fraction);
  const payload = JSON.stringify({
    title: `🪐 Heure de ${cur.planet}`,
    body: nature.txt,
    url: "/planete",
    tag: "planet-hour",
  });

  const ref = db.ref(`push_subscriptions/${uid}/${key}`);
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
    await ref.update({ lastPlanet: cur.planet, lastSentAt: Date.now() });
    return "sent";
  } catch (e) {
    if (e && (e.statusCode === 404 || e.statusCode === 410)) {
      // Abonnement expiré/révoqué côté navigateur (désinstallation, permission
      // retirée…) : le service de push le signale ainsi, on nettoie.
      await ref.remove();
      return "removed";
    }
    await reportError("cron:planet-push", e, { uid });
    throw e;
  }
}

// --- Pass 2 : alarmes web par planète (planet_web_alarms/{uid}/{slug}) -------

async function processWebAlarmsAll(db, now) {
  const snap = await db.ref("planet_web_alarms").once("value");
  const tasks = [];
  snap.forEach((userSnap) => {
    const uid = userSnap.key;
    const enabled = {}; // slug -> { offsetMin, lastSentTrigger }
    userSnap.forEach((planetSnap) => {
      const v = planetSnap.val() || {};
      if (v.enabled) enabled[planetSnap.key] = { offsetMin: v.offsetMin, lastSentTrigger: v.lastSentTrigger };
    });
    if (Object.keys(enabled).length) tasks.push(processUserWebAlarms(db, uid, enabled, now));
  });
  const results = await Promise.allSettled(tasks);
  let sent = 0, errors = 0;
  for (const r of results) {
    if (r.status !== "fulfilled") { errors++; continue; }
    sent += r.value;
  }
  return { sent, errors };
}

async function processUserWebAlarms(db, uid, enabled, now) {
  // Abonnements du compte : on prend UNE position de référence (le plus récent
  // avec lat/lng) et on envoie à TOUS les abonnements. L'alarme web est par
  // compte (« tous mes appareils ») ; deux appareils très éloignés partagent
  // donc l'heure planétaire de la position de référence — acceptable pour un
  // usage typiquement mono-localisation, et le seul choix cohérent avec un
  // déduplicage par (uid, planète).
  const subsSnap = await db.ref(`push_subscriptions/${uid}`).once("value");
  const subs = [];
  let ref = null; // { lat, lng, updatedAt }
  subsSnap.forEach((s) => {
    const v = s.val() || {};
    if (v.endpoint && v.keys) subs.push({ key: s.key, endpoint: v.endpoint, keys: v.keys });
    if (v.lat != null && v.lng != null && (!ref || (v.updatedAt || 0) > (ref.updatedAt || 0))) {
      ref = { lat: v.lat, lng: v.lng, updatedAt: v.updatedAt || 0 };
    }
  });
  if (!subs.length || !ref) return 0; // pas d'abonnement ou pas de position → rien à faire

  const noMatch = { isDay: null, idx: -1 };
  const pday = computePday(now, ref.lat, ref.lng, {});
  const rows = [...buildHourList(pday, noMatch, true), ...buildHourList(pday, noMatch, false)];
  const due = dueWebAlarms({ rows, enabled, nowMs: now.getTime() });
  if (!due.length) return 0;

  let sent = 0;
  for (const d of due) {
    const offsetMin = (enabled[d.slug] && enabled[d.slug].offsetMin) || 0;
    const planet = d.planet || planetFromSlug(d.slug);
    const nature = natureOf(planet, 0);
    const payload = JSON.stringify({
      title: offsetMin > 0 ? `🪐 ${planet} dans ${offsetMin} min` : `🪐 Heure de ${planet}`,
      body: nature.txt,
      url: "/planete",
      tag: "planet-alarm-" + d.slug,
    });
    // Envoi à tous les abonnements du compte ; nettoyage des abonnements morts.
    await Promise.allSettled(subs.map((sub) => sendWebAlarm(db, uid, sub, payload)));
    // Déduplication : marque l'occurrence comme envoyée (triggerMs monotone).
    await db.ref(`planet_web_alarms/${uid}/${d.slug}`).update({ lastSentTrigger: d.triggerMs, lastSentAt: Date.now() });
    sent++;
  }
  return sent;
}

async function sendWebAlarm(db, uid, sub, payload) {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
  } catch (e) {
    if (e && (e.statusCode === 404 || e.statusCode === 410)) {
      await db.ref(`push_subscriptions/${uid}/${sub.key}`).remove();
      return;
    }
    await reportError("cron:planet-push:web-alarms", e, { uid });
  }
}
