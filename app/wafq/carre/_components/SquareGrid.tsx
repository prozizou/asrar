'use client';
// Porté depuis prozizou/Kanzou components/SquareGrid.tsx (voir
// lib/kanzouWafq.ts) — factorise le rendu générique d'un carré (grille CSS
// de N colonnes construite depuis un layout SQUAREN_LAYOUT) et l'export en
// lignes (utilisé par le bouton Word). `T` = type de clé du layout — un
// index numérique dans un tableau `t[]` pour la plupart des tailles, ou une
// clé "e1".."e9" pour le carré 3x3.
import GridCell from './GridCell';
import { formatNumeral, type NumeralSystem } from '@/lib/kanzouNumerals';

export default function SquareGrid<T>({
  layout,
  getValue,
  getFilled,
  numerals,
  scale = 1,
  maxWidth = 480,
}: {
  layout: T[][];
  getValue: (key: T) => string | number | null;
  getFilled?: (key: T) => boolean;
  numerals: NumeralSystem;
  /** Multiplicateur manuel de taille de texte, voir TextScaleSlider. */
  scale?: number;
  maxWidth?: number;
}) {
  const cols = layout[0]?.length ?? 1;
  const rows = layout.length;
  const values = layout.flat().map((key) => formatNumeral(getValue(key), numerals));
  // Le carré tient TOUJOURS dans la largeur disponible, sans défilement :
  // chaque case vaut 1/N de la largeur (7 × 7 → 14,2857 % chacune, écarts
  // compris). La taille des chiffres se calcule ensuite d'après la largeur
  // réelle d'une case (unités de conteneur, carre.css) : voir GridCell.

  return (
    <>
      <div className="kz-grid-scroll" style={{ maxWidth }} role="region" aria-label={`Carré numérique ${cols} × ${rows}`}>
        <div className="kz-grid" style={{ ['--cols' as string]: cols }}>
          {layout.flat().map((key, i) => {
            const r = Math.floor(i / cols), c = i % cols;
            // Pourtour du carré (première/dernière ligne et colonne) : cases orange.
            const edge = r === 0 || r === rows - 1 || c === 0 || c === cols - 1;
            return <GridCell key={i} value={values[i]} filled={getFilled ? getFilled(key) : true} scale={scale} edge={edge} />;
          })}
        </div>
      </div>
    </>
  );
}

/**
 * Même parcours que SquareGrid, mais renvoie une grille 2D de valeurs
 * déjà formatées (ordre visuel) au lieu de rendre des GridCell. Utilisé
 * pour l'export Word, qui a besoin des mêmes lignes que celles
 * affichées à l'écran (avec la numération choisie).
 */
export function squareToRows<T>(
  layout: T[][],
  getValue: (key: T) => string | number | null,
  numerals: NumeralSystem
): (string | number | null)[][] {
  return layout.map((row) => row.map((key) => formatNumeral(getValue(key), numerals)));
}
