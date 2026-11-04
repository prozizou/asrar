const { verifyUser } = require('../../server/access');
const { setCors, parseBody } = require('../../server/http');

// Older Android clients must not start or activate a new Google Play purchase.
export default async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });
  try {
    await verifyUser(parseBody(req).idToken);
    return res.status(410).json({ code: 'PLAY_BILLING_RETIRED', error: 'Les achats Google Play ont été retirés. L’application reste gratuite. Retrouvez les abonnements sans publicités dans Mon compte.' });
  } catch (error) {
    return res.status(error.statusCode || 503).json({ error: error.statusCode ? error.message : 'Service momentanément indisponible.' });
  }
}
