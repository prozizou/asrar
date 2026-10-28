import { describe, it, expect } from 'vitest';
import { magicStar, magicStar57, magicStarText, verifyMagicStar, MAGIC_STAR_BASE, MAGIC_STAR_LINES, MAGIC_STAR_57_LINES } from './magicStar';

describe('étoile magique à 18 cases', () => {
  it('reproduit exactement le modèle de constante 38', () => {
    expect(magicStar(38).values).toEqual(MAGIC_STAR_BASE);
  });
  it.each([38, 117, 644, 39, 40, 41, Number.MAX_SAFE_INTEGER])('garantit 18 entiers positifs distincts et six sommes pour S=%s', (s) => {
    const star = magicStar(s);
    expect(star.values).toHaveLength(18);
    expect(new Set(star.values).size).toBe(18);
    expect(star.values.every((value) => Number.isSafeInteger(value) && value > 0)).toBe(true);
    for (const line of MAGIC_STAR_LINES) {
      expect(line.reduce((sum, index) => sum + star.values[index - 1], 0)).toBe(s);
    }
    expect(star.sums).toEqual(Array(6).fill(s));
  });
  it('applique le reliquat uniquement aux six cases désignées', () => {
    expect(magicStar(117).values).toEqual([25, 22, 24, 40, 23, 20, 26, 27, 28, 29, 30, 31, 38, 39, 21, 35, 36, 37]);
    expect(magicStar(644).values).toEqual([157, 154, 156, 171, 155, 152, 158, 159, 160, 161, 162, 163, 169, 170, 153, 166, 167, 168]);
  });
  it.each([37, 0, -1, 38.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('refuse une constante hors plage : %s', (s) => {
    expect(() => magicStar(s)).toThrow(RangeError);
  });
  it('exporte les indices de cases et les six calculs', () => {
    const text = magicStarText(magicStar(38));
    expect(text).toContain('Case 4 : 18');
    expect(text).toContain('5 + 7 + 8 + 18 = 38');
    expect(text).toContain('2 + 11 + 12 + 13 = 38');
  });
});

describe('configuration à sept alignements', () => {
  const expected = [6, 17, 4, 5, 18, 15, 7, 8, 9, 10, 11, 12, 2, 3, 16, 13, 1, 14];
  const lines = [
    [1, 2, 8, 10, 14, 16], [7, 8, 9, 10, 11, 12], [4, 6, 10, 12, 17, 18],
    [11, 12, 13, 14, 15, 16], [3, 5, 9, 11, 17, 18], [1, 2, 7, 9, 13, 15], [3, 4, 5, 6, 7, 8],
  ];
  it('respecte les positions, utilise exactement 1 à 18 et donne sept sommes de 57', () => {
    const star = magicStar57();
    expect(star.values).toEqual(expected);
    expect([...star.values].sort((a, b) => a - b)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(star.lines).toEqual(lines);
    for (const line of lines) expect(line.reduce((sum, index) => sum + star.values[index - 1], 0)).toBe(57);
    expect(star).toMatchObject({ valid: true, usesOneToEighteen: true, sums: Array(7).fill(57) });
  });
  it('détecte une somme incorrecte et des valeurs répétées', () => {
    const altered = [...expected]; [altered[0], altered[1]] = [altered[1], altered[0]];
    // Cette permutation reste valide : les cases 1 et 2 sont dans les mêmes lignes.
    expect(verifyMagicStar(altered, 57, lines).valid).toBe(true);
    [altered[0], altered[2]] = [altered[2], altered[0]];
    expect(verifyMagicStar(altered, 57, lines).valid).toBe(false);
    expect(verifyMagicStar(Array(18).fill(9.5), 57, lines).valid).toBe(false);
    expect(verifyMagicStar([...expected.slice(1), 17], 57, lines).valid).toBe(false);
  });
  it('rejette les indices hors schéma ou répétés', () => {
    expect(verifyMagicStar(expected, 57, [[0, 19]]).valid).toBe(false);
    expect(verifyMagicStar(expected, 57, [[1, 1]]).valid).toBe(false);
  });
  it.each([38, 58, 117, NaN, Infinity])('ne prétend pas générer une constante non prise en charge : %s', (s) => {
    expect(() => magicStar57(s)).toThrow(RangeError);
  });
  it('exporte les sept calculs de six cases du modèle sélectionné', () => {
    const text = magicStarText(magicStar57());
    expect(text).toContain('6 + 17 + 8 + 10 + 3 + 13 = 57');
    expect(text.split('\n').filter((line) => line.includes(' + ') && line.endsWith('= 57'))).toHaveLength(7);
    expect(MAGIC_STAR_57_LINES).toEqual(lines);
  });
});
