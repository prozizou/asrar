const { app } = require('../../server/grant');
const { verifyUser, getAccessStatus, isAdmin } = require('../../server/access');
const { setCors, parseBody } = require('../../server/http');
const { rateLimit } = require('../../lib/rateLimit');
const secrets = require('../../server/secretPurchases');
export default async function handler(req, res) {
  setCors(req, res); res.setHeader('Cache-Control', 'private, no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });
  try {
    const body = parseBody(req), user = await verifyUser(body.idToken), db = app().database();
    if (!rateLimit('secret-purchases:' + user.uid, 40, 60000)) return res.status(429).json({ error: 'Patientez avant de réessayer.' });
    if (body.action === 'offer') return res.json(await secrets.offer(db, user, body.cat, body.key, await getAccessStatus(user)));
    if (body.action === 'verify') return res.json(await secrets.verify(db, user, body.productId, body.purchaseToken));
    if (['configure', 'activate'].includes(body.action)) {
      if (!(await isAdmin(user))) return res.status(403).json({ error: 'Accès administrateur requis.' });
      return res.json(body.action === 'activate' ? await secrets.activate(db) : await secrets.configure(db, body.cat, body.key, body.productId));
    }
    return res.status(400).json({ error: 'Action inconnue.' });
  } catch (error) {
    // No purchase token, Google response, credential or request URL in logs or output.
    return res.status(error.statusCode || 503).json({ error: error.statusCode ? error.message : 'Les achats sont momentanément indisponibles.', ...(error.code ? { code: error.code } : {}) });
  }
}
