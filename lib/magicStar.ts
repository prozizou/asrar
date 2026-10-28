/** Étoile à 18 cases : indices du schéma numérotés de 1 à 18. */
export const MAGIC_STAR_BASE = [6, 17, 4, 5, 18, 15, 7, 8, 9, 10, 11, 12, 2, 3, 16, 13, 1, 14] as const;
export const MAGIC_STAR_LINES = [
  [1, 2, 8, 10, 14, 16], [7, 8, 9, 10, 11, 12],
  [4, 6, 10, 12, 17, 18], [11, 12, 13, 14, 15, 16],
  [3, 5, 9, 11, 17, 18], [1, 2, 7, 9, 13, 15], [3, 4, 5, 6, 7, 8],
] as const;


/**
 * Bases vérifiées pour S = 57, 58, …, 62. Chaque base contient 18 entiers
 * positifs distincts et respecte les mêmes sept alignements de six cases.
 * Ajouter q à chaque case ajoute exactement 6q à chaque somme, sans changer
 * les différences entre les valeurs : toute constante entière S >= 57 est
 * couverte en choisissant sa base modulo 6. Aucun solveur n'est exécuté.
 */
export const MAGIC_STAR_ANCHORS = [
  MAGIC_STAR_BASE,
  [6, 18, 3, 5, 20, 15, 7, 8, 9, 10, 11, 13, 2, 4, 16, 12, 1, 14],
  [6, 19, 3, 5, 21, 15, 7, 8, 9, 10, 11, 14, 1, 4, 17, 12, 2, 13],
  [6, 20, 4, 5, 18, 17, 7, 9, 8, 10, 14, 12, 3, 2, 16, 13, 1, 15],
  [6, 21, 4, 5, 18, 19, 7, 8, 9, 10, 15, 12, 2, 3, 16, 13, 1, 14],
  [6, 21, 4, 5, 22, 16, 7, 8, 9, 11, 12, 15, 2, 3, 17, 13, 1, 14],
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

/** Génération exacte pour tous les entiers représentables de S >= 57. */
export function magicStar(constant: number) {
  if (!Number.isSafeInteger(constant) || constant < 57) {
    throw new RangeError('S doit être un entier compris entre 57 et 9007199254740991.');
  }
  const delta = constant - 57;
  const remainder = delta % 6;
  const offset = (delta - remainder) / 6;
  const values = MAGIC_STAR_ANCHORS[remainder].map((base) => base + offset);
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
