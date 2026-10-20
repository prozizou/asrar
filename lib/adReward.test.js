import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  buildServerId,
  parseServerId,
  newNonce,
  unityParamString,
  verifyUnityCallback,
  offerKey,
  countCredits,
  pickCredit,
  canReward,
  staleNonces,
  isPassUsable,
  SESSION_TTL_MS,
  CREDIT_TTL_MS,
} from './adReward';

const SECRET = 'xyzKEY';
// Signature calculée indépendamment, comme le fait Unity : HMAC-MD5 de
// « clé=valeur » triés, joints par des virgules, hors `hmac`.
const sign = (s) => crypto.createHmac('md5', SECRET).update(s).digest('hex');

describe('serverId', () => {
  it('aller-retour uid + nonce', () => {
    const nonce = newNonce();
    expect(nonce).toMatch(/^[a-f0-9]{32}$/);
    expect(parseServerId(buildServerId('abcDEF123', nonce))).toEqual({ uid: 'abcDEF123', nonce });
  });

  it('refuse les formes invalides', () => {
    const n = 'a'.repeat(32);
    expect(parseServerId(undefined)).toBeNull();
    expect(parseServerId('abc')).toBeNull();
    expect(parseServerId('ab/c.' + n)).toBeNull();
    expect(parseServerId('abc.' + n + '.x')).toBeNull();
    expect(parseServerId('abc.' + 'Z'.repeat(32))).toBeNull();
  });
});

describe('vérification du rappel Unity', () => {
  const params = { sid: 'u1.' + 'b'.repeat(32), oid: '123456', productid: '6204107' };

  it('chaîne signée : paramètres triés, hors hmac', () => {
    expect(unityParamString({ ...params, hmac: 'x' })).toBe('oid=123456,productid=6204107,sid=u1.' + 'b'.repeat(32));
  });

  it('accepte une signature valide (casse indifférente)', () => {
    const hmac = sign(unityParamString(params));
    expect(verifyUnityCallback({ ...params, hmac }, SECRET)).toBe(true);
    expect(verifyUnityCallback({ ...params, hmac: hmac.toUpperCase() }, SECRET)).toBe(true);
  });

  it('refuse une signature fausse, un paramètre modifié ou un secret absent', () => {
    const hmac = sign(unityParamString(params));
    expect(verifyUnityCallback({ ...params, hmac: '0'.repeat(32) }, SECRET)).toBe(false);
    expect(verifyUnityCallback({ ...params, sid: 'u2.' + 'b'.repeat(32), hmac }, SECRET)).toBe(false);
    expect(verifyUnityCallback({ ...params, hmac: 'pas-hex' }, SECRET)).toBe(false);
    expect(verifyUnityCallback({ ...params }, SECRET)).toBe(false);
    expect(verifyUnityCallback({ ...params, hmac }, '')).toBe(false);
  });

  it('offerKey : clé RTDB stable et sûre', () => {
    expect(offerKey('a.b#c$[d]/e')).toMatch(/^[a-f0-9]{40}$/);
    expect(offerKey('x')).toBe(offerKey('x'));
  });
});

describe('crédits', () => {
  const now = 10 * CREDIT_TTL_MS;
  const rewards = {
    old: { createdAt: now - CREDIT_TTL_MS - 5000, rewarded: true, rewardedAt: now - CREDIT_TTL_MS - 1000 },
    used: { createdAt: now - 5000, rewarded: true, rewardedAt: now - 4000, used: true },
    a: { createdAt: now - 9000, rewarded: true, rewardedAt: now - 8000 },
    b: { createdAt: now - 3000, rewarded: true, rewardedAt: now - 2000 },
    pending: { createdAt: now - 1000 },
  };

  it('compte seulement les crédits récompensés, non utilisés, non périmés', () => {
    expect(countCredits(rewards, now)).toBe(2);
    expect(countCredits(null, now)).toBe(0);
  });

  it('consomme le plus ancien d’abord', () => {
    expect(pickCredit(rewards, now)).toBe('a');
    expect(pickCredit({ pending: rewards.pending }, now)).toBeNull();
  });

  it('canReward : session récente, pas encore récompensée', () => {
    expect(canReward({ createdAt: now - 1000 }, now)).toBe(true);
    expect(canReward({ createdAt: now - SESSION_TTL_MS }, now)).toBe(false);
    expect(canReward({ createdAt: now - 1000, rewarded: true }, now)).toBe(false);
    expect(canReward(null, now)).toBe(false);
  });

  it('staleNonces : sessions expirées et crédits périmés', () => {
    const r = {
      ...rewards,
      expired: { createdAt: now - SESSION_TTL_MS - 1 },
      broken: 'x',
    };
    expect(staleNonces(r, now).sort()).toEqual(['broken', 'expired', 'old']);
  });

  it('passe à usage unique', () => {
    expect(isPassUsable({ until: now + 1000, uses: 1 }, now)).toBe(true);
    expect(isPassUsable({ until: now + 1000, uses: 0 }, now)).toBe(false);
    expect(isPassUsable({ until: now - 1, uses: 1 }, now)).toBe(false);
    expect(isPassUsable(null, now)).toBe(false);
  });
});
