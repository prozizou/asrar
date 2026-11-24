const { googleKeys, verifyAdMobQuery } = require('../../server/admobVerification');
const { rewardFromAdMob } = require('../../server/adReward');
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).end();
  const url = String(req.url || ''), separator = url.indexOf('?');
  const query = separator < 0 ? '' : url.slice(separator + 1);
  if (!query || query.length > 8192) return res.status(400).end();
  try {
    const verified = verifyAdMobQuery(query, await googleKeys());
    if (!verified) return res.status(403).end();
    if (!verified.test) await rewardFromAdMob(verified);
    return res.status(200).end();
  } catch { return res.status(503).end(); } // Google may retry; no client credit on failure.
}
