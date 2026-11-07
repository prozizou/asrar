import { describe, it, expect, vi } from 'vitest';
import { ADS_PAUSED, FREE_FOR_ALL } from './plans';
const sdk = vi.hoisted(() => ({ prepare: vi.fn(), show: vi.fn(), capabilities: vi.fn(async () => ({ actionAdPreload: true })) }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'android', isNativePlatform: () => true, isPluginAvailable: () => true }, registerPlugin: () => ({ getCapabilities: sdk.capabilities, prepareActionAd: sdk.prepare, showInterstitial: sdk.show, showRewarded: sdk.show }) }));
vi.mock('./api', () => ({ apiPost: vi.fn() }));
import { apiPost } from './api';
import { openActionAd } from './actionAd';
import { showNativeActionAd, watchRewardedAd, consumeAdCredit, isUnityAdsAvailable, prepareNativeActionAd } from './unityAds';

describe.skipIf(!ADS_PAUSED)('Pause publicitaire de production', () => {
  it('demande un abonnement sans lancer de publicité ni créer de crédit', async () => {
    expect(ADS_PAUSED).toBe(true); expect(FREE_FOR_ALL).toBe(false);
    expect(openActionAd()).toBe('blocked');
    expect(await isUnityAdsAvailable()).toBe(false);
    expect(await showNativeActionAd()).toEqual({ ok: false, reason: 'paused' });
    expect(await watchRewardedAd()).toEqual({ ok: false, reason: 'paused' });
    expect(await consumeAdCredit()).toBe(false);
    expect(sdk.show).not.toHaveBeenCalled(); expect(apiPost).not.toHaveBeenCalled();
  });
  it('désactive le préchargement natif même si un appelant demande son activation', async () => {
    await prepareNativeActionAd(true);
    expect(sdk.prepare).toHaveBeenCalledWith({ enabled: false });
    expect(sdk.show).not.toHaveBeenCalled();
  });
});
