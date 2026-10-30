const { app } = require('../../server/grant');
const play = require('../../server/playBilling');
const { synchronize, completeNotification } = require('../../server/secretPurchases');
export const config = { api: { bodyParser: { sizeLimit: '64kb' } } };
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  try {
    await play.verifyNotification(req);
    const payload = JSON.parse(Buffer.from(req.body?.message?.data || '', 'base64').toString('utf8'));
    if (payload.packageName !== play.PACKAGE) return res.status(400).end();
    const token = payload.oneTimeProductNotification?.purchaseToken || payload.voidedPurchaseNotification?.purchaseToken;
    if (typeof token === 'string' && token.length >= 10 && token.length <= 4096) {
      const db = app().database(), stored = (await db.ref('play_secret_receipts/' + play.tokenId(token)).once('value')).val();
      if (stored) await synchronize(db, stored.productId, token, stored);
      else await completeNotification(db, payload.oneTimeProductNotification?.sku, token);
    }
    return res.status(204).end();
  } catch (error) { return res.status(error.statusCode || 503).end(); }
}
