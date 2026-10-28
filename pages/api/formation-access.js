// Fonctionnalité retirée : ne jamais débiter les anciens crédits.
const { setCors, parseBody } = require('../../server/http');
const { verifyUser } = require('../../server/access');
export default async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });
  try { await verifyUser(parseBody(req).idToken); }
  catch (error) { return res.status(error.statusCode || 401).json({ error: 'Session invalide.' }); }
  return res.status(410).json({ error: 'La visioconférence n’est plus proposée dans cette application.', code: 'FEATURE_RETIRED' });
}
