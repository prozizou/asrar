'use client';

import { forwardRef, useId, useLayoutEffect, useRef, useImperativeHandle } from 'react';
import type { FivePointStar } from '@/lib/fivePointStar';
import { formatNumeral, type NumeralSystem } from '@/lib/kanzouNumerals';

type Point = readonly [number, number];
const OUTER: Point[] = [[320, 45], [590, 245], [490, 570], [150, 570], [50, 245]];
function intersection(a: Point, b: Point, c: Point, d: Point): Point {
  const cross = (p: Point, q: Point) => p[0] * q[1] - p[1] * q[0];
  const ab: Point = [b[0] - a[0], b[1] - a[1]];
  const cd: Point = [d[0] - c[0], d[1] - c[1]];
  const t = cross([c[0] - a[0], c[1] - a[1]], cd) / cross(ab, cd);
  return [a[0] + t * ab[0], a[1] + t * ab[1]];
}
const POINTS = [...OUTER, ...[[0, 3, 4, 1], [0, 2, 4, 1], [0, 2, 1, 3], [2, 4, 1, 3], [0, 3, 2, 4]]
  .map(([a, b, c, d]) => intersection(OUTER[a], OUTER[b], OUTER[c], OUTER[d]))];

const FivePointStarDiagram = forwardRef<SVGSVGElement, { star: FivePointStar | null; numerals: NumeralSystem }>(function FivePointStarDiagram({ star, numerals }, ref) {
  const id = useId();
  const svg = useRef<SVGSVGElement>(null);
  useImperativeHandle(ref, () => svg.current!);
  useLayoutEffect(() => {
    svg.current?.querySelectorAll<SVGTextElement>('[data-case], [data-constant]').forEach((text) => {
      text.setAttribute('font-size', text.dataset.fontSize!);
      text.setAttribute('y', text.dataset.center!);
      const box = text.getBBox();
      const ratio = Math.min(1, Number(text.dataset.width) / box.width, Number(text.dataset.height) / box.height);
      text.setAttribute('font-size', String(Number(text.dataset.fontSize) * ratio));
      const fitted = text.getBBox();
      text.setAttribute('y', String(Number(text.dataset.center) - (fitted.y + fitted.height / 2 - Number(text.dataset.center))));
    });
  }, [star, numerals]);
  return <svg ref={svg} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 670" className="kz-star-svg"
    role="img" aria-labelledby={`${id}-title ${id}-desc`}>
    <title id={`${id}-title`}>{star ? `Étoile à 5 branches, somme ${star.constant}` : 'Étoile à 5 branches vide'}</title>
    <desc id={`${id}-desc`}>{star ? `${star.values.map((v, i) => `Case ${i + 1} : ${v}`).join(' ; ')}. Les cinq lignes ont pour somme ${star.constant}.` : 'Dix emplacements : cinq sommets et cinq intersections.'}</desc>
    <rect width="640" height="670" fill="var(--star-surface, #fff)" />
    <path d="M320 45 490 570 50 245 590 245 150 570Z" fill="none" stroke="var(--star-ink, #151515)" strokeWidth="18" strokeLinejoin="round" />
    {POINTS.map(([x, y], index) => <g key={index}>
      <circle data-region={index + 1} cx={x} cy={y} r="32" fill="var(--star-surface, #fff)" stroke="var(--star-ink, #151515)" strokeWidth="4" />
      {star && <text data-case={index + 1} x={x} y={y} data-center={y} data-width="48" data-height="36" data-font-size="46"
        textAnchor="middle" dominantBaseline="central" fill="var(--star-ink, #151515)" fontSize="46" fontWeight="700" fontFamily="Georgia, serif">
        <title>{`Case ${index + 1} : ${star.values[index]}`}</title>{formatNumeral(star.values[index], numerals)}
      </text>}
    </g>)}
    {star && <text x="320" y="637" data-constant="true" data-center="637" data-width="588" data-height="34" data-font-size="28"
      textAnchor="middle" dominantBaseline="central" fill="var(--star-ink, #151515)" fontSize="28" fontWeight="700" fontFamily="Georgia, serif">
      Constante magique : {formatNumeral(star.constant, numerals)}
    </text>}
  </svg>;
});

export default FivePointStarDiagram;
