/** Cases et alignements numérotés de 1 à 18, conformément au modèle fourni. */
export const MAGIC_STAR_BASE = [6, 3, 5, 18, 4, 1, 7, 8, 9, 10, 11, 12, 16, 17, 2, 13, 14, 15] as const;
export const MAGIC_STAR_LINES = [
  [3, 7, 8, 4], [1, 7, 9, 13], [2, 8, 10, 14],
  [5, 9, 11, 17], [6, 10, 12, 18], [15, 11, 12, 16],
] as const;
const CORRECTIONS = new Set([4, 13, 14, 16, 17, 18]);

export const MAGIC_STAR_57_BASE = [6, 17, 4, 5, 18, 15, 7, 8, 9, 10, 11, 12, 2, 3, 16, 13, 1, 14] as const;
export const MAGIC_STAR_57_LINES = [
  [1, 2, 8, 10, 14, 16], [7, 8, 9, 10, 11, 12],
  [4, 6, 10, 12, 17, 18], [11, 12, 13, 14, 15, 16],
  [3, 5, 9, 11, 17, 18], [1, 2, 7, 9, 13, 15], [3, 4, 5, 6, 7, 8],
] as const;

type Alignments = readonly (readonly number[])[];

/** Contrôle partagé, indépendant de la stratégie de génération et du rendu. */
export function verifyMagicStar(values: readonly number[], constant: number, lines: Alignments) {
  const sums = lines.map((line) => line.reduce((sum, index) => sum + (values[index - 1] ?? NaN), 0));
  const distinctPositive = values.length === 18 && new Set(values).size === 18 &&
    values.every((v) => Number.isSafeInteger(v) && v > 0);
  const usesOneToEighteen = distinctPositive && values.every((v) => v <= 18);
  const valid = Number.isSafeInteger(constant) && distinctPositive && lines.length > 0 &&
    lines.every((line) => line.length > 0 && new Set(line).size === line.length &&
      line.every((i) => Number.isInteger(i) && i >= 1 && i <= 18)) &&
    sums.every((sum) => Number.isSafeInteger(sum) && sum === constant);
  return { sums, valid, usesOneToEighteen };
}

function result(values: number[], constant: number, lines: Alignments) {
  const checks = verifyMagicStar(values, constant, lines);
  if (!checks.valid) throw new Error('La configuration ne satisfait pas les alignements.');
  return { constant, values, lines, ...checks };
}

/** Configuration normale (1 à 18). Toute autre constante exige une nouvelle stratégie. */
export function magicStar57(constant = 57) {
  if (constant !== 57) throw new RangeError('Cette configuration utilise les nombres 1 à 18 et la constante 57 uniquement.');
  return result([...MAGIC_STAR_57_BASE], constant, MAGIC_STAR_57_LINES);
}

export function magicStar(constant: number) {
  if (!Number.isSafeInteger(constant) || constant < 38) {
    throw new RangeError('S doit être un entier compris entre 38 et 9007199254740991.');
  }
  const q = Math.floor((constant - 38) / 4);
  const r = (constant - 38) % 4;
  const values = MAGIC_STAR_BASE.map((base, i) => base + q + (CORRECTIONS.has(i + 1) ? r : 0));
  return result(values, constant, MAGIC_STAR_LINES);
}

export type MagicStar = ReturnType<typeof magicStar>;

export function magicStarText(star: MagicStar) {
  return [
    `Étoile magique à 18 cases — S = ${star.constant}`,
    ...star.values.map((value, i) => `Case ${i + 1} : ${value}`),
    '',
    ...star.lines.map((line, i) => `${line.map((index) => star.values[index - 1]).join(' + ')} = ${star.sums[i]}`),
  ].join('\n');
}
