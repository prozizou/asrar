/** Cases et alignements numérotés de 1 à 18, conformément au modèle fourni. */
export const MAGIC_STAR_BASE = [6, 3, 5, 18, 4, 1, 7, 8, 9, 10, 11, 12, 16, 17, 2, 13, 14, 15] as const;
export const MAGIC_STAR_LINES = [
  [3, 7, 8, 4], [1, 7, 9, 13], [2, 8, 10, 14],
  [5, 9, 11, 17], [6, 10, 12, 18], [15, 11, 12, 16],
] as const;
const CORRECTIONS = new Set([4, 13, 14, 16, 17, 18]);

export function magicStar(constant: number) {
  if (!Number.isSafeInteger(constant) || constant < 38) {
    throw new RangeError('S doit être un entier compris entre 38 et 9007199254740991.');
  }
  const q = Math.floor((constant - 38) / 4);
  const r = (constant - 38) % 4;
  const values = MAGIC_STAR_BASE.map((base, i) => base + q + (CORRECTIONS.has(i + 1) ? r : 0));
  const sums = MAGIC_STAR_LINES.map((line) => line.reduce((sum, index) => sum + values[index - 1], 0));
  return { constant, values, sums };
}

export type MagicStar = ReturnType<typeof magicStar>;

export function magicStarText(star: MagicStar) {
  return [
    `Étoile magique à 18 cases — S = ${star.constant}`,
    ...star.values.map((value, i) => `Case ${i + 1} : ${value}`),
    '',
    ...MAGIC_STAR_LINES.map((line, i) => `${line.map((index) => star.values[index - 1]).join(' + ')} = ${star.sums[i]}`),
  ].join('\n');
}
