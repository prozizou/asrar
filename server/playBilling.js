const { GoogleAuth, OAuth2Client } = require('google-auth-library');
const { createHash } = require('node:crypto');
const PACKAGE = 'com.Asrar';
const error = (statusCode, message, code) => Object.assign(new Error(message), { statusCode, code });
const accountId = (uid) => createHash('sha256').update('asrar-secret:' + uid).digest('hex');
const tokenId = (token) => createHash('sha256').update(token).digest('hex');
let auth;
async function client() {
  if (!process.env.PLAY_BILLING_SERVICE_ACCOUNT) throw error(503, 'Les achats sont temporairement indisponibles.', 'BILLING_NOT_CONFIGURED');
  if (!auth) {
    try {
      const raw = process.env.PLAY_BILLING_SERVICE_ACCOUNT;
      const credentials = JSON.parse(raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
      auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
    } catch { throw error(503, 'Configuration des achats indisponible.'); }
  }
  return auth.getClient();
}
async function request(productId, token, acknowledge = false) {
  try {
    const api = await client();
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}${acknowledge ? ':acknowledge' : ''}`;
    const result = await api.request({ url, method: acknowledge ? 'POST' : 'GET', ...(acknowledge ? { data: {} } : {}), timeout: 10000, retry: false });
    return result.data;
  } catch (cause) {
    // Google request errors contain a URL with the purchase token: never propagate them.
    if (cause.code === 'BILLING_NOT_CONFIGURED') throw cause;
    throw error(503, 'La vérification Google Play a échoué. Réessayez ou restaurez vos achats.', 'PLAY_UNAVAILABLE');
  }
}
function validatePurchase(purchase, uid) {
  if (purchase?.purchaseState !== 0) throw error(409, 'Achat en attente, annulé ou remboursé.', 'PURCHASE_NOT_COMPLETED');
  if (purchase.consumptionState !== 0 || Number(purchase.quantity || 1) !== 1 || purchase.obfuscatedExternalAccountId !== accountId(uid)) {
    throw error(403, 'Cet achat ne correspond pas à ce compte ASRAR.', 'PURCHASE_ACCOUNT_MISMATCH');
  }
}
async function verifyNotification(req) {
  const token = /^Bearer (\S+)$/.exec(req.headers.authorization || '')?.[1];
  const audience = process.env.PLAY_RTDN_AUDIENCE, email = process.env.PLAY_RTDN_SERVICE_ACCOUNT_EMAIL;
  if (!token || !audience || !email) throw error(401, 'Notification non autorisée.');
  try {
    const ticket = await new OAuth2Client().verifyIdToken({ idToken: token, audience });
    const identity = ticket.getPayload();
    if (identity.email !== email || identity.email_verified !== true) throw new Error('identity');
  } catch { throw error(401, 'Notification non autorisée.'); }
}
module.exports = { PACKAGE, accountId, tokenId, validatePurchase, getPurchase: (product, token) => request(product, token), acknowledge: (product, token) => request(product, token, true), verifyNotification, error };
