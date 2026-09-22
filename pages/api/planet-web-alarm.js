// api/planet-web-alarm.js — Alarmes d'heure planétaire côté WEB (par compte).
//
// Là où le natif programme une notification locale sur l'appareil
// (lib/planetAlarmsNative.js, réglage par appareil en localStorage), le web
// ne peut pas : on enregistre ici le choix de l'utilisateur, et le cron
// pages/api/cron/planet-push.js envoie le push au bon moment vers TOUS ses
// abonnements (push_subscriptions). Enregistrement PAR COMPTE — socle « tous
// mes appareils ».
//
// Body (JSON) : { idToken, action, planet?, enabled?, offsetMin? }
//   action="list"                              → { alarms: { slug: { offsetMin } } } (planètes cochées)
//   action="set" { planet, enabled, offsetMin } → coche/décoche une planète
//
// Écrit planet_web_alarms/{uid}/{slug} = { enabled, offsetMin, lastSentTrigger,
//   updatedAt }. Décocher SUPPRIME l'entrée (le cron n'itère que les cochées).
// À la coche, lastSentTrigger est amorcé à `maintenant` : seule la PROCHAINE
// occurrence de la planète déclenche un push, jamais celle déjà en cours.

const { verifyUser } = require("../../server/access");
const { app } = require("../../server/grant");
const { setCors, parseBody } = require("../../server/http");
const { rateLimit } = require("../../lib/rateLimit");
const { reportError } = require("../../server/log");
const { planetSlug, validateWebOffset } = require("../../lib/planetWebAlarms");

const RATE_LIMIT = { max: 20, windowMs: 60_000 };

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken, action, planet, enabled, offsetMin } = parseBody(req);

  let user;
  try { user = await verifyUser(idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  if (!rateLimit("planet-web-alarm:" + user.uid, RATE_LIMIT.max, RATE_LIMIT.windowMs)) {
    return res.status(429).json({ error: "Trop de requêtes, réessayez dans une minute." });
  }

  const db = app().database();
  const base = "planet_web_alarms/" + user.uid;

  try {
    if (action === "list") {
      const snap = await db.ref(base).once("value");
      const alarms = {};
      snap.forEach((child) => {
        const v = child.val() || {};
        if (v.enabled) alarms[child.key] = { offsetMin: validateWebOffset(v.offsetMin) };
      });
      return res.status(200).json({ ok: true, alarms });
    }

    if (action === "set") {
      const slug = planetSlug(planet);
      if (!slug) return res.status(400).json({ error: "Planète inconnue." });
      const ref = db.ref(base + "/" + slug);
      if (enabled) {
        await ref.set({
          enabled: true,
          offsetMin: validateWebOffset(offsetMin),
          // Amorce : n'annonce que la prochaine occurrence, pas celle en cours.
          lastSentTrigger: Date.now(),
          updatedAt: Date.now(),
        });
      } else {
        await ref.remove();
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Action inconnue." });
  } catch (e) {
    await reportError("planet-web-alarm", e, { uid: user.uid, action });
    return res.status(500).json({ error: e.message });
  }
};
