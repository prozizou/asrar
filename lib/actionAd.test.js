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

describe('Pub au clic sur les boutons d’action', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('ouvre le Smartlink une fois par minute au plus, sans lien vers la page', () => {
    const { open, tab } = browser();
    openActionAd();
    expect(open).toHaveBeenCalledWith(ADSTERRA_SMARTLINK, '_blank');
    expect(tab.opener).toBeNull();
    openActionAd();
    expect(open).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    openActionAd();
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('ne s’ouvre ni hors d’un clic ni dans l’APK', () => {
    expect(browser({ active: false }).open.mock.calls).toHaveLength(0);
    openActionAd();
    expect(window.open).not.toHaveBeenCalled();
    browser({ native: true });
    openActionAd();
    expect(window.open).not.toHaveBeenCalled();
  });

  it('un onglet bloqué ne consomme pas l’intervalle', () => {
    const { open } = browser({ opened: false });
    openActionAd();
    window.open = vi.fn(() => ({}));
    openActionAd();
    expect(open).toHaveBeenCalledTimes(1);
    expect(window.open).toHaveBeenCalledTimes(1);
  });
});
