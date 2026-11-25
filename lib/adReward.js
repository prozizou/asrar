// lib/adReward.js — Logique pure des sessions et points publicitaires
// (aucune dépendance React ni Firebase,
// même interop que lib/rateLimit.js). SERVEUR UNIQUEMENT (node:crypto) —
// utilisé par server/adReward.js ; le client passe par lib/unityAds.js.
//
// Vérification : rappel « server-to-server » de Unity (redeem callback). À la
// fin d'une publicité regardée en entier, les serveurs Unity appellent
// /api/unity-ads-callback avec `sid` (serverId posé par l'app avant l'affichage),
// `oid` (identifiant unique de l'offre) et `hmac` : HMAC-MD5, clé = secret
// fourni par Unity, des paramètres hors `hmac` triés par nom, au format
// « clé=valeur » joints par des virgules. Seul ce rappel crédite : l'app ne
// peut pas s'auto-déclarer récompensée.

import crypto from 'crypto';

// Délai maximal entre la création d'une session et le rappel Unity.
export const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
// Conservation des anciens crédits Unity et des points AdMob déjà débités.
export const CREDIT_TTL_MS = 24 * 60 * 60 * 1000;
// Plafond historique Unity.
export const MAX_UNUSED_CREDITS = 3;
// Passe ouvert par le débit des points, pour l'appel serveur qui suit
// immédiatement (get-content : secret, livre) — usage unique.
export const PASS_TTL_MS = 10 * 60 * 1000;

const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const NONCE_RE = /^[a-f0-9]{32}$/;

export function newNonce() {
  return crypto.randomBytes(16).toString('hex');
}

// serverId transmis à Unity : relie la publicité au compte et à la session.
export function buildServerId(uid, nonce) {
  return uid + '.' + nonce;
}

export function parseServerId(sid) {
  if (typeof sid !== 'string') return null;
  const [uid, nonce, ...rest] = sid.split('.');
  if (rest.length || !UID_RE.test(uid || '') || !NONCE_RE.test(nonce || '')) return null;
  return { uid, nonce };
}

export function unityParamString(params) {
  return Object.keys(params)
    .filter((k) => k !== 'hmac')
    .sort()
    .map((k) => k + '=' + params[k])
    .join(',');
}

export function unityHmac(params, secret) {
  return crypto.createHmac('md5', secret).update(unityParamString(params)).digest('hex');
}

export function verifyUnityCallback(params, secret) {
  if (!secret || !params || typeof params.hmac !== 'string') return false;
  const expected = Buffer.from(unityHmac(params, secret), 'hex');
  const given = Buffer.from(params.hmac.toLowerCase(), 'hex');
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

// Clé RTDB sûre pour dédoublonner un `oid` (caractères libres côté Unity).
export function offerKey(oid) {
  return crypto.createHash('sha1').update(String(oid)).digest('hex');
}

function isUsableCredit(r, now) {
  return !!r && r.rewarded === true && !r.used && typeof r.rewardedAt === 'number' && (r.provider === 'admob' || now - r.rewardedAt < CREDIT_TTL_MS);
}

// Nombre de crédits consommables dans adRewards/{uid}.
export function countCredits(rewards, now = Date.now()) {
  return Object.values(rewards || {}).filter((r) => isUsableCredit(r, now)).length;
}

// Nonce du crédit à consommer (le plus ancien d'abord), ou null.
export function pickCredits(rewards, amount, now = Date.now()) {
  return Object.entries(rewards || {})
    .filter(([, reward]) => isUsableCredit(reward, now))
    .sort(([, a], [, b]) => a.rewardedAt - b.rewardedAt)
    .slice(0, amount)
    .map(([nonce]) => nonce);
}

export function pickCredit(rewards, now = Date.now()) {
  return pickCredits(rewards, 1, now)[0] || null;
}

// Session que le rappel Unity peut marquer récompensée.
export function canReward(session, now = Date.now()) {
  return !!session && typeof session.createdAt === 'number' && now - session.createdAt < SESSION_TTL_MS && !session.rewarded;
}

// Entrées à purger : sessions jamais récompensées et crédits périmés.
export function staleNonces(rewards, now = Date.now()) {
  return Object.entries(rewards || {})
    .filter(([, r]) => {
      if (!r || typeof r.createdAt !== 'number') return true;
      if (r.rewarded) return (r.provider !== 'admob' || r.used) && now - (r.rewardedAt || r.createdAt) >= CREDIT_TTL_MS;
      return now - r.createdAt >= SESSION_TTL_MS;
    })
    .map(([nonce]) => nonce);
}

export function isPassUsable(pass, now = Date.now()) {
  return !!pass && typeof pass.until === 'number' && pass.until > now && (Number(pass.uses) || 0) > 0;
}
