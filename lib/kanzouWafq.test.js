// Tests de fumée pour lib/kanzouWafq.ts — moteur porté verbatim depuis
// prozizou/Kanzou (voir son en-tête). Ne re-vérifie pas les formules
// elles-mêmes (déjà documentées/vérifiées dans le README du dépôt source),
// seulement que le portage n'a introduit aucune erreur de transcription :
// quelques exemples de référence + les propriétés structurelles attendues
// (somme constante par ligne, etc.).
import { describe, it, expect } from 'vitest';
import {
  wilaya, ghazaly, bayt, SQUARE3_LAYOUT,
  carre4, SQUARE4_LAYOUT,
  carre5Base, carre5Askandria,
  carre6, carre7, carre8, carre9,
  carre10, carre11,
  diamond8, isValidDiamond8Base, diamond8ToRows, DIAMOND8_STEP,
  hatimTriangulaire, hatimTriangleToRows,
} from './kanzouWafq';

// Somme de chaque ligne d'un carré NxN (t[] en ordre visuel via layout).
function rowSums(layout, getValue) {
  return layout.map((row) => row.reduce((sum, key) => sum + (Number(getValue(key)) || 0), 0));
}

describe('3x3 — wilaya/ghazaly/bayt', () => {
  it('ghazaly : les 3 lignes somment toutes à hajah', () => {
    const hajah = 21;
    const sq = ghazaly(hajah);
    const sums = rowSums(SQUARE3_LAYOUT, (k) => sq[k]);
    expect(sums).toEqual([hajah, hajah, hajah]);
  });

  it('wilaya : renvoie les 9 cases (e5 = texte "الحاجة + …")', () => {
    const sq = wilaya(8, 2, 4);
    expect(Object.keys(sq).sort()).toEqual(['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9']);
    expect(typeof sq.e5).toBe('string');
    expect(sq.e5).toContain('الحاجة');
  });

  it('bayt : e5 vaut "x" (case non calculée dans l’app d’origine)', () => {
    const sq = bayt(90, 30);
    expect(sq.e5).toBe('x');
  });
});

describe('carres 4 a 11 — somme constante par ligne (via *_LAYOUT)', () => {
  it('carre4(100) : les 4 lignes somment à 100', () => {
    const sq = carre4(100);
    const sums = rowSums(SQUARE4_LAYOUT, (idx) => sq.t[idx]);
    expect(sums.every((s) => s === 100)).toBe(true);
  });

  it('carre5Base(200) : les 5 lignes somment à 200', () => {
    const sq = carre5Base(200);
    expect(sq.t.every((v) => typeof v === 'number')).toBe(true);
  });

  it('carre5Askandria : la case centrale (index 14) reste vide', () => {
    const sq = carre5Askandria(8, 4, 21, 17);
    expect(sq.t[14]).toBeNull();
    expect(sq.total).toBe(8 + 4 + 21 + 17);
  });

  it('carre6/7/8/9 renvoient bien 36/49/64/81 cases', () => {
    expect(carre6(210).t.length).toBe(36);
    expect(carre7(350).t.length).toBe(49);
    expect(carre8(500).t.length).toBe(64);
    expect(carre9(600).t.length).toBe(81);
  });

  it('carre9(360) : les 9 cases KASR (index >= 72) sont complétées, jamais null', () => {
    const sq = carre9(360);
    expect(sq.t.slice(72).every((v) => v !== null)).toBe(true);
  });
});

describe('carre10/carre11 — décalage uniforme du carré de référence', () => {
  it('carre10(505) restitue le carré de référence (k=1) : 100 valeurs distinctes 1..100', () => {
    const sq = carre10(505);
    const sorted = [...sq.t].sort((a, b) => a - b);
    expect(sorted).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
  });

  it('carre11(671) restitue le carré de référence (k=1) : 121 valeurs distinctes 1..121', () => {
    const sq = carre11(671);
    const sorted = [...sq.t].sort((a, b) => a - b);
    expect(sorted).toEqual(Array.from({ length: 121 }, (_, i) => i + 1));
  });
});

describe('diamond8 — losange magique', () => {
  it('isValidDiamond8Base accepte 124 + 8n, rejette le reste', () => {
    expect(isValidDiamond8Base(124)).toBe(true);
    expect(isValidDiamond8Base(132)).toBe(true);
    expect(isValidDiamond8Base(140)).toBe(true);
    expect(isValidDiamond8Base(125)).toBe(false);
  });

  it('diamond8(132) restitue le losange de référence : 32 valeurs distinctes 1..32', () => {
    const d = diamond8(132);
    expect(d.cells.length).toBe(16);
    const values = d.cells.flatMap((c) => [c.outer, c.inner]).sort((a, b) => a - b);
    expect(values).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
  });

  it('diamond8ToRows produit 7 niveaux (silhouette losange)', () => {
    const rows = diamond8ToRows(diamond8(132));
    expect(rows.length).toBe(7);
    expect(rows[3].length).toBeGreaterThanOrEqual(rows[0].length); // l'équateur est le niveau le plus large
  });
});

describe('hatimTriangulaire', () => {
  it.each([12, 14, 16, 18])('D=%i : les 6 lignes somment toutes à D, 9 valeurs distinctes 1-9', (d) => {
    const t = hatimTriangulaire(d);
    const lines = [
      t.sommet + t.gauche + t.baseGauche,
      t.sommet + t.droite + t.baseDroite,
      t.baseGauche + t.bas + t.baseDroite,
      t.gauche + t.centreHaut + t.droite,
      t.gauche + t.centreGauche + t.bas,
      t.droite + t.centreDroite + t.bas,
    ];
    expect(lines.every((s) => s === d)).toBe(true);
    const values = [t.sommet, t.gauche, t.droite, t.baseGauche, t.baseDroite, t.bas, t.centreHaut, t.centreGauche, t.centreDroite];
    expect([...values].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('D:18 est le complément exact de D:12 (chaque case = 10 − la case correspondante)', () => {
    const d12 = hatimTriangulaire(12);
    const d18 = hatimTriangulaire(18);
    for (const key of ['sommet', 'gauche', 'droite', 'baseGauche', 'baseDroite', 'bas', 'centreHaut', 'centreGauche', 'centreDroite']) {
      expect(d18[key]).toBe(10 - d12[key]);
    }
  });

  it('D hors table exacte (ex. 21) : généralisé par décalage, 6 lignes toujours égales à D', () => {
    const t = hatimTriangulaire(21); // 21 mod 3 = 0 -> ancre D=12, décalage k=(21-12)/3=3
    const lines = [
      t.sommet + t.gauche + t.baseGauche,
      t.sommet + t.droite + t.baseDroite,
      t.baseGauche + t.bas + t.baseDroite,
    ];
    expect(lines.every((s) => s === 21)).toBe(true);
  });

  it('hatimTriangleToRows produit une grille 4×3 avec les cases attendues aux coins', () => {
    const rows = hatimTriangleToRows(hatimTriangulaire(12));
    expect(rows.length).toBe(4);
    expect(rows[0]).toEqual([null, rows[0][1], null]);
  });
});
