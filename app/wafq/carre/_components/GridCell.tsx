// Porté depuis prozizou/Kanzou components/GridCell.tsx (voir lib/kanzouWafq.ts
// pour le contexte du portage) — logique de taille de police adaptative
// adaptée à la largeur des cases (plus de défilement), classes Tailwind d'origine remplacées par .kz-cell (carre.css).
export default function GridCell({
  value,
  filled,
  scale = 1,
  edge = false,
}: {
  value: string | number | null;
  filled: boolean;
  /** Multiplicateur manuel (curseur "Taille du texte"), 1 = taille par défaut. */
  scale?: number;
  /** Case du pourtour du carré : fond orange (accent du thème). */
  edge?: boolean;
}) {
  const text = value === null || value === undefined ? '—' : String(value);

  // Taille « confortable » selon le nombre de caractères, multipliée par le
  // curseur manuel…
  const maxRem =
    text.length <= 2 ? 1.25
    : text.length === 3 ? 1.125
    : text.length === 4 ? 1
    : text.length <= 6 ? 0.875
    : text.length <= 9 ? 0.75
    : text.length <= 13 ? 0.625
    : 0.5625;
  // …mais jamais plus que ce que la case peut contenir : --kz-cell est la
  // largeur réelle d'une case (carre.css) ; un chiffre à chasse fixe occupe
  // ~0,62 em, plus la marge intérieure de la case.
  const fit = 1 / (0.62 * text.length + 0.45);
  const fontSize = `min(${(maxRem * scale).toFixed(3)}rem, calc((var(--kz-cell) - 4px) * ${fit.toFixed(4)}))`;

  return (
    <div className={'kz-cell' + (filled ? '' : ' empty') + (edge ? ' edge' : '')} title={text}>
      <span className="kz-cell-txt" style={{ fontSize }}>{text}</span>
    </div>
  );
}
