// api/push-fcm-register.js — Enregistrement des appareils FCM (Capacitor
// Android, puis iOS) : canal DISTINCT du Web Push VAPID actuel (voir
// pages/api/push-subscribe.js) — un même utilisateur peut avoir les deux à
// la fois. Cette première tranche se limite à l'enregistrement/retrait des
// jetons ; server/notify.js ne les utilise pas encore à l'envoi (viendra
// avec le wrapper Capacitor).
//
// Body (JSON) : { idToken, action, platform?, token? }
//   action="register"   { platform, token } → enregistre/actualise l'appareil
//   action="unregister" { token? } → retire cet appareil (ou tous ceux de
//                                    l'utilisateur si token omis)
//
// Écrit fcm_devices/{uid}/{deviceId} = { platform, token, enabled, updatedAt }
//   deviceId = hash stable de `token` (lib/pushDevices.js) — un jeton FCM
//   peut contenir des caractères invalides comme clé Firebase et être long.

const { verifyUser } = require("../../server/access");
const { app } = require("../../server/grant");
const { setCors, parseBody } = require("../../server/http");
const { rateLimit } = require("../../lib/rateLimit");
const { reportError } = require("../../server/log");
const { deviceIdFromToken, validateDeviceInput } = require("../../lib/pushDevices");

const RATE_LIMIT = { max: 10, windowMs: 60_000 };

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken, action, platform, token } = parseBody(req);

  let user;
  try { user = await verifyUser(idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  if (!rateLimit("push-fcm-register:" + user.uid, RATE_LIMIT.max, RATE_LIMIT.windowMs)) {
    return res.status(429).json({ error: "Trop de requêtes, réessayez dans une minute." });
  }

  const db = app().database();

  try {
    if (action === "register") {
      const check = validateDeviceInput({ platform, token });
      if (!check.valid) return res.status(400).json({ error: check.error });

      await db.ref("fcm_devices/" + user.uid + "/" + deviceIdFromToken(token)).update({
        platform,
        token: String(token),
        enabled: true,
        updatedAt: Date.now(),
      });
      return res.status(200).json({ ok: true });
    }

    if (action === "unregister") {
      if (token) {
        await db.ref("fcm_devices/" + user.uid + "/" + deviceIdFromToken(token)).remove();
      } else {
        await db.ref("fcm_devices/" + user.uid).remove();
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Action inconnue." });
  } catch (e) {
    await reportError("push-fcm-register", e, { uid: user.uid, action });
    return res.status(500).json({ error: e.message });
  }
}
