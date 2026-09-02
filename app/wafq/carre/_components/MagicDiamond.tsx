'use client';
// Porté depuis prozizou/Kanzou components/MagicDiamond.tsx (voir
// lib/kanzouWafq.ts pour la géométrie/les commentaires détaillés du calcul,
// inchangés) — classes Tailwind de couleur remplacées par .kz-diamond-*
// (carre.css), reste du rendu SVG identique.
import type { DiamondCell } from '@/lib/kanzouWafq';
import { formatNumeral, type NumeralSystem } from '@/lib/kanzouNumerals';

const UNIT_X = 56;
const UNIT_Y = 40;
const PAD_X = 24;
const PAD_TOP = 32;
const PAD_BOTTOM = 24;
const BASE_FONT_SIZE = 13;

type Point = { sx: number; sy: number };

export default function MagicDiamond({
  cells,
  numerals,
  scale = 1,
}: {
  cells: DiamondCell[];
  numerals: NumeralSystem;
  scale?: number;
}) {
  const toScreen = (x: number, y: number): Point => ({
    sx: (x + 4) * UNIT_X + PAD_X,
    sy: (y + 1) * UNIT_Y + PAD_TOP,
  });

  const centroid = (pts: Point[]): Point => ({
    sx: pts.reduce((s, p) => s + p.sx, 0) / pts.length,
    sy: pts.reduce((s, p) => s + p.sy, 0) / pts.length,
  });

  const towards = (from: Point, to: Point, t: number): Point => ({
    sx: from.sx + (to.sx - from.sx) * t,
    sy: from.sy + (to.sy - from.sy) * t,
  });

  const width = 8 * UNIT_X + PAD_X * 2;
  const height = 8 * UNIT_Y + PAD_TOP + PAD_BOTTOM;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="kz-diamond" role="img" aria-label="Losange magique">
      {cells.map((cell) => {
        const x = cell.p - cell.q;
        const y = cell.p + cell.q;
        const dx = x;
        const dy = y - 3;

        const N = toScreen(x, y - 1);
        const E = toScreen(x + 1, y);
        const S = toScreen(x, y + 1);
        const W = toScreen(x - 1, y);

        const splitEW = Math.abs(dy) >= Math.abs(dx);

        const triA = splitEW ? [N, E, W] : [E, N, S];
        const triB = splitEW ? [S, E, W] : [W, N, S];
        const apexA = splitEW ? N : E;
        const apexB = splitEW ? S : W;

        const labelA = towards(centroid(triA), apexA, 0.15);
        const labelB = towards(centroid(triB), apexB, 0.15);

        const rhombusPoints = `${N.sx},${N.sy} ${E.sx},${E.sy} ${S.sx},${S.sy} ${W.sx},${W.sy}`;
        const divider = splitEW ? { a: E, b: W } : { a: N, b: S };

        return (
          <g key={`${cell.p}-${cell.q}`}>
            <polygon points={rhombusPoints} className="kz-diamond-rhombus" strokeWidth={1.5} />
            <line x1={divider.a.sx} y1={divider.a.sy} x2={divider.b.sx} y2={divider.b.sy} className="kz-diamond-divider" strokeWidth={1} />
            <text x={labelA.sx} y={labelA.sy} textAnchor="middle" dominantBaseline="middle" className="kz-svg-text" fontSize={BASE_FONT_SIZE * scale}>
              {formatNumeral(cell.outer, numerals)}
            </text>
            <text x={labelB.sx} y={labelB.sy} textAnchor="middle" dominantBaseline="middle" className="kz-svg-text" fontSize={BASE_FONT_SIZE * scale}>
              {formatNumeral(cell.inner, numerals)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
