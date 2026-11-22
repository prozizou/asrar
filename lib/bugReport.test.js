import { describe, expect, it } from 'vitest';
import { sanitizeReport, fingerprintOf, normalizeMessage, topFrame, isNoise, pageOf, versionKey } from './bugReport';

describe('Rapports de bugs : validation', () => {
  it('normalise un rapport d’erreur et retire la requête de la page', () => {
    const r = sanitizeReport({ kind: 'error', message: '  x is undefined ', stack: 'TypeError\n at f', page: 'https://www.asrarpro.com/zikr/abc?token=secret#top', version: 'v46.93' });
    expect(r).toMatchObject({ kind: 'error', message: 'x is undefined', page: '/zikr/abc', version: 'v46.93', durationMs: 0 });
  });

  it('rejette les rapports vides, le bruit connu et borne les champs', () => {
    expect(sanitizeReport(null)).toBeNull();
    expect(sanitizeReport({ kind: 'error', message: '' })).toBeNull();
    expect(sanitizeReport({ kind: 'error', message: 'Script error.' })).toBeNull();
    expect(sanitizeReport({ kind: 'error', message: 'ResizeObserver loop limit exceeded' })).toBeNull();
    expect(sanitizeReport({ kind: 'user', message: 'Signalement', detail: '' })).toBeNull();
    const long = sanitizeReport({ kind: 'lag', message: 'x'.repeat(999), durationMs: 9e9, version: '<script>' });
    expect(long.message).toHaveLength(300);
    expect(long.durationMs).toBe(600000);
    expect(long.version).toBe('');
    expect(sanitizeReport({ kind: 'inconnu', message: 'boom' }).kind).toBe('error');
  });

  it('accepte un signalement utilisateur sans message', () => {
    expect(sanitizeReport({ kind: 'user', detail: 'Le compteur se bloque' })).toMatchObject({ kind: 'user', message: 'Signalement', detail: 'Le compteur se bloque', page: '/' });
  });

  it('isNoise, pageOf et versionKey', () => {
    expect(isNoise('boom', 'at chrome-extension://abc/x.js')).toBe(true);
    expect(isNoise('Cannot read properties of null')).toBe(false);
    expect(pageOf('')).toBe('/');
    expect(pageOf('compte')).toBe('/compte');
    expect(versionKey('v46.93')).toBe('v46,93');
    expect(versionKey('')).toBe('inconnue');
  });
});

describe('Rapports de bugs : regroupement', () => {
  const base = { kind: 'error', page: '/zikr', label: '', detail: '' };

  it('même bug malgré des nombres, identifiants et numéros de ligne différents', () => {
    const a = { ...base, message: 'Groupe 123 introuvable', stack: 'Error\n    at load (https://www.asrarpro.com/_next/static/chunks/page-3f2a1b9c.js:10:200)' };
    const b = { ...base, message: 'Groupe 98 introuvable', stack: 'Error\n    at load (https://www.asrarpro.com/_next/static/chunks/page-77aa00ff.js:12:5)' };
    expect(fingerprintOf(a)).toBe(fingerprintOf(b));
    expect(fingerprintOf(a)).toMatch(/^e_/);
    expect(fingerprintOf({ ...a, message: 'Autre erreur' })).not.toBe(fingerprintOf(a));
  });

  it('lenteurs groupées par nature et par page ; signalements toujours séparés', () => {
    const lag = { kind: 'lag', label: 'Interface figée', message: 'Interface figée 2.1 s', page: '/zikr', stack: '' };
    expect(fingerprintOf(lag)).toBe(fingerprintOf({ ...lag, message: 'Interface figée 4.0 s' }));
    expect(fingerprintOf(lag)).not.toBe(fingerprintOf({ ...lag, page: '/planete' }));
    expect(fingerprintOf({ kind: 'user', detail: 'x' }, 'k1')).toBe('u_k1');
    expect(fingerprintOf({ kind: 'user', detail: 'x' }, 'k2')).not.toBe('u_k1');
  });

  it('normalizeMessage et topFrame', () => {
    expect(normalizeMessage('Échec https://x.y/a?b=1 code 404 id deadbeef12')).toBe('échec <url> code N id <id>');
    expect(topFrame('TypeError: x\n    at f (https://a.b/c/page-abcdef12.js?v=3:1:2)')).toBe('at f (/c/page.js)');
    expect(topFrame('')).toBe('');
  });
});
