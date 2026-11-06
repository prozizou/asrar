import { describe, it, expect } from 'vitest';
import { fivePointStar15, FIVE_POINT_STAR_15_BASE, FIVE_POINT_STAR_15_LINES } from './fivePointStar15';
import { magicStarText } from './magicStar';

// Indices indépendants : suivre les cinq lignes du dessin, case ajoutée comprise.
const lines = [[1, 11, 7, 8, 3], [3, 12, 9, 10, 5], [5, 13, 6, 7, 2], [2, 14, 8, 9, 4], [4, 15, 10, 6, 1]];
function check(s) {
  const star = fivePointStar15(s);
  expect(star.values).toHaveLength(15);
  expect(new Set(star.values).size).toBe(15);
  expect(star.values.every((value) => Number.isSafeInteger(value) && value > 0)).toBe(true);
  for (const line of lines) {
    expect(line.reduce((sum, i) => sum + BigInt(star.values[i - 1]), 0n)).toBe(BigInt(s));
  }
  expect(star.sums).toEqual(Array(5).fill(s));
  return star;
}

describe('étoile cinq branches à quinze cases', () => {
  it('reproduit exactement la conception 903 approuvée', () => {
    expect(check(903).values).toEqual([174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 192, 184, 191, 188, 190]);
  });
  it.each([38, 39, 40, 41, 42, 43, 65, 902, 904, 1000])('accepte S=%s, pair ou impair', check);
  it('couvre tous les entiers de 38 à 10000, sans répétition ni fraction', () => {
    for (let s = 38; s <= 10000; s++) {
      const { values } = fivePointStar15(s);
      if (new Set(values).size !== 15 || values.some((v) => !Number.isSafeInteger(v) || v < 1) ||
          lines.some((line) => line.reduce((sum, i) => sum + values[i - 1], 0) !== s)) throw new Error('Configuration incorrecte : ' + s);
    }
  });
  it('conserve des sommes exactes dans les cinq classes proches de la limite numérique', () => {
    for (let delta = 0; delta < 10; delta++) check(Number.MAX_SAFE_INTEGER - delta);
  });
  it.each([37, 24, 0, -38, 903.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('refuse S=%s hors domaine', (s) => {
    expect(() => fivePointStar15(s)).toThrow(RangeError);
  });
  it('chaque ligne contient quatre cases partagées et sa propre case supplémentaire', () => {
    expect(FIVE_POINT_STAR_15_LINES).toEqual(lines);
    for (let i = 1; i <= 15; i++) expect(lines.filter((line) => line.includes(i))).toHaveLength(i <= 10 ? 2 : 1);
    expect(fivePointStar15(38).values).toEqual(FIVE_POINT_STAR_15_BASE);
  });
  it('inclut les quinze valeurs et cinq sommes dans la copie', () => {
    const text = magicStarText(fivePointStar15(903), 'Étoile à 5 branches (15 cases)');
    expect(text).toContain('Étoile à 5 branches (15 cases) — S = 903');
    expect(text).toContain('Case 15 : 190');
    expect(text).toContain('174 + 192 + 180 + 181 + 176 = 903');
    expect(text.split('\n').filter((line) => line.includes(' + '))).toHaveLength(5);
  });
});
