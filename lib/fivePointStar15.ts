/**
 * Même pentagramme : cases 1–10 aux sommets/intersections et une case
 * supplémentaire (11–15) sur chacune des cinq lignes, dans cet ordre.
 */
export const FIVE_POINT_STAR_15_ANCHORS = [
  [1, 2, 3, 4, 7, 5, 8, 9, 10, 6, 17, 12, 16, 13, 22],
  [1, 2, 3, 4, 6, 5, 7, 10, 8, 9, 18, 13, 19, 15, 20],
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 21, 13, 20, 17, 19],
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 13, 21, 18, 19],
  [1, 2, 3, 4, 5, 6, 7, 12, 9, 8, 19, 17, 22, 15, 23],
] as const;
export const FIVE_POINT_STAR_15_BASE = FIVE_POINT_STAR_15_ANCHORS[0];
export const FIVE_POINT_STAR_15_LINES = [
  [1, 11, 7, 8, 3], [3, 12, 9, 10, 5], [5, 13, 6, 7, 2],
  [2, 14, 8, 9, 4], [4, 15, 10, 6, 1],
] as const;
export const FIVE_POINT_STAR_15_CENTER = [6, 7, 8, 9, 10] as const;
const CHECKS = [...FIVE_POINT_STAR_15_LINES, FIVE_POINT_STAR_15_CENTER] as const;

/**
 * Cinq bases vérifiées pour S = 38, …, 42 : les cinq lignes ET le tour
 * du milieu (cases 6–10) ont la même somme. Écrire S − 38 = 5q + r,
 * choisir la base 38 + r puis ajouter q aux quinze cases apporte 5q
 * à chacune des six sommes. La translation conserve les entiers positifs
 * distincts ; toutes les constantes entières S ≥ 38 sont couvertes.
 */
export function fivePointStar15(constant: number) {
  if (!Number.isSafeInteger(constant) || constant < 38) {
    throw new RangeError('Saisissez un entier entre 38 et 9007199254740991.');
  }
  const delta = constant - 38;
  const remainder = delta % 5;
  const offset = (delta - remainder) / 5;
  const values = FIVE_POINT_STAR_15_ANCHORS[remainder].map((value) => value + offset);
  const sums = CHECKS.map((line) => line.reduce((sum, index) => sum + values[index - 1], 0));
  if (new Set(values).size !== 15 || !values.every((value) => Number.isSafeInteger(value) && value > 0) ||
      !sums.every((sum) => sum === constant)) throw new Error('Les lignes et le tour du milieu doivent avoir la même somme.');
  return { constant, values, lines: CHECKS, sums };
}

export type FivePointStar15 = ReturnType<typeof fivePointStar15>;
