import { describe, it, expect } from 'vitest';
import { cleanStars, avgStars } from './reviews';

describe('cleanStars', () => {
  it('accepte un entier 1-5', () => {
    expect(cleanStars(1)).toBe(1);
    expect(cleanStars(5)).toBe(5);
    expect(cleanStars('4')).toBe(4);
  });

  it('arrondit une valeur décimale', () => {
    expect(cleanStars(3.6)).toBe(4);
  });

  it('rejette hors bornes, non numérique ou absent', () => {
    expect(cleanStars(0)).toBeNull();
    expect(cleanStars(6)).toBeNull();
    expect(cleanStars('abc')).toBeNull();
    expect(cleanStars(undefined)).toBeNull();
    expect(cleanStars(null)).toBeNull();
  });
});

describe('avgStars', () => {
  it('calcule la moyenne sur les commentaires portant des étoiles (tableau)', () => {
    const r = avgStars([{ stars: 5 }, { stars: 3 }, { text: 'sans étoile' }]);
    expect(r).toEqual({ avg: 4, count: 2 });
  });

  it('accepte un objet RTDB brut { id: {...} }', () => {
    const r = avgStars({ a: { stars: 4 }, b: { stars: 2 } });
    expect(r).toEqual({ avg: 3, count: 2 });
  });

  it('ignore les valeurs invalides plutôt que de les compter comme 0', () => {
    const r = avgStars([{ stars: 5 }, { stars: 0 }, { stars: 'x' }]);
    expect(r).toEqual({ avg: 5, count: 1 });
  });

  it('renvoie {avg:0, count:0} sans aucun avis', () => {
    expect(avgStars([])).toEqual({ avg: 0, count: 0 });
    expect(avgStars(null)).toEqual({ avg: 0, count: 0 });
  });
});
