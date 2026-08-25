import { describe, it, expect } from 'vitest';
import { nextCount, DEFAULT_BATCH } from './progressive';

describe('nextCount', () => {
  it('avance d’un lot', () => {
    expect(nextCount(12, 12, 100)).toBe(24);
  });

  it('ne dépasse jamais le total', () => {
    expect(nextCount(95, 12, 100)).toBe(100);
    expect(nextCount(100, 12, 100)).toBe(100);
  });

  it('gère une liste vide', () => {
    expect(nextCount(0, 12, 0)).toBe(0);
  });

  it('affiche tout si le lot est nul ou négatif (jamais d’éléments piégés)', () => {
    expect(nextCount(0, 0, 50)).toBe(50);
    expect(nextCount(0, -5, 50)).toBe(50);
  });

  it('ne recule pas et ne renvoie pas de négatif sur entrées aberrantes', () => {
    expect(nextCount(-10, 12, 100)).toBe(12);
    expect(nextCount(NaN, 12, 100)).toBe(12);
    expect(nextCount(10, 12, NaN)).toBe(0);
  });

  it('tronque les décimaux', () => {
    expect(nextCount(10.9, 12.7, 100)).toBe(22);
  });

  it('expose un lot par défaut raisonnable', () => {
    expect(DEFAULT_BATCH).toBeGreaterThan(0);
  });
});
