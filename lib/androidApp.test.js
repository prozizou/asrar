import { describe, expect, it } from 'vitest';
import { openAppIntentUrl, PLAY_STORE_URL, shouldRedirectToApp } from './androidApp';

const ANDROID = 'Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const GOOGLEBOT = 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

describe('Redirection des visiteurs Android vers l’application', () => {
  it('redirige un téléphone Android, jamais un iPhone ni un ordinateur', () => {
    expect(shouldRedirectToApp({ ua: ANDROID })).toBe(true);
    expect(shouldRedirectToApp({ ua: IPHONE })).toBe(false);
    expect(shouldRedirectToApp({ ua: DESKTOP })).toBe(false);
  });
  it('jamais dans l’application elle-même (même site chargé par l’APK)', () => {
    expect(shouldRedirectToApp({ ua: ANDROID, native: true })).toBe(false);
  });
  it('jamais pour les robots (référencement, aperçus de liens)', () => {
    expect(shouldRedirectToApp({ ua: GOOGLEBOT })).toBe(false);
    expect(shouldRedirectToApp({ ua: ANDROID + ' WhatsApp/2.24' })).toBe(false);
  });
  it('désactivable sans code et suspendue 7 jours pour qui ne peut pas installer', () => {
    expect(shouldRedirectToApp({ ua: ANDROID, flag: '0' })).toBe(false);
    expect(shouldRedirectToApp({ ua: ANDROID, skipUntil: 2000, now: 1000 })).toBe(false);
    expect(shouldRedirectToApp({ ua: ANDROID, skipUntil: 1000, now: 2000 })).toBe(true);
  });
  it('le lien ouvre l’application, sinon Google Play', () => {
    const url = openAppIntentUrl();
    expect(url.startsWith('intent://open#Intent;scheme=asrarpro;package=com.Asrar;')).toBe(true);
    expect(url).toContain('S.browser_fallback_url=' + encodeURIComponent(PLAY_STORE_URL));
    expect(PLAY_STORE_URL).toBe('https://play.google.com/store/apps/details?id=com.Asrar');
  });
});
