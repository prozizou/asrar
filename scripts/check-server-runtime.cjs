// AWS Lambda désactive require(ESM) par défaut. Reproduire cette contrainte,
// puis appliquer les options déclarées pour le déploiement Vercel.
const { spawnSync } = require('node:child_process');
const config = require('../vercel.json');
const options = String(config.env?.NODE_OPTIONS || '').split(/\s+/).filter(Boolean);
const result = spawnSync(process.execPath, ['--no-experimental-require-module', ...options,
  '-e', "require('./.next/server/pages/api/check-access.js'); console.log('Imports API compatibles avec le runtime Vercel');"],
{ stdio: 'inherit', cwd: require('node:path').resolve(__dirname, '..'), env: process.env });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
