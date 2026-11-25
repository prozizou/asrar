import { describe, it, expect } from 'vitest';
import { storeGate, webGateEnabled, openAppIntent, PLAY_STORE_URL } from './storeRedirect';

const ANDROID = 'Mozilla/5.0 (Linux; Android 13; SM-A145F) Chrome/129.0 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0 Safari/537.36';

describe('storeGate', () => {
  it('laisse passer iOS et l’application Android', () => {
    expect(storeGate({ ios: true, ua: 'iPhone' })).toBe('allow');
    expect(storeGate({ native: true, ua: ANDROID })).toBe('allow');
  });
  it('déroute le navigateur et la PWA Android', () => {
    expect(storeGate({ ua: ANDROID })).toBe('android');
  });
  it('affiche l’écran d’installation sur ordinateur', () => {
    expect(storeGate({ ua: DESKTOP })).toBe('other');
  });
  it('est inactif quand le drapeau est à 0', () => {
    expect(storeGate({ ua: ANDROID, enabled: webGateEnabled('0') })).toBe('allow');
  });
});

describe('webGateEnabled', () => {
  it('est actif par défaut, coupé seulement par « 0 »', () => {
    expect(webGateEnabled(undefined)).toBe(true);
    expect(webGateEnabled('')).toBe(true);
    expect(webGateEnabled('1')).toBe(true);
    expect(webGateEnabled('0')).toBe(false);
  });
});

describe('openAppIntent', () => {
  it('retombe sur Google Play', () => {
    expect(openAppIntent()).toContain(encodeURIComponent(PLAY_STORE_URL));
    expect(openAppIntent()).toContain('package=com.Asrar');
  });
});
