import { describe, it, expect, vi, beforeEach } from 'vitest';

const sdk = vi.hoisted(() => ({ native: true, capabilities: vi.fn(), preload: vi.fn() }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'android', isNativePlatform: () => sdk.native, isPluginAvailable: () => sdk.native },
  registerPlugin: () => ({ getCapabilities: sdk.capabilities, preloadRewarded: sdk.preload }),
}));

import { prepareRewardedAd } from './unityAds';

beforeEach(() => {
  sdk.native = true;
  sdk.capabilities = vi.fn().mockResolvedValue({ adMobRewards: true, rewardedPreload: true });
  sdk.preload = vi.fn().mockResolvedValue(undefined);
});

describe('prepareRewardedAd', () => {
  it('active le préchargement dans l’application Android récente', async () => {
    expect(await prepareRewardedAd(true)).toBe(true);
    expect(sdk.preload).toHaveBeenCalledWith({ enabled: true });
  });

  it('le coupe pour un abonné ou une déconnexion', async () => {
    expect(await prepareRewardedAd(false)).toBe(true);
    expect(sdk.preload).toHaveBeenCalledWith({ enabled: false });
  });

  it('ne fait rien dans un ancien APK sans la capacité', async () => {
    sdk.capabilities = vi.fn().mockResolvedValue({ adMobRewards: true });
    expect(await prepareRewardedAd(true)).toBe(false);
    expect(sdk.preload).not.toHaveBeenCalled();
  });

  it('ne fait rien sans les récompenses AdMob', async () => {
    sdk.capabilities = vi.fn().mockResolvedValue({ adMobRewards: false, rewardedPreload: true });
    expect(await prepareRewardedAd(true)).toBe(false);
    expect(sdk.preload).not.toHaveBeenCalled();
  });

  it('ne fait rien hors de l’application Android', async () => {
    sdk.native = false;
    expect(await prepareRewardedAd(true)).toBe(false);
    expect(sdk.preload).not.toHaveBeenCalled();
  });

  it('ne plante jamais si le plugin échoue', async () => {
    sdk.preload = vi.fn().mockRejectedValue(new Error('boom'));
    expect(await prepareRewardedAd(true)).toBe(false);
  });

  it('une demande plus récente annule la précédente (activer puis couper aussitôt)', async () => {
    const caps = { adMobRewards: true, rewardedPreload: true };
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    let calls = 0;
    // Le premier appel attend la porte ; le second répond tout de suite.
    sdk.capabilities = vi.fn().mockImplementation(() => (++calls === 1 ? gate.then(() => caps) : Promise.resolve(caps)));
    const first = prepareRewardedAd(true);
    // Le premier appel atteint la porte avant que le second ne démarre (évite deux imports dynamiques simultanés du module simulé).
    await new Promise((resolve) => setTimeout(resolve, 0));
    const second = prepareRewardedAd(false);
    await second;
    release();
    expect(await first).toBe(false);
    expect(sdk.preload).toHaveBeenCalledTimes(1);
    expect(sdk.preload).toHaveBeenCalledWith({ enabled: false });
  });
});
