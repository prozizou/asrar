// api/push-subscribe.js — Abonnement aux notifications push, PARTAGÉ par
// toutes les fonctionnalités qui en envoient (heure planétaire —
// pages/api/cron/planet-push.js — et rappels programmés — pages/api/cron/
// reminders.js, lib/push.js côté client) : un même abonnement navigateur
// (endpoint) sert de canal d'envoi pour toutes.
//
// Body (JSON) : { idToken, action, subscription?, lat?, lng? }
//   action="subscribe"   { subscription, lat?, lng? } → enregistre/actualise
//   action="unsubscribe" { endpoint? } → retire cet abonnement (ou tous ceux
//                                        de l'utilisateur si endpoint omis)
//
// lat/lng SONT OPTIONNELS : seule l'heure planétaire en a besoin (position
// du calcul astronomique) — pages/api/cron/planet-push.js ignore déjà
// silencieusement tout abonnement qui en est dépourvu. Les rappels
// programmés (wird, session Zikr collectif) n'en ont aucun besoin, d'où la
// possibilité de s'abonner aux notifications sans partager sa position.
//
// Écrit push_subscriptions/{uid}/{subId} = { endpoint, keys:{p256dh,auth},
//   lat?, lng?, updatedAt } — subId = hash stable de `endpoint` (identifiant
//   Web Push, mais contient des caractères invalides comme clé Firebase et
//   peut être long : jamais utilisé tel quel).

const crypto = require("crypto");
const { verifyUser } = require("../../server/access");
const { app } = require("../../server/grant");
const { setCors, parseBody } = require("../../server/http");
const { rateLimit } = require("../../lib/rateLimit");
const { reportError } = require("../../server/log");

const RATE_LIMIT = { max: 10, windowMs: 60_000 };

function subId(endpoint) {
  return crypto.createHash("sha1").update(String(endpoint || "")).digest("hex");
}
function coord(v, min, max) {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken, action, subscription, lat, lng, endpoint } = parseBody(req);

  let user;
  try { user = await verifyUser(idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  if (!rateLimit("push-subscribe:" + user.uid, RATE_LIMIT.max, RATE_LIMIT.windowMs)) {
    return res.status(429).json({ error: "Trop de requêtes, réessayez dans une minute." });
  }

  const db = app().database();

  try {
    if (action === "subscribe") {
      const ep = subscription && subscription.endpoint;
      const keys = subscription && subscription.keys;
      if (!ep || !keys || !keys.p256dh || !keys.auth) {
        return res.status(400).json({ error: "Abonnement push invalide." });
      }
      // Optionnelles (voir l'en-tête) : ni l'une ni l'autre ne bloque
      // l'abonnement — seule l'heure planétaire en a besoin, et son cron
      // ignore déjà silencieusement un abonnement qui en est dépourvu.
      //
      // update() plutôt que set() : un même endpoint (même abonnement
      // navigateur) sert à la fois à l'heure planétaire et aux rappels — un
      // second appel "subscribe" sans lat/lng (depuis /rappels, par ex.) ne
      // doit pas EFFACER une position déjà enregistrée par le premier.
      const latN = coord(lat, -90, 90);
      const lngN = coord(lng, -180, 180);
      await db.ref("push_subscriptions/" + user.uid + "/" + subId(ep)).update({
        endpoint: ep,
        keys: { p256dh: String(keys.p256dh), auth: String(keys.auth) },
        ...(latN != null && lngN != null ? { lat: latN, lng: lngN } : {}),
        updatedAt: Date.now(),
      });
      return res.status(200).json({ ok: true });
    }

    if (action === "unsubscribe") {
      if (endpoint) {
        await db.ref("push_subscriptions/" + user.uid + "/" + subId(endpoint)).remove();
      } else {
        await db.ref("push_subscriptions/" + user.uid).remove();
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Action inconnue." });
  } catch (e) {
    await reportError("push-subscribe", e, { uid: user.uid, action });
    return res.status(500).json({ error: e.message });
  }
};
