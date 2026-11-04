import { describe, expect, it } from 'vitest';
import { platformOf, PLATFORMS } from './platform';

describe('Type d’appareil (lib/platform.js)', () => {
  it('distingue l’application Android (WebView), Chrome Android, iPhone et ordinateur', () => {
    expect(platformOf('Mozilla/5.0 (Linux; Android 13; SM-A145F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36')).toBe('android_app');
    expect(platformOf('Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36')).toBe('android_web');
    expect(platformOf('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')).toBe('ios');
    expect(platformOf('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15')).toBe('ios');
    expect(platformOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36')).toBe('desktop');
  });
  it('valeurs absentes ou étranges : ordinateur, toujours une catégorie connue', () => {
    for (const ua of [undefined, null, '', 'curl/8.0', 42]) expect(PLATFORMS).toContain(platformOf(ua));
  });
});
