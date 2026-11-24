import { describe, it, expect, vi, beforeEach } from 'vitest';
const sdk = vi.hoisted(() => ({ capabilities: vi.fn(), show: vi.fn(), native: true }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'android', isNativePlatform: () => sdk.native, isPluginAvailable: () => sdk.native }, registerPlugin: () => ({ getCapabilities: sdk.capabilities, showRewarded: sdk.show }) }));
vi.mock('./api', () => ({ apiPost: vi.fn() }));
import { apiPost } from './api';
import { isUnityAdsAvailable, watchRewardedAd, consumeAdCredit } from './unityAds';
beforeEach(() => { vi.clearAllMocks(); sdk.native = true; sdk.capabilities.mockResolvedValue({ mediation: 'admob', adMobRewards: true, legacyRewards: false }); });
describe('AdMob Android pendant la pause web/Unity', () => {
  it('propose la récompense uniquement au nouveau pont Android', async () => {
    expect(await isUnityAdsAvailable()).toBe(true);
    sdk.native = false; expect(await isUnityAdsAvailable()).toBe(false);
    sdk.native = true; sdk.capabilities.mockResolvedValue({ mediation: 'levelplay', legacyRewards: false });
    expect(await isUnityAdsAvailable()).toBe(false);
  });
  it('attend la validation serveur puis consomme un crédit', async () => {
    apiPost.mockImplementation(async (_path, body) => body.action === 'start' ? { serverId: 'user1.nonce', nonce: 'nonce' } : body.action === 'status' ? { rewarded: true } : { ok: true });
    sdk.show.mockResolvedValue({ shown: true, completed: true });
    expect(await watchRewardedAd()).toEqual({ ok: true });
    expect(apiPost).toHaveBeenCalledWith('ad-reward', { action: 'start', provider: 'admob' });
    expect(sdk.show).toHaveBeenCalledWith(expect.objectContaining({ serverId: 'user1.nonce' }));
    expect(await consumeAdCredit()).toBe(true);
  });
  it('une vidéo interrompue ne déclenche aucune vérification de récompense', async () => {
    apiPost.mockResolvedValue({ serverId: 'user1.nonce', nonce: 'nonce' });
    sdk.show.mockResolvedValue({ shown: true, completed: false });
    expect(await watchRewardedAd()).toEqual({ ok: false, reason: 'skipped' });
    expect(apiPost).toHaveBeenCalledTimes(1);
  });
});
