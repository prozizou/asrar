import { it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { database, runtime } from './support/runtime';
const require = createRequire(import.meta.url);
const { verifyAdMobQuery, AD_UNIT } = require('../server/admobVerification');
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const now = Date.now();
function signed(overrides = {}, key = privateKey) {
  const content = new URLSearchParams({ ad_unit: AD_UNIT, custom_data: 'user1.' + 'a'.repeat(32), transaction_id: 'transaction-1', timestamp: String(now), ...overrides }).toString();
  return content + '&signature=' + crypto.sign('sha256', Buffer.from(content), key).toString('base64url') + '&key_id=123';
}
it('vérifie le message SSV exact, son unité et sa date sans accepter une signature modifiée', () => {
  const q = signed();
  expect(verifyAdMobQuery(q, { 123: publicKey }, now)).toEqual({ sid: 'user1.' + 'a'.repeat(32), oid: 'admob:transaction-1' });
  for (const query of [q.replace('transaction-1', 'transaction-2'), signed({ ad_unit: 'other-unit' }), signed({ timestamp: String(now - 7200001) }), signed({ timestamp: String(now + 300001) }), q + '&extra=1', q.replace('ad_unit=', 'ad_unit=other&ad_unit='), signed({}, crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey)]) expect(verifyAdMobQuery(query, { 123: publicKey }, now)).toBe(null);
  expect(verifyAdMobQuery(q, {}, now)).toBe(null);
});
it('seul un crédit Google confirmé peut être consommé pendant la pause des autres régies', async () => {
  const nonce = 'a'.repeat(32);
  const db = database();
  const ads = runtime(db, { stubs: { 'server/adReward.js': undefined } })('server/adReward.js');
  const session = await ads.startAdSession('user1', 'admob');
  expect(await ads.consumeAdCredit('user1')).toBe(false);
  const reward = { sid: session.serverId, oid: 'admob:verified-test' };
  expect(await ads.rewardFromAdMob(reward)).toBe(true);
  expect(await ads.rewardFromAdMob(reward)).toBe(false);
  expect(await ads.consumeAdCredit('user1')).toBe(true);
  expect(await ads.consumeAdCredit('user1')).toBe(false);
  expect(await ads.consumeAdPass('user1')).toBe(true);
  expect(await ads.consumeAdPass('user1')).toBe(false);
  await db.ref('adRewards/user1/' + nonce).set({ createdAt: Date.now(), rewarded: true, rewardedAt: Date.now(), provider: 'unity' });
  expect(await ads.consumeAdCredit('user1')).toBe(false);
  expect(await ads.rewardFromAdMob({ sid: 'user1.' + nonce, oid: 'admob:legacy' })).toBe(false);
});
it('le endpoint SSV ne traite jamais un rappel invalide ou une requête POST', async () => {
  const reward = vi.fn();
  const handler = runtime(database(), { stubs: {
    'server/admobVerification.js': { googleKeys: async () => ({ 123: publicKey }), verifyAdMobQuery },
    'server/adReward.js': { rewardFromAdMob: reward },
  } })('pages/api/admob-ssv.js').default;
  const invoke = async (method, query = '') => { const res = { code: 200, setHeader() {}, status(code) { this.code = code; return this; }, end() { return this; } }; await handler({ method, url: '/api/admob-ssv?' + query }, res); return res; };
  expect((await invoke('POST')).code).toBe(405);
  expect((await invoke('GET', signed({ ad_unit: 'wrong' }))).code).toBe(403);
  expect(reward).not.toHaveBeenCalled();
  expect((await invoke('GET', signed())).code).toBe(200);
  expect(reward).toHaveBeenCalledTimes(1);
});

it('un rappel retenté après une panne conserve la récompense sans changer de session', async () => {
  const db = database(), ads = runtime(db, { stubs: { 'server/adReward.js': undefined } })('server/adReward.js');
  const session = await ads.startAdSession('user1', 'admob');
  db.failNext('adRewards/user1/' + session.nonce, 'transaction');
  const reward = { sid: session.serverId, oid: 'admob:retry-test' };
  await expect(ads.rewardFromAdMob(reward)).rejects.toThrow();
  expect(await ads.rewardFromAdMob(reward)).toBe(true);
  expect(await ads.countAdCredits('user1')).toBe(1);
  const other = await ads.startAdSession('user2', 'admob');
  expect(await ads.rewardFromAdMob({ sid: other.serverId, oid: reward.oid })).toBe(false);
  expect(await ads.countAdCredits('user2')).toBe(0);
});
