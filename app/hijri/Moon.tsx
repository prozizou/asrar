// Lune stylisée : croissant éclairé à droite (croissante, attraction) ou à
// gauche (décroissante, repoussement).
export default function Moon({ waxing = true, size = 56 }: { waxing?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="hijri-moon">
      <circle cx="50" cy="50" r="46" fill="#1d3640" />
      <circle cx="50" cy="50" r="46" fill="none" stroke="#ffffff22" />
      <g transform={waxing ? undefined : 'translate(100 0) scale(-1 1)'}>
        <path d="M50 4 A46 46 0 0 1 50 96 A24 46 0 0 0 50 4 Z" fill="#f6d98e" />
      </g>
    </svg>
  );
}
