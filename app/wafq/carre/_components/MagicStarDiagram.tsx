'use client';

import { forwardRef, useId, useLayoutEffect, useRef, useImperativeHandle } from 'react';
import type { MagicStar } from '@/lib/magicStar';
import { formatNumeral, type NumeralSystem } from '@/lib/kanzouNumerals';

type Point = [number, number];
// Indices identiques au modèle : les six secteurs intérieurs sont les cases 7 à 12.
const OUTER: { index: number; points: Point[] }[] = [
  { index: 1, points: [[320, 20], [233, 170], [320, 170]] },
  { index: 2, points: [[320, 20], [320, 170], [407, 170]] },
  { index: 3, points: [[60, 170], [233, 170], [190, 245]] },
  { index: 4, points: [[580, 170], [407, 170], [450, 245]] },
  { index: 5, points: [[60, 170], [190, 245], [147, 320]] },
  { index: 6, points: [[580, 170], [450, 245], [493, 320]] },
  { index: 13, points: [[60, 470], [147, 320], [190, 395]] },
  { index: 14, points: [[580, 470], [493, 320], [450, 395]] },
  { index: 15, points: [[60, 470], [190, 395], [233, 470]] },
  { index: 16, points: [[580, 470], [450, 395], [407, 470]] },
  { index: 17, points: [[320, 620], [233, 470], [320, 470]] },
  { index: 18, points: [[320, 620], [320, 470], [407, 470]] },
];
const SECTORS = [-120, -60, 180, 0, 120, 60];
const polar = (r: number, angle: number): Point => [320 + r * Math.cos(angle * Math.PI / 180), 320 + r * Math.sin(angle * Math.PI / 180)];
const pair = (p: Point) => p.join(',');
const inset = (points: Point[]) => {
  const cx = points.reduce((s, p) => s + p[0], 0) / 3;
  const cy = points.reduce((s, p) => s + p[1], 0) / 3;
  return points.map(([x, y]): Point => [cx + (x - cx) * .86, cy + (y - cy) * .86]);
};

function labelArea(index: number, point: Point) {
  const outer = OUTER.find((cell) => cell.index === index);
  const inside = (x: number, y: number) => {
    if (outer) {
      const points = inset(outer.points);
      const signs = points.map(([ax, ay], i) => {
        const [bx, by] = points[(i + 1) % 3];
        return (x - ax) * (by - ay) - (y - ay) * (bx - ax);
      });
      return signs.every((v) => v >= 0) || signs.every((v) => v <= 0);
    }
    const radius = Math.hypot(x - 320, y - 320);
    const angle = Math.atan2(y - 320, x - 320) * 180 / Math.PI;
    const difference = ((angle - SECTORS[index - 7] + 540) % 360) - 180;
    return radius > 84 && radius < 146 && Math.abs(difference) < 24;
  };
  let width = 8;
  // Rectangle inscrit, avec une marge à l'intérieur des contours rouges.
  for (let candidate = 10; candidate <= 100; candidate += 2) {
    if (![-1, 1].every((dx) => [-1, 1].every((dy) => inside(point[0] + dx * candidate / 2, point[1] + dy * 17)))) break;
    width = candidate;
  }
  return { width: Math.max(4, width - 4), height: 28 };
}

const MagicStarDiagram = forwardRef<SVGSVGElement, { star: MagicStar | null; numerals: NumeralSystem }>(function MagicStarDiagram({ star, numerals }, ref) {
  const id = useId();
  const svg = useRef<SVGSVGElement>(null);
  useImperativeHandle(ref, () => svg.current!);
  useLayoutEffect(() => {
    svg.current?.querySelectorAll<SVGTextElement>('[data-case], [data-ornament]').forEach((text) => {
      const fontSize = Number(text.dataset.fontSize || 28);
      text.setAttribute('font-size', String(fontSize));
      text.removeAttribute('textLength');
      text.setAttribute('y', text.dataset.center!);
      const box = text.getBBox();
      const ratio = Math.min(1, Number(text.dataset.width) / box.width, 28 / box.height) * .94;
      text.setAttribute('font-size', String(fontSize * ratio));
      text.setAttribute('lengthAdjust', 'spacingAndGlyphs');
      text.setAttribute('textLength', String(Math.min(text.getBBox().width, Number(text.dataset.width) * .92)));
      const fitted = text.getBBox();
      text.setAttribute('y', String(Number(text.dataset.center) - (fitted.y + fitted.height / 2 - Number(text.dataset.center))));
    });
  }, [star, numerals]);
  const label = (index: number, point: Point) => star && (
    <text key={index} data-case={index} x={point[0]} y={point[1]} textAnchor="middle" dominantBaseline="central"
      data-center={point[1]} data-width={labelArea(index, point).width}
      fill="var(--star-value, #c1121f)" fontSize="28" fontWeight="700" fontFamily="Georgia, serif">
      <title>{`Case ${index} : ${star.values[index - 1]}`}</title>
      {formatNumeral(star.values[index - 1], numerals)}
    </text>
  );
  return (
    <svg ref={svg} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 670" className="kz-star-svg"
      role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{star ? `Étoile magique à 18 cases, somme ${star.constant}` : 'Étoile magique vide'}</title>
      <desc id={`${id}-desc`}>{star ? `${star.values.map((value, i) => `Case ${i + 1} : ${value}`).join(' ; ')}. Les ${star.lines.length} alignements ont pour somme ${star.constant}.` : '18 cases sans valeurs.'}</desc>
      <rect width="640" height="670" fill="var(--star-surface, #fff)" />
      <g fill="none" stroke="var(--star-ink, #151515)" strokeWidth="5" strokeLinejoin="round">
        <circle cx="320" cy="320" r="282" /><circle cx="320" cy="320" r="270" />
        <path d="M320 20 580 470 60 470Z M320 620 60 170 580 170Z" />
        <path d="M320 20V620 M60 170 580 470 M580 170 60 470" />
        <circle cx="320" cy="320" r="64" strokeWidth="2" />
      </g>
      <g fill="none" stroke="var(--star-value, #c1121f)" strokeWidth="4" strokeLinejoin="round">
        {OUTER.map(({ index, points }) => {
          return <polygon key={index} data-region={index} points={inset(points).map(pair).join(' ')} />;
        })}
        {SECTORS.map((angle, i) => <path key={angle} data-region={i + 7} d={`M${pair(polar(150, angle - 27))} A150 150 0 0 1 ${pair(polar(150, angle + 27))} L${pair(polar(80, angle + 27))} A80 80 0 0 0 ${pair(polar(80, angle - 27))}Z`} />)}
      </g>
      <circle cx="320" cy="320" r="36" fill="var(--star-ink, #151515)" />
      <g fill="var(--star-ink, #151515)" fontSize="26" fontFamily="Arial, sans-serif" textAnchor="middle" dominantBaseline="central" lang="ar" direction="rtl">
        {[
          { position: 'top-right', text: 'جبريل', x: 435, y: 124, width: 86 },
          { position: 'top-left', text: 'ميكائيل', x: 205, y: 124, width: 86 },
          { position: 'bottom-right', text: 'اسرافيل', x: 435, y: 516, width: 86 },
          { position: 'bottom-left', text: 'عزرائيل', x: 205, y: 516, width: 86 },
          { position: 'middle-left', text: 'محمد', x: 94, y: 320, width: 66 },
          { position: 'middle-right', text: 'محمد', x: 546, y: 320, width: 66 },
        ].map(({ position, text, x, y, width }) => <text key={position} data-ornament={position} x={x} y={y}
          data-center={y} data-width={width} data-font-size="26">{text}</text>)}
      </g>
      {OUTER.map(({ index, points }) => label(index, [points.reduce((s, p) => s + p[0], 0) / 3, points.reduce((s, p) => s + p[1], 0) / 3]))}
      {SECTORS.map((angle, i) => label(i + 7, polar(115, angle)))}
      {star && <text x="320" y="655" textAnchor="middle" fill="var(--star-ink, #151515)" fontSize="20" fontFamily="sans-serif">S = {formatNumeral(star.constant, numerals)}</text>}
    </svg>
  );
});

export default MagicStarDiagram;
