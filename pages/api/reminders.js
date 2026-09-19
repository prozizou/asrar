// api/reminders.js — Préférences de rappel de wird quotidien ET de contenu
// quotidien (lib/reminders.js pour la logique pure de validation ;
// pages/api/cron/reminders.js pour l'envoi effectif, pages/api/push-
// subscribe.js pour l'abonnement push lui-même — un rappel n'existe que si
// l'utilisateur a par ailleurs un abonnement push actif, cf. lib/push.js
// subscribeToPushReminders).
//
// Body (JSON) : { idToken, action, wirdEnabled?, wirdHour?, wirdMinute?,
//                 dailyContentEnabled?, tz? }
//   action="get" → préférences actuelles (valeurs par défaut si jamais réglées)
//   action="set" → enregistre UNIQUEMENT les champs FOURNIS (voir plus bas) —
//     wirdEnabled/dailyContentEnabled/tz sont chacun indépendants : activer
//     le contenu quotidien depuis /menu (components/DailyContentCard.js) ne
//     doit jamais écraser le réglage de wird fait depuis /ziku
//     (components/WirdReminderToggle.js), et réciproquement.
//
// MIGRATION FIRESTORE (Phase 6, voir docs/FIRESTORE_SCHEMA.md) : document
// Firestore reminder_settings/{uid} = { wirdEnabled, wirdHour, wirdMinute,
//   dailyContentEnabled, tz, lastSentDate?, lastContentSentDate?, updatedAt }
//   — lastSentDate/lastContentSentDate (clés anti-doublon, "YYYY-MM-DD" dans
//   `tz`) ne sont écrites QUE par le cron, jamais ici.

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

  const { idToken, action, wirdEnabled, wirdHour, wirdMinute, dailyContentEnabled, tz } = parseBody(req);

  let user;
  try { user = await verifyUser(idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  if (!rateLimit("reminders:" + user.uid, RATE_LIMIT.max, RATE_LIMIT.windowMs)) {
    return res.status(429).json({ error: "Trop de requêtes, réessayez dans une minute." });
  }

  const ref = app().firestore().collection("reminder_settings").doc(user.uid);

  try {
    if (action === "get") {
      const snap = await ref.get();
      const v = snap.exists ? snap.data() : {};
      return res.status(200).json({
        wirdEnabled: v.wirdEnabled === true,
        wirdHour: cleanHour(v.wirdHour) ?? DEFAULT_HOUR,
        wirdMinute: cleanMinute(v.wirdMinute) ?? DEFAULT_MINUTE,
        dailyContentEnabled: v.dailyContentEnabled === true,
        tz: v.tz || "UTC",
      });
    }

    if (action === "set") {
      // Mise à jour PARTIELLE : seuls les champs explicitement fournis dans
      // le body sont touchés (`!== undefined`, pas un simple `if (x)` — un
      // false explicite doit pouvoir désactiver un réglage). `{merge:true}`
      // côté Firestore laisse intacts les champs absents de `update`.
      const update = { updatedAt: Date.now() };

      if (wirdEnabled !== undefined) {
        const hour = cleanHour(wirdHour);
        const minute = cleanMinute(wirdMinute);
        if (hour == null || minute == null) {
          return res.status(400).json({ error: "Heure de rappel invalide." });
        }
        update.wirdEnabled = !!wirdEnabled;
        update.wirdHour = hour;
        update.wirdMinute = minute;
      }

      if (dailyContentEnabled !== undefined) {
        update.dailyContentEnabled = !!dailyContentEnabled;
      }

      // Si `tz` est omis, le champ existant (ou son absence) reste tel
      // quel : shouldSendWird/shouldSendDailyContent (lib/reminders.js)
      // appliquent déjà cleanTimeZone(undefined) → "UTC" à la lecture, donc
      // aucun repli à écrire ici. En pratique les deux appelants
      // (WirdReminderToggle, DailyContentCard) envoient toujours `tz`.
      if (tz !== undefined) {
        update.tz = cleanTimeZone(tz);
      }

      await ref.set(update, { merge: true });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Action inconnue." });
  } catch (e) {
    await reportError("reminders", e, { uid: user.uid, action });
    return res.status(500).json({ error: e.message });
  }
};
