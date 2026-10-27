// Diagnostic de démarrage sans accès aux données Firebase ni exposition des secrets.
// Les imports SDK restent dans le try : une dépendance absente doit produire
// un diagnostic JSON au lieu de faire échouer la route avant son exécution.
const { rateLimit } = require('../../lib/rateLimit');
const { reportError } = require('../../server/log');
const ERROR_CODES = new Set(['MODULE_NOT_FOUND', 'ERR_REQUIRE_ESM', 'ERR_PACKAGE_PATH_NOT_EXPORTED']);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée.' });
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim().slice(0, 80);
  if (!rateLimit('health:' + ip, 15, 60000)) return res.status(429).json({ error: 'Trop de demandes.' });
  const runtime = process.version;
  let stage = 'firebase_import';
  try {
    const { app } = require('../../server/grant');
    stage = 'firebase_configuration';
    const admin = app();
    admin.auth(); admin.database();
    return res.json({ status: 'ready', runtime, checks: { firebaseImport: true, firebaseConfiguration: true }, databaseConnection: 'not_tested' });
  } catch (error) {
    await reportError('health:' + stage, error);
    const code = ERROR_CODES.has(error.code) ? error.code : 'FIREBASE_INITIALIZATION_FAILED';
    const missing = code === 'MODULE_NOT_FOUND' && String(error.message).match(/^Cannot find module ['"]([^'"]+)['"]/);
    // Seulement un nom de paquet : aucune adresse, clé, stack ou chemin absolu.
    const dependency = missing && missing[1].match(/^(?:@[a-z0-9._-]+\/)?[a-z0-9_-]+(?:\/[a-z0-9._-]+)*$/i);
    return res.status(503).json({ status: 'unavailable', runtime, stage, code,
      ...(dependency ? { dependency: dependency[0] } : {}) });
  }
}
