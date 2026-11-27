// Réception best-effort même avant connexion ; aucune lecture publique.
const { setCors, parseBody } = require('../../server/http');
const { app } = require('../../server/grant');
const { rateLimit } = require('../../lib/rateLimit');
const { platformOf } = require('../../lib/platform');
const { recordDiagnostics } = require('../../server/diagnostics');
export const config = { api: { bodyParser: { sizeLimit: '24kb' } } };
export default async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'anonymous').split(',')[0].trim().slice(0, 64);
  if (!rateLimit('client-error:' + ip, 20, 60000)) return res.status(204).end();
  try {
    const body = parseBody(req);
    let uid = null;
    if (typeof body.idToken === 'string' && body.idToken.length < 8192) {
      // Sans contrôle de révocation : l'UID sert seulement à l'attribution, et
      // ce contrôle ajoutait un appel réseau Firebase Auth à chaque envoi.
      try { uid = (await app().auth().verifyIdToken(body.idToken)).uid; } catch { /* anonyme */ }
    }
    const events = Array.isArray(body.events) ? body.events.slice(0, 5) : [body];
    const context = { source: ip, uid, platform: platformOf(req.headers['user-agent']) };
    await recordDiagnostics(app().database(), events, context);
  } catch {
    // Ne jamais réinjecter une panne du suivi dans le suivi lui-même.
    console.error('[diagnostics] Enregistrement indisponible');
  }
  return res.status(204).end();
}
