'use client';
// Porté depuis prozizou/Kanzou components/HatimTriangleGrid.tsx (voir
// lib/kanzouWafq.ts hatimTriangulaire() pour la doc complète) — classes
// Tailwind de couleur remplacées par .kz-triangle-* (carre.css).
import type { HatimTriangle } from '@/lib/kanzouWafq';
import { formatNumeral, type NumeralSystem } from '@/lib/kanzouNumerals';

type Point = { x: number; y: number };

const A: Point = { x: 200, y: 34 };
const BL: Point = { x: 46, y: 330 };
const BR: Point = { x: 354, y: 330 };

const mid = (p: Point, q: Point): Point => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

const L = mid(A, BL);
const R = mid(A, BR);
const M = mid(BL, BR);
const CT = mid(L, R);
const CL = mid(L, M);
const CR = mid(R, M);

const EDGES: [Point, Point][] = [
  [A, L], [L, BL], [A, R], [R, BR], [BL, M], [M, BR],
  [L, CT], [CT, R], [L, CL], [CL, M], [R, CR], [CR, M],
];

const RADIUS = 27;
const NODE_STROKE = 1.5;

// Un trait relie deux cercles de BORD à bord, jamais de centre à centre :
// sinon il traverse les cases et passe sous les nombres. On le raccourcit
// donc d'un rayon (plus la demi-épaisseur du contour) à chaque extrémité.
function trimmed(p: Point, q: Point): [Point, Point] {
  const dx = q.x - p.x, dy = q.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  const k = (RADIUS + NODE_STROKE / 2) / len;
  return [{ x: p.x + dx * k, y: p.y + dy * k }, { x: q.x - dx * k, y: q.y - dy * k }];
}
const BASE_FONT_SIZE = 14;
const VIEW_W = 400;
const VIEW_H = 400;

export default function HatimTriangleGrid({
  triangle,
  numerals,
  scale = 1,
}: {
  triangle: HatimTriangle;
  numerals: NumeralSystem;
  scale?: number;
}) {
  const nodes: { point: Point; value: number }[] = [
    { point: A, value: triangle.sommet },
    { point: L, value: triangle.gauche },
    { point: R, value: triangle.droite },
    { point: BL, value: triangle.baseGauche },
    { point: BR, value: triangle.baseDroite },
    { point: M, value: triangle.bas },
    { point: CT, value: triangle.centreHaut },
    { point: CL, value: triangle.centreGauche },
    { point: CR, value: triangle.centreDroite },
  ];

  return (
    <div className="kz-triangle">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={`Hatim triangulaire, D = ${triangle.d}`}>
        {EDGES.map(([from, to], i) => {
          const [p, q] = trimmed(from, to);
          return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className="kz-triangle-edge" strokeWidth={2} />;
        })}
        {nodes.map(({ point, value }, i) => (
          <g key={i}>
            <circle cx={point.x} cy={point.y} r={RADIUS} className="kz-triangle-node" strokeWidth={NODE_STROKE} />
            <text x={point.x} y={point.y} textAnchor="middle" dominantBaseline="middle" className="kz-svg-text" fontSize={BASE_FONT_SIZE * scale}>
              {formatNumeral(value, numerals)}
            </text>
          </g>
        ))}
      </svg>
      <p className="kz-triangle-d">D : {formatNumeral(triangle.d, numerals)}</p>
    </div>
  );
}
