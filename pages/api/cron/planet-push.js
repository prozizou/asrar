// api/cron/planet-push.js — Envoi des notifications push d'heure planétaire.
//
// Déclenché PÉRIODIQUEMENT par un planificateur externe (Vercel Cron —
// voir vercel.json — ou tout service de cron capable d'appeler une URL avec
// un en-tête ; voir CRON_SECRET ci-dessous), PAS par un utilisateur : aucun
// jeton Firebase ici, protection par secret partagé uniquement.
//
// Pour CHAQUE abonnement (push_subscriptions/{uid}/{subId}, écrit par
// pages/api/push-subscribe.js), calcule l'heure planétaire actuelle à SA
// position (lib/planete.js — même logique que la page /planete) et envoie
// une notification SEULEMENT si la planète a changé depuis le dernier envoi
// (lastPlanet) — sinon rien à annoncer, pas de doublon au prochain passage
// du planificateur avant le changement d'heure suivant.

const crypto = require("crypto");
const webpush = require("web-push");
const { app } = require("../../../server/grant");
const { computePday, currentHour, natureOf } = require("../../../lib/planete");
const { reportError } = require("../../../server/log");

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // pas configuré → jamais déclenché (sécurité par défaut, pas par omission)
  const header = (req.headers && req.headers.authorization) || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const query = (req.query && req.query.secret) || "";
  // Comparaison à temps constant : évite qu'une différence de timing sur une
  // comparaison naïve (===) ne fuite des informations sur le secret attendu.
  return safeEqual(bearer, secret) || safeEqual(String(query), secret);
}
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

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

    return res.status(200).json({ ok: true, sent, skipped, removed, errors });
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
