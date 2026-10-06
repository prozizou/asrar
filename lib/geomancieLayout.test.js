import { describe, it, expect } from 'vitest';
import { SHIELD_LAYOUT, SHIELD_EDGES, edgePoints } from './geomancieLayout';
import { generateAllHouses, addFigures, randomMothers } from './geomancie';

// Notation « M1+M2→M9 » (numéros de maison) → [parente, fille] (index).
const spec = ['M1+M2→M9', 'M3+M4→M10', 'M5+M6→M11', 'M7+M8→M12', 'M9+M10→M13', 'M11+M12→M14', 'M13+M14→M15', 'M15+M1→M16'];
const specEdges = spec.flatMap((s) => {
  const [, a, b, c] = s.match(/M(\d+)\+M(\d+)→M(\d+)/);
  return [[+a - 1, +c - 1], [+b - 1, +c - 1]];
});

describe('disposition de l\'écu', () => {
  it('place les 16 maisons une seule fois, sans chevauchement', () => {
    expect(SHIELD_LAYOUT.map((c) => c.idx).sort((a, b) => a - b)).toEqual([...Array(16).keys()]);
    const taken = new Set();
    for (const { col, row } of SHIELD_LAYOUT) {
      for (const k of [col, col + 1]) {
        expect(k).toBeLessThanOrEqual(16);
        expect(taken.has(`${row}:${k}`)).toBe(false);
        taken.add(`${row}:${k}`);
      }
    }
  });

  it('ordre des lignes : M8→M1, M12→M9, M14/M13, M15/M16', () => {
    const rows = [1, 2, 3, 4].map((r) =>
      SHIELD_LAYOUT.filter((c) => c.row === r).sort((a, b) => a.col - b.col).map((c) => 'M' + (c.idx + 1))
    );
    expect(rows).toEqual([
      ['M8', 'M7', 'M6', 'M5', 'M4', 'M3', 'M2', 'M1'],
      ['M12', 'M11', 'M10', 'M9'],
      ['M14', 'M13'],
      ['M15', 'M16'],
    ]);
  });

  it('flèches = exactement la liste demandée', () => {
    expect(SHIELD_EDGES).toEqual(specEdges);
  });

  it('chaque flèche correspond à la dérivation réelle (fille = parente1 + parente2)', () => {
    for (let n = 0; n < 20; n++) {
      const h = generateAllHouses(randomMothers());
      for (let i = 0; i < SHIELD_EDGES.length; i += 2) {
        const [p1, child] = SHIELD_EDGES[i];
        const [p2, child2] = SHIELD_EDGES[i + 1];
        expect(child2).toBe(child);
        expect(addFigures(h[p1], h[p2])).toEqual(h[child]);
      }
    }
  });

  it('chaque maison de rang supérieur est centrée sous ses deux parentes', () => {
    const centre = (idx) => {
      const c = SHIELD_LAYOUT.find((x) => x.idx === idx);
      return c.col + 0.5; // centre en unités de colonnes (2 colonnes → +1, -0.5 offset commun)
    };
    for (let i = 0; i < SHIELD_EDGES.length - 2; i += 2) {
      const [p1, child] = SHIELD_EDGES[i];
      const [p2] = SHIELD_EDGES[i + 1];
      expect(centre(child)).toBeCloseTo((centre(p1) + centre(p2)) / 2, 5);
    }
  });
});

describe('edgePoints', () => {
  const boxes = {
    0: { l: 100, r: 120, t: 0, b: 40 },
    8: { l: 80, r: 100, t: 60, b: 100 },
    14: { l: 40, r: 60, t: 200, b: 240 },
    15: { l: 100, r: 120, t: 200, b: 240 },
  };
  it('coude vertical : du bas de la parente au haut de la fille', () => {
    expect(edgePoints(0, 8, boxes)).toEqual([[110, 40], [110, 50], [90, 50], [90, 60]]);
  });
  it('M15 → M16 horizontale', () => {
    expect(edgePoints(14, 15, boxes)).toEqual([[60, 220], [100, 220]]);
  });
  it('M1 → M16 contourne par la droite', () => {
    expect(edgePoints(0, 15, boxes, 8)).toEqual([[120, 20], [128, 20], [128, 220], [120, 220]]);
  });
  it('maison inconnue → null', () => {
    expect(edgePoints(0, 3, boxes)).toBeNull();
  });
});
