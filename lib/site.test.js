import { describe, it, expect } from 'vitest';
import { normalizeSiteUrl } from './site';

describe('normalizeSiteUrl', () => {
  it('laisse une URL déjà valide (avec schéma) inchangée', () => {
    expect(normalizeSiteUrl('https://www.asrarpro.com')).toBe('https://www.asrarpro.com');
  });

  it('ajoute https:// quand le schéma est absent (la faute réellement commise en prod)', () => {
    expect(normalizeSiteUrl('www.asrarpro.com')).toBe('https://www.asrarpro.com');
  });

  it('retire un slash final', () => {
    expect(normalizeSiteUrl('https://www.asrarpro.com/')).toBe('https://www.asrarpro.com');
    expect(normalizeSiteUrl('www.asrarpro.com/')).toBe('https://www.asrarpro.com');
  });

  it('préserve http:// explicite (ne force pas https)', () => {
    expect(normalizeSiteUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('retombe sur le repli si vide/absent', () => {
    expect(normalizeSiteUrl('', 'https://www.asrarpro.com')).toBe('https://www.asrarpro.com');
    expect(normalizeSiteUrl(undefined, 'https://www.asrarpro.com')).toBe('https://www.asrarpro.com');
  });

  it('renvoie une chaîne vide sans valeur ni repli', () => {
    expect(normalizeSiteUrl('')).toBe('');
    expect(normalizeSiteUrl(undefined)).toBe('');
  });

  it('ignore les espaces superflus', () => {
    expect(normalizeSiteUrl('  www.asrarpro.com  ')).toBe('https://www.asrarpro.com');
  });
});
