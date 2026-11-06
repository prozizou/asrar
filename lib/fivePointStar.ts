// Indices : sommets (haut, droite, bas droite, bas gauche, gauche), puis
// intersections (haut gauche, haut droite, bas droite, bas centre, bas gauche).
export const FIVE_POINT_STAR_BASE = [1, 2, 3, 4, 5, 9, 8, 12, 6, 10] as const;
export const FIVE_POINT_STAR_LINES = [
  [1, 7, 8, 3], [3, 9, 10, 5], [5, 6, 7, 2],
  [2, 8, 9, 4], [4, 10, 6, 1],
] as const;

/**
 * Chaque nombre appartient à deux lignes : 5S = 2 × somme des dix nombres,
 * donc une constante entière est nécessairement paire. Les bases 24 et 26
 * couvrent les deux classes modulo 4 ; translater les dix valeurs de q
 * ajoute 4q à chaque ligne et conserve des entiers positifs distincts.
 */
export function fivePointStar(constant: number) {
  if (!Number.isSafeInteger(constant) || constant < 24 || constant % 2 !== 0) {
    throw new RangeError('Saisissez un entier pair entre 24 et 9007199254740990.');
  }
  const remainder = (constant - 24) % 4;
  const offset = (constant - 24 - remainder) / 4;
  const values = FIVE_POINT_STAR_BASE.map((value, index) => value + offset + (index >= 5 ? remainder / 2 : 0));
  const sums = FIVE_POINT_STAR_LINES.map((line) => line.reduce((sum, index) => sum + values[index - 1], 0));
  if (new Set(values).size !== 10 || !values.every((v) => Number.isSafeInteger(v) && v > 0) ||
      !sums.every((sum) => sum === constant)) throw new Error('Les cinq alignements sont invalides.');
  return { constant, values, lines: FIVE_POINT_STAR_LINES, sums };
}

export type FivePointStar = ReturnType<typeof fivePointStar>;

