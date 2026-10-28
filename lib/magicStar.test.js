import { describe, it, expect } from 'vitest';
import { magicStar, magicStarText, verifyMagicStar, MAGIC_STAR_ANCHORS, MAGIC_STAR_LINES } from './magicStar';

const original = [6, 17, 4, 5, 18, 15, 7, 8, 9, 10, 11, 12, 2, 3, 16, 13, 1, 14];
const lines = [
  [1, 2, 8, 10, 14, 16], [7, 8, 9, 10, 11, 12], [4, 6, 10, 12, 17, 18],
  [11, 12, 13, 14, 15, 16], [3, 5, 9, 11, 17, 18], [1, 2, 7, 9, 13, 15], [3, 4, 5, 6, 7, 8],
];
function check(s) {
  const star = magicStar(s);
  expect(star.values).toHaveLength(18);
  expect(new Set(star.values).size).toBe(18);
  expect(star.values.every((value) => Number.isSafeInteger(value) && value > 0)).toBe(true);
  expect(star.lines).toEqual(lines);
  for (const line of lines) expect(line.reduce((sum, index) => sum + star.values[index - 1], 0)).toBe(s);
  expect(star.sums).toEqual(Array(7).fill(s));
  expect(star.valid).toBe(true);
  return star;
}

describe('étoile à sept alignements et constante libre', () => {
  it('préserve exactement les positions du modèle 57', () => {
    const star = check(57);
    expect(star.values).toEqual(original);
    expect([...star.values].sort((a, b) => a - b)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(star.usesOneToEighteen).toBe(true);
  });
  it.each([57, 58, 59, 60, 61, 62])('valide la base S=%s indépendamment du générateur', (s) => {
    const values = MAGIC_STAR_ANCHORS[s - 57];
    expect(new Set(values).size).toBe(18);
    expect(values.every((v) => Number.isSafeInteger(v) && v > 0)).toBe(true);
    for (const line of lines) expect(line.reduce((sum, i) => sum + values[i - 1], 0)).toBe(s);
  });
  it.each([63, 64, 65, 66, 67, 68, 117, 644])('génère sept sommes exactes pour S=%s', check);
  it('couvre toutes les constantes de 57 à 10000', () => {
    for (let s = 57; s <= 10000; s++) {
      const star = magicStar(s);
      if (star.values.length !== 18 || new Set(star.values).size !== 18 ||
        !star.values.every((v) => Number.isSafeInteger(v) && v > 0) ||
        lines.some((line) => line.reduce((sum, i) => sum + star.values[i - 1], 0) !== s)) {
        throw new Error('Configuration incorrecte pour S=' + s);
      }
    }
  });
  it('préserve les calculs exacts dans les six classes proches de la limite numérique', () => {
    for (let d = 0; d < 6; d++) check(Number.MAX_SAFE_INTEGER - d);
  });
  it.each([56, 38, 0, -1, 57.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('refuse une constante hors plage : %s', (s) => {
    expect(() => magicStar(s)).toThrow(RangeError);
  });
  it('détecte une permutation incorrecte, les répétitions et les indices hors schéma', () => {
    const altered = [...original]; [altered[0], altered[2]] = [altered[2], altered[0]];
    expect(verifyMagicStar(altered, 57, lines).valid).toBe(false);
    expect(verifyMagicStar(Array(18).fill(9.5), 57, lines).valid).toBe(false);
    expect(verifyMagicStar([...original.slice(1), 17], 57, lines).valid).toBe(false);
    expect(verifyMagicStar(original, 57, [[0, 19]]).valid).toBe(false);
    expect(verifyMagicStar(original, 57, [[1, 1]]).valid).toBe(false);
  });
  it('exporte les sept calculs de six cases pour la constante choisie', () => {
    const text = magicStarText(magicStar(644));
    expect(text).toContain('S = 644');
    expect(text.split('\n').filter((line) => line.includes(' + ') && line.endsWith('= 644'))).toHaveLength(7);
    expect(MAGIC_STAR_LINES).toEqual(lines);
  });
});
