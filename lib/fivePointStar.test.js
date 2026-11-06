import { describe, it, expect } from 'vitest';
import { fivePointStar } from './fivePointStar';
import { magicStarText } from './magicStar';

// Alignements géométriques du modèle, indépendants de ceux du générateur.
const lines = [[1, 7, 8, 3], [3, 9, 10, 5], [5, 6, 7, 2], [2, 8, 9, 4], [4, 10, 6, 1]];
function check(constant) {
  const star = fivePointStar(constant);
  expect(star.values).toHaveLength(10);
  expect(new Set(star.values).size).toBe(10);
  expect(star.values.every((v) => Number.isSafeInteger(v) && v > 0)).toBe(true);
  for (const line of lines) expect(line.reduce((sum, i) => sum + star.values[i - 1], 0)).toBe(constant);
  return star;
}

describe('hatim étoile à cinq branches', () => {
  it('reproduit les dix positions et les cinq sommes de la référence 24', () => {
    expect(check(24).values).toEqual([1, 2, 3, 4, 5, 9, 8, 12, 6, 10]);
  });
  it('couvre chaque constante paire de 24 à 10000 sans répétition', () => {
    for (let s = 24; s <= 10000; s += 2) {
      const { values } = fivePointStar(s);
      if (new Set(values).size !== 10 || lines.some((line) => line.reduce((sum, i) => sum + values[i - 1], 0) !== s)) {
        throw new Error(`Configuration incorrecte pour ${s}`);
      }
    }
  });
  it.each([26, 28, 30, 100, 644, Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER - 3])('calcule exactement S=%s', check);
  it.each([0, -24, 22, 25, 57, 24.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1])('refuse une constante invalide %s', (s) => {
    expect(() => fivePointStar(s)).toThrow(RangeError);
  });
  it('copie les dix cases et cinq sommes sans confondre le numéro de case et sa valeur', () => {
    const text = magicStarText(fivePointStar(24), 'Étoile à 5 branches');
    expect(text).toContain('Étoile à 5 branches — S = 24');
    expect(text).toContain('Case 6 : 9');
    expect(text).toContain('5 + 9 + 8 + 2 = 24');
    expect(text.split('\n').filter((line) => line.includes(' + '))).toHaveLength(5);
  });
});
