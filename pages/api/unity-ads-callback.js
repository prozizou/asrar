// api/unity-ads-callback.js (Vercel) — Rappel « server-to-server » de Unity
// Ads : appelé par les serveurs Unity (GET) quand une publicité récompensée a
// été regardée en entier. Paramètres : sid (serverId posé par l'app), oid
// (identifiant unique de l'offre), hmac (signature — voir lib/adReward.js).
//
// URL à déclarer chez Unity : https://www.asrarpro.com/api/unity-ads-callback
// Secret de signature fourni par Unity → variable Vercel UNITY_ADS_S2S_SECRET.
//
// Réponse attendue par Unity : « 1 » (HTTP 200) une fois traité — y compris
// pour un rappel déjà reçu ou sans effet, sinon Unity réessaie indéfiniment.

const { rewardFromCallback, adsEnabled } = require("../../server/adReward");
const { reportError } = require("../../server/log");

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).send("Method not allowed");
  if (!adsEnabled()) return res.status(503).send("Not configured");

  // Valeurs simples uniquement (un paramètre répété arrive en tableau).
  const params = {};
  for (const [k, v] of Object.entries(req.query || {})) {
    if (typeof v !== "string") return res.status(400).send("Invalid parameters");
    params[k] = v;
  }

  try {
    const result = await rewardFromCallback(params);
    if (!result.ok) return res.status(400).send("Invalid signature");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(200).send("1");
  } catch (e) {
    await reportError("unity-ads-callback", e, { sid: params.sid });
    return res.status(500).send("Error");
  }
}
