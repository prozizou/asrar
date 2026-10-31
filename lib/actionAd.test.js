import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADSTERRA_SMARTLINK, openActionAd } from './actionAd';

function browser({ active = true, opened = true, native = false } = {}) {
  const store = new Map();
  const tab = { opener: 'page' };
  const open = vi.fn(() => (opened ? tab : null));
  vi.stubGlobal('window', { open, Capacitor: native ? { isNativePlatform: () => true } : undefined });
  vi.stubGlobal('navigator', { userActivation: { isActive: active } });
  vi.stubGlobal('sessionStorage', { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) });
  return { open, tab };
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
});
