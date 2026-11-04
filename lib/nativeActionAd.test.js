import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const sdk = vi.hoisted(() => ({ show: vi.fn(), capabilities: vi.fn(), available: true }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'android', isNativePlatform: () => true, isPluginAvailable: () => sdk.available }, registerPlugin: () => ({ showInterstitial: sdk.show, getCapabilities: sdk.capabilities }) }));
vi.mock('./api', () => ({ apiPost: vi.fn() }));
import { showNativeActionAd, isUnityAdsAvailable } from './unityAds';
const started = Date.now();
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(started); sdk.available = true; sdk.show.mockReset(); sdk.capabilities.mockReset();
  const store = new Map([['asrar_native_ad_at', String(started)]]); vi.stubGlobal('localStorage', { getItem: (key) => store.get(key) || null, setItem: (key, value) => store.set(key, value) });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('Publicité native obligatoire', () => {
  it.each([{ shown: false, reason: 'no_fill' }, { shown: true, completed: false }, { shown: true }, null])('aucun succès pour une réponse incomplète ou sans pub : %j', async (reply) => {
    sdk.show.mockResolvedValue(reply); expect((await showNativeActionAd()).ok).toBe(false);
  });
  it('accepte une publicité complète dès le démarrage puis une autre immédiatement, même avec une ancienne date stockée', async () => {
    sdk.show.mockResolvedValue({ shown: true, completed: true });
    expect(await showNativeActionAd()).toEqual({ ok: true });
    expect(await showNativeActionAd()).toEqual({ ok: true });
    expect(sdk.show).toHaveBeenCalledTimes(2);
  });
  it('les erreurs et le plugin absent refusent le passage', async () => {
    sdk.show.mockRejectedValue(new Error('SDK indisponible')); expect((await showNativeActionAd()).ok).toBe(false);
    sdk.available = false; expect((await showNativeActionAd()).ok).toBe(false);
  });
});

describe('Crédits serveur historiques et médiation', () => {
  it('ne propose pas les crédits Unity S2S lorsque LevelPlay est actif', async () => {
    sdk.capabilities.mockResolvedValue({ mediation: 'levelplay', legacyRewards: false });
    expect(await isUnityAdsAvailable()).toBe(false);
  });
  it('préserve les crédits pour les APK Unity directs', async () => {
    sdk.capabilities.mockResolvedValue({ mediation: 'unity-direct', legacyRewards: true });
    expect(await isUnityAdsAvailable()).toBe(true);
    sdk.capabilities.mockRejectedValue(new Error('UNIMPLEMENTED'));
    expect(await isUnityAdsAvailable()).toBe(true);
  });
});
