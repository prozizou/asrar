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
  return content + '&signature=' + crypto.sign('sha256', Buffer.from(decodeURIComponent(content), 'utf8'), key).toString('base64url') + '&key_id=123';
}
it('vérifie le message SSV exact, son unité et sa date sans accepter une signature modifiée', () => {
  const q = signed();
  expect(verifyAdMobQuery(q, { 123: publicKey }, now)).toEqual({ sid: 'user1.' + 'a'.repeat(32), oid: 'admob:transaction-1' });
  for (const query of [q.replace('transaction-1', 'transaction-2'), signed({ ad_unit: 'other-unit' }), signed({ timestamp: String(now - 7200001) }), signed({ timestamp: String(now + 300001) }), q + '&extra=1', q.replace('ad_unit=', 'ad_unit=other&ad_unit='), signed({}, crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey)]) expect(verifyAdMobQuery(query, { 123: publicKey }, now)).toBe(null);
  expect(verifyAdMobQuery(q, {}, now)).toBe(null);
});
it('dix points Google confirmés ouvrent un seul passe pendant la pause des autres régies', async () => {
  const nonce = 'a'.repeat(32);
  const db = database();
  const ads = runtime(db, { stubs: { 'server/adReward.js': undefined } })('server/adReward.js');
  const session = await ads.startAdSession('user1', 'admob');
  expect(await ads.consumeAdCredit('user1')).toBe(false);
  const reward = { sid: session.serverId, oid: 'admob:verified-test' };
  expect(await ads.rewardFromAdMob(reward)).toBe(true);
  expect(await ads.rewardFromAdMob(reward)).toBe(false);
  for (let index = 2; index <= 10; index++) {
    expect(await ads.consumeAdCredit('user1')).toBe(false);
    const next = await ads.startAdSession('user1', 'admob');
    expect(await ads.rewardFromAdMob({ sid: next.serverId, oid: 'admob:verified-' + index })).toBe(true);
  }
  expect(await ads.countAdCredits('user1')).toBe(10);
  db.failNext('adRewards/user1', 'transaction');
  await expect(ads.consumeAdCredit('user1')).rejects.toThrow();
  expect(await ads.countAdCredits('user1')).toBe(10);
  const target = 'db_sirr_protection/example';
  const attempts = await Promise.all([ads.consumeAdCredit('user1', target), ads.consumeAdCredit('user1', target)]);
  expect(attempts.sort()).toEqual([false, true]);
  expect(await ads.countAdCredits('user1')).toBe(0);
  expect(await ads.consumeAdCredit('user1')).toBe(false);
  expect(await ads.consumeAdPass('user1', 'almaqtab/other')).toBe(false);
  expect(await ads.consumeAdPass('user1', target)).toBe(true);
  expect(await ads.consumeAdPass('user1', target)).toBe(false);
  await db.ref('adRewards/user1/' + nonce).set({ createdAt: Date.now(), rewarded: true, rewardedAt: Date.now(), provider: 'unity' });
  expect(await ads.consumeAdCredit('user1')).toBe(false);
  expect(await ads.rewardFromAdMob({ sid: 'user1.' + nonce, oid: 'admob:legacy' })).toBe(false);
});
it('lie chaque récompense AdMob au format demandé et conserve les points inutilisés', async () => {
  const db = database();
  const ads = runtime(db, { stubs: { 'server/adReward.js': undefined } })('server/adReward.js');
  const unit = '3047224257';
  const session = await ads.startAdSession('user1', 'admob', true);
  const reward = verifyAdMobQuery(signed({ ad_unit: unit, custom_data: session.serverId }), { 123: publicKey }, now);
  expect(reward).toMatchObject({ interstitial: true });
  expect(await ads.rewardFromAdMob({ ...reward, interstitial: false })).toBe(false);
  expect(await ads.rewardFromAdMob(reward)).toBe(true);
  await db.ref('adRewards/user1/' + session.nonce).update({ rewardedAt: now - 48 * 60 * 60 * 1000 });
  await ads.startAdSession('user1', 'admob');
  expect(await ads.countAdCredits('user1')).toBe(1);
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

it('conserve l’ordre et vérifie le décodage pour une récompense avec caractères échappés', () => {
  const q = signed({ reward_item: 'une utilisation é % / & ?' });
  expect(verifyAdMobQuery(q, { 123: publicKey }, now)).toMatchObject({ oid: 'admob:transaction-1' });
  expect(verifyAdMobQuery(q.replace('utilisation', 'fraude'), { 123: publicKey }, now)).toBe(null);
});

it('accepte les dates Google en ms ou microsecondes avec la même borne de fraîcheur', () => {
  expect(verifyAdMobQuery(signed({ timestamp: String(now * 1000 + 123) }), { 123: publicKey }, now)).not.toBe(null);
  expect(verifyAdMobQuery(signed({ timestamp: String((now + 300001) * 1000) }), { 123: publicKey }, now)).toBe(null);
  expect(verifyAdMobQuery(signed({ timestamp: String((now - 7200001) * 1000) }), { 123: publicKey }, now)).toBe(null);
});

it('accepte la sonde signée de validation AdMob sans jamais accorder de crédit', async () => {
  const probe = signed({ ad_unit: '1234567890', transaction_id: '123456789' });
  expect(verifyAdMobQuery(probe, { 123: publicKey }, now)).toEqual({ test: true });
  expect(verifyAdMobQuery(probe.replace('timestamp=', 'timestamp=0'), { 123: publicKey }, now)).toBe(null);
  const reward = vi.fn();
  const handler = runtime(database(), { stubs: {
    'server/admobVerification.js': { googleKeys: async () => ({ 123: publicKey }), verifyAdMobQuery },
    'server/adReward.js': { rewardFromAdMob: reward },
  } })('pages/api/admob-ssv.js').default;
  const res = { code: 200, setHeader() {}, status(code) { this.code = code; return this; }, end() { return this; } };
  await handler({ method: 'GET', url: '/api/admob-ssv?' + probe }, res);
  expect(res.code).toBe(200); expect(reward).not.toHaveBeenCalled();
});
