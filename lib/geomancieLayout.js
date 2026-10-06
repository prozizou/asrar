// Géomancie — disposition de l'écu en organigramme et tracé des flèches.
// Partagé par l'écran (SVG mesuré dans le DOM) et l'export PDF (mm), pour que
// les deux affichent exactement la même dérivation. Index = numéro de maison - 1.

// Grille de 16 colonnes : chaque maison occupe 2 colonnes (`col` = colonne de
// départ, `row` = ligne). Chaque maison de rang supérieur est centrée sous ses
// deux parentes.
export const SHIELD_LAYOUT = [
  // Ligne 1 : M8 → M1
  ...[7, 6, 5, 4, 3, 2, 1, 0].map((idx, i) => ({ idx, col: 1 + i * 2, row: 1 })),
  // Ligne 2 : M12 → M9
  ...[11, 10, 9, 8].map((idx, i) => ({ idx, col: 2 + i * 4, row: 2 })),
  // Ligne 3 : M14 à gauche, M13 à droite
  { idx: 13, col: 4, row: 3 },
  { idx: 12, col: 12, row: 3 },
  // Ligne 4 : M15 au centre-gauche, M16 à droite
  { idx: 14, col: 8, row: 4 },
  { idx: 15, col: 15, row: 4 },
];

// Flèches [parente, fille] :
// M1+M2→M9, M3+M4→M10, M5+M6→M11, M7+M8→M12, M9+M10→M13, M11+M12→M14,
// M13+M14→M15, M15+M1→M16.
export const SHIELD_EDGES = [
  [0, 8], [1, 8],
  [2, 9], [3, 9],
  [4, 10], [5, 10],
  [6, 11], [7, 11],
  [8, 12], [9, 12],
  [10, 13], [11, 13],
  [12, 14], [13, 14],
  [14, 15], [0, 15],
];

// Étapes de dérivation (écran de saisie) : nom, maisons concernées.
export const STEPS = [
  { key: 'meres', label: 'Mères', range: 'M1–M8' },
  { key: 'nieces', label: 'Nièces', range: 'M9–M12' },
  { key: 'temoins', label: 'Témoins', range: 'M13–M14' },
  { key: 'juge', label: 'Juge', range: 'M15–M16' },
];

/**
 * Points de la flèche parente → fille (polyligne orthogonale).
 * `boxes[i]` = { l, r, t, b } de la maison i (px ou mm, même unité que `gutter`).
 *  - cas général : bas de la parente → couloir → haut de la fille (coude vertical) ;
 *  - M15 → M16 : horizontale ;
 *  - M1 → M16 : contourne l'écu par la droite (couloir de largeur `gutter`) et
 *    entre dans M16 par son bord droit.
 */
export function edgePoints(from, to, boxes, gutter = 8) {
  const p = boxes[from];
  const c = boxes[to];
  if (!p || !c) return null;
  if (from === 14 && to === 15) {
    const y = (p.t + p.b) / 2;
    return [[p.r, y], [c.l, y]];
  }
  if (from === 0 && to === 15) {
    const xo = p.r + gutter;
    const y1 = (p.t + p.b) / 2;
    const y2 = (c.t + c.b) / 2;
    return [[p.r, y1], [xo, y1], [xo, y2], [c.r, y2]];
  }
  const x1 = (p.l + p.r) / 2;
  const x2 = (c.l + c.r) / 2;
  const ym = (p.b + c.t) / 2;
  return [[x1, p.b], [x1, ym], [x2, ym], [x2, c.t]];
}
