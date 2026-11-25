const { verifyUser } = require("../../server/access");
const { setCors, parseBody, isValidKey } = require("../../server/http");
const { rateLimit } = require("../../lib/rateLimit");
const { getSource } = require("../../server/sources");
const { reportError } = require("../../server/log");
const { adsEnabled, startAdSession, getAdSessionStatus, consumeAdCredit } = require("../../server/adReward");

const LIMITS = {
  start:   { max: 30, windowMs: 10 * 60_000 },
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
        if (body.provider !== "admob") return res.status(503).json({ error: "Cette régie est en pause." });
        if (body.interstitial === true && process.env.ADMOB_REWARDED_INTERSTITIAL_SSV !== "1") {
          return res.status(503).json({ error: "Interstitiel récompensé indisponible." });
        }
        return res.status(200).json(await startAdSession(user.uid, "admob", body.interstitial === true));
      case "status":
        if (!/^[a-f0-9]{32}$/.test(body.nonce || "")) return res.status(400).json({ error: "Session invalide." });
        return res.status(200).json(await getAdSessionStatus(user.uid, body.nonce));
      case "consume": {
        const { content } = body;
        if (content == null) {
          if (body.localAction !== true) return res.status(409).json({ error: "Actualisez l’application puis réessayez." });
          return res.status(200).json({ ok: await consumeAdCredit(user.uid) });
        }
        const { kind, cat, key } = content;
        const source = kind === "secret" || kind === "book" ? getSource(kind) : null;
        if (!source || !isValidKey(key) || (source.cats && !source.cats.includes(cat))) {
          return res.status(400).json({ error: "Contenu invalide." });
        }
        return res.status(200).json({ ok: await consumeAdCredit(user.uid, source.ref(cat) + "/" + key) });
      }
    }
  } catch (e) {
    await reportError("ad-reward:" + body.action, e, { uid: user.uid });
    return res.status(500).json({ error: e.message });
  }
}
