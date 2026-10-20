// api/ad-reward.js (Vercel) — Publicités récompensées Unity Ads (APK Android) :
// alternative à l'abonnement, « une publicité = une utilisation ». Voir
// server/adReward.js pour le parcours complet et les nœuds écrits.
//
// Body (JSON) : { idToken, action, nonce? }
//   action="start"   → { nonce, serverId } : session à transmettre à Unity
//                      (PlayerMetaData.setServerId) avant d'afficher la publicité
//   action="status"  → { rewarded } : le rappel Unity est-il arrivé ?
//   action="consume" → { ok } : consomme un crédit (ouvre aussi le passe
//                      à usage unique accepté par /api/get-content)
//
// Seul le rappel signé de Unity (/api/unity-ads-callback) crédite : ces
// actions ne peuvent rien accorder sans publicité réellement regardée.

const { verifyUser } = require("../../server/access");
const { setCors, parseBody } = require("../../server/http");
const { rateLimit } = require("../../lib/rateLimit");
const { reportError } = require("../../server/log");
const { adsEnabled, startAdSession, getAdSessionStatus, consumeAdCredit } = require("../../server/adReward");

const LIMITS = {
  start:   { max: 10, windowMs: 10 * 60_000 },
  status:  { max: 60, windowMs: 60_000 },
  consume: { max: 20, windowMs: 60_000 },
};

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });
  if (!adsEnabled()) return res.status(503).json({ error: "Publicités indisponibles." });

  const body = parseBody(req);
  const limit = LIMITS[body.action];
  if (!limit) return res.status(400).json({ error: "Action inconnue." });

  let user;
  try { user = await verifyUser(body.idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  if (!rateLimit("ad-reward:" + body.action + ":" + user.uid, limit.max, limit.windowMs)) {
    return res.status(429).json({ error: "Trop de requêtes, réessayez dans un instant." });
  }

  try {
    switch (body.action) {
      case "start":
        return res.status(200).json(await startAdSession(user.uid));
      case "status":
        if (!/^[a-f0-9]{32}$/.test(body.nonce || "")) return res.status(400).json({ error: "Session invalide." });
        return res.status(200).json(await getAdSessionStatus(user.uid, body.nonce));
      case "consume":
        return res.status(200).json({ ok: await consumeAdCredit(user.uid) });
    }
  } catch (e) {
    await reportError("ad-reward:" + body.action, e, { uid: user.uid });
    return res.status(500).json({ error: e.message });
  }
}
