import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADSTERRA_SMARTLINK, AD_WAIT_MS, openActionAd, recordAdOutcome, sampleAdTab } from './actionAd';

function browser({ active = true, opened = true, native = false } = {}) {
  const store = new Map();
  const tab = { opener: 'page', closed: false };
  const open = vi.fn(() => (opened ? tab : null));
  vi.stubGlobal('window', { open, Capacitor: native ? { isNativePlatform: () => true } : undefined });
  vi.stubGlobal('navigator', { userActivation: { isActive: active } });
  vi.stubGlobal('sessionStorage', { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) });
  const local = new Map();
  vi.stubGlobal('localStorage', { getItem: (k) => local.get(k) ?? null, setItem: (k, v) => local.set(k, v), removeItem: (k) => local.delete(k) });
  return { open, tab, local };
}

describe('Pub obligatoire au clic sur les boutons d’action', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('ouvre le Smartlink à chaque action, sans lien vers la page', () => {
    const { open, tab } = browser();
    expect(openActionAd()).toBe('opened');
    expect(open).toHaveBeenCalledWith(ADSTERRA_SMARTLINK, '_blank');
    expect(tab.opener).toBeNull();
    vi.advanceTimersByTime(5000);
    expect(openActionAd()).toBe('opened');
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('un même clic (plusieurs vérifications rapprochées) ne paie qu’une pub', () => {
    const { open } = browser();
    expect(openActionAd()).toBe('opened');
    expect(openActionAd()).toBe('skipped');
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('un onglet bloqué refuse l’action et ne compte pas comme vu', () => {
    const { open } = browser({ opened: false });
    expect(openActionAd()).toBe('blocked');
    expect(openActionAd()).toBe('blocked');
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('aucune pub hors d’un clic ni dans l’APK', () => {
    expect(browser({ active: false }) && openActionAd()).toBe('skipped');
    expect(window.open).not.toHaveBeenCalled();
    browser({ native: true });
    expect(openActionAd()).toBe('skipped');
    expect(window.open).not.toHaveBeenCalled();
  });

  describe('mesure de la fermeture de l’onglet de pub', () => {
    const finish = (closeAfterMs) => {
      const { tab, local } = browser();
      openActionAd();
      if (closeAfterMs != null) {
        vi.advanceTimersByTime(closeAfterMs);
        tab.closed = true;
        sampleAdTab();
      }
      vi.advanceTimersByTime(Math.max(0, AD_WAIT_MS - (closeAfterMs ?? 0)) + 300);
      recordAdOutcome();
      return JSON.parse(local.get('asrar_ad_stats'));
    };

    it('onglet fermé en moins de 2 s : pub sautée', () => {
      expect(finish(500)).toEqual({ opened: 1, quick: 1, closed: 0, open: 0 });
    });
    it('onglet fermé avant la fin de l’attente', () => {
      expect(finish(3000)).toEqual({ opened: 1, quick: 0, closed: 1, open: 0 });
    });
    it('onglet encore ouvert à la fin de l’attente', () => {
      expect(finish(null)).toEqual({ opened: 1, quick: 0, closed: 0, open: 1 });
    });
    it('envoie les compteurs au bout de 10 minutes puis repart de zéro', () => {
      const { local } = browser();
      const sent = [];
      openActionAd();
      recordAdOutcome((stats) => sent.push(stats)); // premier envoi : jamais envoyé avant
      expect(sent).toEqual([{ opened: 1, quick: 0, closed: 0, open: 1 }]);
      expect(local.get('asrar_ad_stats')).toBeUndefined();
      vi.advanceTimersByTime(AD_WAIT_MS);
      openActionAd();
      recordAdOutcome((stats) => sent.push(stats)); // moins de 10 min : on garde en local
      expect(sent).toHaveLength(1);
      expect(JSON.parse(local.get('asrar_ad_stats')).opened).toBe(1);
    });
  });
});
