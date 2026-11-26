import { describe, it, expect, vi, beforeEach } from 'vitest';

const sdk = vi.hoisted(() => ({ capabilities: vi.fn(), show: vi.fn(), cancel: vi.fn() }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'android', isNativePlatform: () => true, isPluginAvailable: () => true },
  registerPlugin: () => ({ getCapabilities: sdk.capabilities, showRewarded: sdk.show, cancelRewarded: sdk.cancel }),
}));
vi.mock('./api', () => ({ apiPost: vi.fn() }));
import { apiPost } from './api';
import { watchRewardedAd, cancelRewardedAd, nativeOutcomeReason } from './unityAds';

const SESSION = { nonce: 'n', serverId: 'u.' + 'a'.repeat(32) };

beforeEach(() => {
  vi.clearAllMocks();
  sdk.capabilities.mockResolvedValue({ adMobRewards: true, rewardedSilentLoading: true });
  apiPost.mockImplementation(async (_route, body) => (body.action === 'start' ? SESSION : { rewarded: true }));
});

describe('nativeOutcomeReason', () => {
  it('distingue une annulation, une vidéo interrompue et une annonce absente', () => {
    expect(nativeOutcomeReason({ shown: false, reason: 'cancelled' })).toBe('cancelled');
    expect(nativeOutcomeReason({ shown: true, completed: false })).toBe('skipped');
    expect(nativeOutcomeReason({ shown: false, reason: 'skipped' })).toBe('cancelled');
    for (const reason of ['no_fill', 'timeout', 'load', 'init']) expect(nativeOutcomeReason({ shown: false, reason })).toBe('no_fill');
    expect(nativeOutcomeReason({ shown: false, reason: 'consent' })).toBe('unavailable');
    expect(nativeOutcomeReason({ shown: false, reason: 'background' })).toBe('error');
    expect(nativeOutcomeReason(undefined)).toBe('error');
  });
});

describe('watchRewardedAd', () => {
  it('demande l’attente sans fenêtre Android au nouvel APK et annonce les étapes', async () => {
    const phases = [];
    sdk.show.mockResolvedValue({ shown: true, completed: true });
    expect(await watchRewardedAd(false, { onPhase: (phase) => phases.push(phase) })).toEqual({ ok: true });
    expect(sdk.show.mock.calls[0][0].silent).toBe(true);
    expect(phases).toEqual(['loading', 'validating']);
  });

  it('garde l’ancienne fenêtre pour un APK sans la capacité', async () => {
    sdk.capabilities.mockResolvedValue({ adMobRewards: true });
    sdk.show.mockResolvedValue({ shown: true, completed: true });
    await watchRewardedAd();
    expect(sdk.show.mock.calls[0][0]).not.toHaveProperty('silent');
  });

  it('une annonce absente n’est plus confondue avec une vidéo interrompue', async () => {
    sdk.show.mockResolvedValue({ shown: false, completed: false, reason: 'no_fill' });
    expect(await watchRewardedAd()).toEqual({ ok: false, reason: 'no_fill' });
  });

  it('une annulation avant la vidéo ne déclenche aucune vérification', async () => {
    sdk.show.mockResolvedValue({ shown: false, completed: false, reason: 'cancelled' });
    expect(await watchRewardedAd()).toEqual({ ok: false, reason: 'cancelled' });
    expect(apiPost.mock.calls.filter(([, body]) => body.action === 'status')).toHaveLength(0);
  });
});

describe('cancelRewardedAd', () => {
  it('annule la demande en cours au nouvel APK', async () => {
    expect(await cancelRewardedAd()).toBe(true);
    expect(sdk.cancel).toHaveBeenCalledTimes(1);
  });

  it('ne fait rien sur un ancien APK', async () => {
    sdk.capabilities.mockResolvedValue({ adMobRewards: true });
    expect(await cancelRewardedAd()).toBe(false);
    expect(sdk.cancel).not.toHaveBeenCalled();
  });
});
