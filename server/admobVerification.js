// Google SSV: verify the original, unmodified query using Google's public keys.
const crypto = require('node:crypto');
const AD_UNIT = 'ca-app-pub-3895250961868134/9551701662';
let cached, expires = 0;
async function googleKeys() {
  if (cached && Date.now() < expires) return cached;
  const response = await fetch('https://www.gstatic.com/admob/reward/verifier-keys.json', { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw Error('SSV keys unavailable');
  const body = await response.text();
  if (body.length > 64000) throw Error('Invalid SSV keys');
  const data = JSON.parse(body);
  const keys = Object.fromEntries((data.keys || []).slice(0, 20).filter(k => /^\d+$/.test(String(k.keyId)) && typeof k.pem === 'string').map(k => [String(k.keyId), k.pem]));
  if (!Object.keys(keys).length) throw Error('Empty SSV keys');
  cached = keys; expires = Date.now() + 3600000;
  return keys;
}
function verifyAdMobQuery(query, keys, now = Date.now()) {
  if (typeof query !== 'string' || query.length > 8192) return null;
  const split = query.indexOf('&signature=');
  if (split < 1) return null;
  const signed = query.slice(0, split), tail = query.slice(split + 1);
  if (!/^signature=[A-Za-z0-9_%=\-]+&key_id=\d+$/.test(tail)) return null;
  const params = new URLSearchParams(query);
  for (const key of new Set(params.keys())) if (params.getAll(key).length !== 1) return null;
  const key = keys[params.get('key_id')];
  const signature = params.get('signature') || '';
  if (!key || !/^[A-Za-z0-9_-]+={0,2}$/.test(signature)) return null;
  try { if (!crypto.verify('sha256', Buffer.from(signed), key, Buffer.from(signature, 'base64url'))) return null; }
  catch { return null; }
  const unit = params.get('ad_unit');
  const timestamp = Number(params.get('timestamp'));
  if (![AD_UNIT, AD_UNIT.split('/')[1]].includes(unit) || !Number.isSafeInteger(timestamp) || timestamp > now + 300000 || now - timestamp > 7200000) return null;
  const transaction = params.get('transaction_id');
  if (!transaction || transaction.length > 256) return null;
  return { sid: params.get('custom_data'), oid: 'admob:' + transaction };
}
module.exports = { verifyAdMobQuery, googleKeys, AD_UNIT };
