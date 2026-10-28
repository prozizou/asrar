import { describe, it, expect } from 'vitest';
import { magicStar, magicStarText, MAGIC_STAR_BASE, MAGIC_STAR_LINES } from './magicStar';

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
