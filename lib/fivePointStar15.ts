/**
 * Même pentagramme : cases 1–10 aux sommets/intersections et une case
 * supplémentaire (11–15) sur chacune des cinq lignes, dans cet ordre.
 */
export const FIVE_POINT_STAR_15_BASE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 19, 11, 18, 15, 17] as const;
export const FIVE_POINT_STAR_15_LINES = [
  [1, 11, 7, 8, 3], [3, 12, 9, 10, 5], [5, 13, 6, 7, 2],
  [2, 14, 8, 9, 4], [4, 15, 10, 6, 1],
] as const;

/**
 * Base vérifiée S = 38. Écrire S − 38 = 5q + r (0 ≤ r < 5).
 * Ajouter q partout apporte 5q par ligne. Ajouter r aux seules cases
 * 11–15 apporte exactement r par ligne. Ces cinq cases restent au-dessus
 * des dix autres et conservent leurs écarts : tous les nombres restent
 * entiers, positifs et distincts, pour toute constante entière S ≥ 38.
 */
export function fivePointStar15(constant: number) {
  if (!Number.isSafeInteger(constant) || constant < 38) {
    throw new RangeError('Saisissez un entier entre 38 et 9007199254740991.');
  }
  const delta = constant - 38;
  const remainder = delta % 5;
  const offset = (delta - remainder) / 5;
  const values = FIVE_POINT_STAR_15_BASE.map((value, index) => value + offset + (index >= 10 ? remainder : 0));
  const sums = FIVE_POINT_STAR_15_LINES.map((line) => line.reduce((sum, index) => sum + values[index - 1], 0));
  if (new Set(values).size !== 15 || !values.every((value) => Number.isSafeInteger(value) && value > 0) ||
      !sums.every((sum) => sum === constant)) throw new Error('Les cinq alignements sont invalides.');
  return { constant, values, lines: FIVE_POINT_STAR_15_LINES, sums };
}

export type FivePointStar15 = ReturnType<typeof fivePointStar15>;
