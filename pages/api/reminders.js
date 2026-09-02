// api/reminders.js — Préférences de rappel de wird quotidien (lib/reminders.js
// pour la logique pure de validation ; pages/api/cron/reminders.js pour
// l'envoi effectif, pages/api/push-subscribe.js pour l'abonnement push lui-
// même — un rappel de wird n'existe que si l'utilisateur a par ailleurs un
// abonnement push actif, cf. lib/push.js subscribeToPushReminders).
//
// Body (JSON) : { idToken, action, wirdEnabled?, wirdHour?, wirdMinute?, tz? }
//   action="get" → préférences actuelles (valeurs par défaut si jamais réglées)
//   action="set" { wirdEnabled, wirdHour, wirdMinute, tz } → les enregistre
//
// Écrit reminder_settings/{uid} = { wirdEnabled, wirdHour, wirdMinute, tz,
//   lastSentDate?, updatedAt } — lastSentDate (clé anti-doublon, "YYYY-MM-DD"
//   dans `tz`) n'est écrit QUE par le cron, jamais ici.

const { verifyUser } = require("../../server/access");
const { app } = require("../../server/grant");
const { setCors, parseBody } = require("../../server/http");
const { rateLimit } = require("../../lib/rateLimit");
const { reportError } = require("../../server/log");
const { cleanHour, cleanMinute, cleanTimeZone } = require("../../lib/reminders");

const RATE_LIMIT = { max: 20, windowMs: 60_000 };
const DEFAULT_HOUR = 20;
const DEFAULT_MINUTE = 0;

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken, action, wirdEnabled, wirdHour, wirdMinute, tz } = parseBody(req);

  let user;
  try { user = await verifyUser(idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  if (!rateLimit("reminders:" + user.uid, RATE_LIMIT.max, RATE_LIMIT.windowMs)) {
    return res.status(429).json({ error: "Trop de requêtes, réessayez dans une minute." });
  }

  const db = app().database();
  const ref = db.ref("reminder_settings/" + user.uid);

  try {
    if (action === "get") {
      const snap = await ref.once("value");
      const v = snap.val() || {};
      return res.status(200).json({
        wirdEnabled: v.wirdEnabled === true,
        wirdHour: cleanHour(v.wirdHour) ?? DEFAULT_HOUR,
        wirdMinute: cleanMinute(v.wirdMinute) ?? DEFAULT_MINUTE,
        tz: v.tz || "UTC",
      });
    }

    if (action === "set") {
      const hour = cleanHour(wirdHour);
      const minute = cleanMinute(wirdMinute);
      if (hour == null || minute == null) {
        return res.status(400).json({ error: "Heure de rappel invalide." });
      }
      await ref.update({
        wirdEnabled: !!wirdEnabled,
        wirdHour: hour,
        wirdMinute: minute,
        tz: cleanTimeZone(tz),
        updatedAt: Date.now(),
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Action inconnue." });
  } catch (e) {
    await reportError("reminders", e, { uid: user.uid, action });
    return res.status(500).json({ error: e.message });
  }
};
