// api/push-subscribe.js — Abonnement aux notifications push (heure planétaire
// — voir pages/api/cron/planet-push.js pour l'envoi, lib/push.js côté client).
//
// Body (JSON) : { idToken, action, subscription?, lat?, lng? }
//   action="subscribe"   { subscription, lat, lng } → enregistre/actualise
//   action="unsubscribe" { endpoint? } → retire cet abonnement (ou tous ceux
//                                        de l'utilisateur si endpoint omis)
//
// Écrit push_subscriptions/{uid}/{subId} = { endpoint, keys:{p256dh,auth},
//   lat, lng, updatedAt } — subId = hash stable de `endpoint` (identifiant
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
      const latN = coord(lat, -90, 90);
      const lngN = coord(lng, -180, 180);
      if (latN == null || lngN == null) {
        return res.status(400).json({ error: "Position GPS requise pour les notifications d'heure planétaire." });
      }
      await db.ref("push_subscriptions/" + user.uid + "/" + subId(ep)).set({
        endpoint: ep,
        keys: { p256dh: String(keys.p256dh), auth: String(keys.auth) },
        lat: latN, lng: lngN,
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
