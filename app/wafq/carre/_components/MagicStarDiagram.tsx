'use client';

import { forwardRef, useId } from 'react';
import type { MagicStar } from '@/lib/magicStar';
import { formatNumeral, type NumeralSystem } from '@/lib/kanzouNumerals';

type Point = [number, number];
// Indices identiques au modèle : les six secteurs intérieurs sont les cases 7 à 12.
const OUTER: { index: number; points: Point[]; label: Point }[] = [
  { index: 1, points: [[320, 20], [233, 170], [320, 170]], label: [290, 128] },
  { index: 2, points: [[320, 20], [320, 170], [407, 170]], label: [350, 128] },
  { index: 3, points: [[60, 170], [233, 170], [190, 245]], label: [168, 198] },
  { index: 4, points: [[580, 170], [407, 170], [450, 245]], label: [472, 198] },
  { index: 5, points: [[60, 170], [190, 245], [147, 320]], label: [126, 254] },
  { index: 6, points: [[580, 170], [450, 245], [493, 320]], label: [514, 254] },
  { index: 13, points: [[60, 470], [147, 320], [190, 395]], label: [126, 386] },
  { index: 14, points: [[580, 470], [493, 320], [450, 395]], label: [514, 386] },
  { index: 15, points: [[60, 470], [190, 395], [233, 470]], label: [168, 442] },
  { index: 16, points: [[580, 470], [450, 395], [407, 470]], label: [472, 442] },
  { index: 17, points: [[320, 620], [233, 470], [320, 470]], label: [290, 512] },
  { index: 18, points: [[320, 620], [320, 470], [407, 470]], label: [350, 512] },
];
const SECTORS = [-120, -60, 180, 0, 120, 60];
const polar = (r: number, angle: number): Point => [320 + r * Math.cos(angle * Math.PI / 180), 320 + r * Math.sin(angle * Math.PI / 180)];
const pair = (p: Point) => p.join(',');

const MagicStarDiagram = forwardRef<SVGSVGElement, { star: MagicStar; numerals: NumeralSystem }>(function MagicStarDiagram({ star, numerals }, ref) {
  const id = useId();
  const digits = Math.max(...star.values.map((v) => String(v).length));
  const fontSize = Math.min(30, 56 / (digits * .62));
  const label = (index: number, point: Point) => (
    <text key={index} data-case={index} x={point[0]} y={point[1]} textAnchor="middle" dominantBaseline="central"
      fill="var(--star-value, #c1121f)" fontSize={fontSize} fontWeight="700" fontFamily="Georgia, serif">
      <title>{`Case ${index} : ${star.values[index - 1]}`}</title>
      {formatNumeral(star.values[index - 1], numerals)}
    </text>
  );
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 670" className="kz-star-svg"
      style={{ minWidth: digits > 4 ? digits * 110 : undefined }} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Étoile magique à 18 cases, somme {star.constant}</title>
      <desc id={`${id}-desc`}>{star.values.map((value, i) => `Case ${i + 1} : ${value}`).join(' ; ')}. Les six alignements ont pour somme {star.constant}.</desc>
      <rect width="640" height="670" fill="var(--star-surface, #fff)" />
      <g fill="none" stroke="var(--star-ink, #151515)" strokeWidth="5" strokeLinejoin="round">
        <circle cx="320" cy="320" r="282" /><circle cx="320" cy="320" r="270" />
        <path d="M320 20 580 470 60 470Z M320 620 60 170 580 170Z" />
        <path d="M320 20V620 M60 170 580 470 M580 170 60 470" />
        <circle cx="320" cy="320" r="64" strokeWidth="2" />
      </g>
      <g fill="none" stroke="var(--star-value, #c1121f)" strokeWidth="4" strokeLinejoin="round">
        {OUTER.map(({ index, points }) => {
          const cx = points.reduce((s, p) => s + p[0], 0) / 3;
          const cy = points.reduce((s, p) => s + p[1], 0) / 3;
          return <polygon key={index} points={points.map(([x, y]) => pair([cx + (x - cx) * .86, cy + (y - cy) * .86])).join(' ')} />;
        })}
        {SECTORS.map((angle) => <path key={angle} d={`M${pair(polar(150, angle - 27))} A150 150 0 0 1 ${pair(polar(150, angle + 27))} L${pair(polar(80, angle + 27))} A80 80 0 0 0 ${pair(polar(80, angle - 27))}Z`} />)}
      </g>
      <circle cx="320" cy="320" r="36" fill="var(--star-ink, #151515)" />
      <g fill="var(--star-ink, #151515)" fontSize="36" textAnchor="middle" aria-hidden="true">
        <text x="196" y="126">★</text><text x="444" y="126">★</text>
        <text x="196" y="544">★</text><text x="444" y="544">★</text>
      </g>
      {OUTER.map(({ index, label: point }) => label(index, point))}
      {SECTORS.map((angle, i) => label(i + 7, polar(115, angle)))}
      <text x="320" y="655" textAnchor="middle" fill="var(--star-ink, #151515)" fontSize="20" fontFamily="sans-serif">Somme magique = {formatNumeral(star.constant, numerals)}</text>
    </svg>
  );
});

export default MagicStarDiagram;
