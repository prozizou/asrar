/**
 * Moteur de calcul des carrés (wafq) — porté TEL QUEL depuis le dépôt
 * prozizou/Kanzou (portage web de l'app Android "Al Kanzou Pro",
 * Sketchware, com.alkanzouHatim ; voir son README.md pour l'historique
 * complet des choix, bugs corrigés et généralisations par taille) —
 * intégré ici comme moteur des « Carrés numériques » (app/wafq/carre),
 * section avancée du module Wafq à côté du générateur par intention.
 *
 * Ces formules sont elles-mêmes portées TELLES QUELLES depuis le code
 * Java d'origine (Ghaz1Activity.java pour le 3x3, M4x4Activity.java pour
 * le 4x4, etc.) — aucune modification de la logique de calcul lors de ce
 * second portage, uniquement l'emplacement du fichier.
 *
 * `trunc()` reproduit exactement le cast `(long)` de Java : troncature
 * vers zéro, pas un arrondi — conservée pour ne pas changer les résultats
 * numériques par rapport à l'app d'origine.
 */

const trunc = (n: number) => Math.trunc(n);

// ---------------------------------------------------------------------
// 3x3
// ---------------------------------------------------------------------

export interface Square3 {
  e1: number;
  e2: number;
  e3: number;
  e4: number;
  e5: number | string;
  e6: number;
  e7: number;
  e8: number;
  e9: number;
}

/**
 * Mode "Wilaya" : 3 valeurs connues (e2, e4, e9) -> complète les 6 autres.
 * (dans l'app d'origine, e1/e3/e5/e6/e7/e8 étaient désactivés = calculés)
 */
export function wilaya(e2: number, e4: number, e9: number): Square3 {
  let e6: number;
  let e8: number;
  if (e9 % 2 === 0) {
    e6 = trunc(e9 / 2);
    e8 = trunc(e9 / 2);
  } else {
    e6 = trunc(e9 / 2);
    e8 = trunc(e9 / 2) + 1;
  }
  const e7 = trunc(e4 + e8);
  const e3 = trunc(e2 + e6);
  const e1 = trunc(e4 + e2);
  const e5 = `الحاجة + ${trunc(e9 + e1)}`;
  return { e1, e2, e3, e4, e5, e6, e7, e8, e9 };
}

/**
 * Mode "Ghazaly" : une seule valeur (la "hajah") -> complète tout le carré.
 */
export function ghazaly(hajah: number): Square3 {
  const base = (hajah - 12) / 3;
  const e1 = trunc(base);
  const e2 = trunc(base + 1);
  const e3 = trunc(base + 2);
  const e4 = trunc(base + 3);
  const e5 = trunc(base + 4);
  const e6 = trunc(base + 5);
  const e7 = trunc(hajah - (e3 + e5));
  const e8 = trunc(hajah - (e1 + e6));
  const e9 = trunc(hajah - (e2 + e4));
  return { e1, e2, e3, e4, e5, e6, e7, e8, e9 };
}

/**
 * Mode "Bayt" : deux valeurs — la "hajah" (base générale) et une base
 * secondaire ("entrée").
 *
 * BUG CORRIGÉ par rapport à l'app d'origine : dans Ghaz1Activity.java, le
 * champ "entrée" avait un TextWatcher qui s'auto-multipliait par 3 sur
 * CHAQUE frappe (il s'écoutait lui-même au lieu d'écouter le champ
 * "hajah"), ce qui provoquait un emballement (1 -> 3 -> 9 -> 27 ...) dès
 * la première touche tapée. Le comportement manifestement voulu était
 * "entrée" = 3 x hajah, calculé automatiquement. Ici, l'UI web propose
 * cette valeur par défaut mais reste éditable.
 */
export function bayt(hajah: number, entree: number): Square3 {
  const e6 = trunc(entree);
  const e4 = trunc(e6 * 2);
  const e8 = trunc(e6 * 4);
  const e9 = trunc(e6 * 5);
  const e7 = trunc(e6 * 6);
  const e2 = trunc(hajah - (e7 + e6));
  const e3 = trunc(hajah - (e4 + e8));
  const e1 = trunc(hajah - (e6 + e8));
  const e5 = "x";
  return { e1, e2, e3, e4, e5, e6, e7, e8, e9 };
}

// Ordre d'affichage visuel de la grille 3x3 (voir ghaz1.xml) :
// Rangée 1 : e4 | e9 | e2
// Rangée 2 : e3 | e5 | e7
// Rangée 3 : e8 | e1 | e6
export const SQUARE3_LAYOUT: (keyof Square3)[][] = [
  ["e4", "e9", "e2"],
  ["e3", "e5", "e7"],
  ["e8", "e1", "e6"],
];

// ---------------------------------------------------------------------
// 4x4
// ---------------------------------------------------------------------

export interface Square4 {
  t: number[]; // t[0]..t[15] = t1..t16 dans le code Java
}

/**
 * Carré 4x4 : une seule valeur de base -> complète les 16 cases.
 * (M4x4Activity.java : textview1..textview16, edittext1)
 */
export function carre4(base: number): Square4 {
  const t: number[] = [];
  for (let i = 0; i < 12; i++) {
    t.push(trunc((base - 30) / 4 + i));
  }
  // t[12]=t13, t[13]=t14, t[14]=t15, t[15]=t16 (index Java -1)
  const t13 = trunc(base - (t[1] + t[6] + t[11])); // t2 + t7 + t12
  const t14 = trunc(base - (t[0] + t[10] + t[7])); // t1 + t11 + t8
  const t15 = trunc(base - (t[9] + t[4] + t[3])); // t10 + t5 + t4
  const t16 = trunc(base - (t[2] + t[8] + t[5])); // t3 + t9 + t6
  t.push(t13, t14, t15, t16);
  return { t };
}

// Disposition visuelle réelle du 4x4 (vérifiée dans m4x4.xml — l'ordre
// des vues n'est PAS textview1..16 dans l'ordre, comme pour le 3x3) :
// Rangée 1 : t8  t11 t14 t1
// Rangée 2 : t13 t2  t7  t12
// Rangée 3 : t3  t16 t9  t6
// Rangée 4 : t10 t5  t4  t15
export const SQUARE4_LAYOUT: number[][] = [
  [7, 10, 13, 0],
  [12, 1, 6, 11],
  [2, 15, 8, 5],
  [9, 4, 3, 14],
];

// ---------------------------------------------------------------------
// 5x5
// ---------------------------------------------------------------------

export interface Square5 {
  t: (number | null)[]; // t[0]..t[24] = textview1..textview25 dans le code Java
  total?: number; // uniquement renseigné en mode "Askandria"
}

/**
 * Mode "Base" : une seule valeur -> complète les 25 cases.
 * (M5x5Activity.java : bouton "button1")
 */
export function carre5Base(base: number): Square5 {
  const t: number[] = [];
  for (let i = 0; i < 20; i++) {
    t.push(trunc((base - 60) / 5 + i));
  }
  const t21 = trunc(base - (t[4] + t[16] + t[8] + t[12])); // t5+t17+t9+t13
  const t22 = trunc(base - (t[17] + t[9] + t[13] + t[0])); // t18+t10+t14+t1
  const t23 = trunc(base - (t[5] + t[14] + t[1] + t[18])); // t6+t15+t2+t19
  const t24 = trunc(base - (t[10] + t[2] + t[19] + t[6])); // t11+t3+t20+t7
  const t25 = trunc(base - (t[11] + t[3] + t[15] + t[7])); // t12+t4+t16+t8
  t.push(t21, t22, t23, t24, t25);
  return { t };
}

/**
 * Mode "Askandria" : 4 valeurs connues (t8, t4, t21, t17 — les 4
 * "éléments" du 3x3 "Mouhamass" quand on enchaîne depuis le carré 3x3)
 * -> complète les 20 cases restantes. La case centrale (t15) reste
 * vide, comme dans l'app d'origine (case "vœux").
 * (M5x5Activity.java : bouton "imageview1")
 */
export function carre5Askandria(
  t8: number,
  t4: number,
  t21: number,
  t17: number
): Square5 {
  // Reproduit le bloc if/else Java : division par 4 avec reste,
  // renvoie [quotient/quart, 3x quotient]
  function quarter(v: number): [number, number] {
    if (v % 4 === 0) {
      return [trunc(v / 4), trunc((v / 4) * 3)];
    }
    const q = trunc(v / 4);
    return [trunc(q + (v % 4)), trunc(q * 3)];
  }

  const [t10, t13] = quarter(t8);
  const [t14, t5] = quarter(t4);
  const [t25, t11] = quarter(t21);
  const [t12, t20] = quarter(t17);

  const t3 = trunc(t13 + t5);
  const t6 = trunc(t10 + t11);
  const t19 = trunc(t14 + t20);
  const t18 = trunc(t20 + t13);
  const t7 = trunc(t10 + t12);
  const t1 = trunc(t5 + t11);
  const t24 = trunc(t14 + t25);
  const t9 = trunc(t10 + t14);
  const t16 = trunc(t11 + t20);
  const t2 = trunc(t12 + t5);
  const t23 = trunc(t25 + t13);
  const t22 = trunc(t12 + t25);
  const total = trunc(t8 + t4 + t21 + t17);

  const t: (number | null)[] = new Array(25).fill(null);
  t[0] = t1; t[1] = t2; t[2] = t3; t[3] = t4; t[4] = t5;
  t[5] = t6; t[6] = t7; t[7] = t8; t[8] = t9; t[9] = t10;
  t[10] = t11; t[11] = t12; t[12] = t13; t[13] = t14; // t[14] = t15 -> reste null
  t[15] = t16; t[16] = t17; t[17] = t18; t[18] = t19; t[19] = t20;
  t[20] = t21; t[21] = t22; t[22] = t23; t[23] = t24; t[24] = t25;

  return { t, total };
}

// Disposition visuelle réelle du 5x5 (vérifiée dans m5x5.xml)
// Rangée 1 : t18 t10 t22 t14 t1
// Rangée 2 : t12 t4  t16 t8  t25
// Rangée 3 : t6  t23 t15 t2  t19
// Rangée 4 : t5  t17 t9  t21 t13
// Rangée 5 : t24 t11 t3  t20 t7
export const SQUARE5_LAYOUT: number[][] = [
  [17, 9, 21, 13, 0],
  [11, 3, 15, 7, 24],
  [5, 22, 14, 1, 18],
  [4, 16, 8, 20, 12],
  [23, 10, 2, 19, 6],
];

// ---------------------------------------------------------------------
// 6x6
// ---------------------------------------------------------------------

export interface Square6 {
  t: number[]; // t[0]..t[35] = textview1..textview36
}

/**
 * Carré 6x6 : une seule valeur de base -> complète les 36 cases.
 * (M6x6Activity.java : bouton "materialbutton1", soustraction=105, div=6)
 */
export function carre6(base: number): Square6 {
  const t: number[] = [];
  for (let i = 0; i < 30; i++) {
    t.push(trunc((base - 105) / 6 + i));
  }
  const t31 = trunc(base - (t[12] + t[3] + t[27] + t[10] + t[23])); // t13+t4+t28+t11+t24
  const t32 = trunc(base - (t[20] + t[6] + t[7] + t[26] + t[15])); // t21+t7+t8+t27+t16
  const t33 = trunc(base - (t[16] + t[5] + t[25] + t[8] + t[19])); // t17+t6+t26+t9+t20
  const t34 = trunc(base - (t[29] + t[4] + t[9] + t[28] + t[2])); // t30+t5+t10+t29+t3
  const t35 = trunc(base - (t[0] + t[22] + t[21] + t[11] + t[17])); // t1+t23+t22+t12+t18
  const t36 = trunc(base - (t[24] + t[14] + t[13] + t[1] + t[18])); // t25+t15+t14+t2+t19
  t.push(t31, t32, t33, t34, t35, t36);
  return { t };
}

// Disposition visuelle réelle du 6x6 (vérifiée dans m6x6.xml)
// Rangée 1 : t18 t12 t22 t23 t35 t1
// Rangée 2 : t3  t29 t10 t5  t30 t34
// Rangée 3 : t13 t4  t31 t28 t11 t24
// Rangée 4 : t21 t32 t7  t8  t27 t16
// Rangée 5 : t20 t9  t26 t33 t6  t17
// Rangée 6 : t36 t25 t15 t14 t2  t19
export const SQUARE6_LAYOUT: number[][] = [
  [17, 11, 21, 22, 34, 0],
  [2, 28, 9, 4, 29, 33],
  [12, 3, 30, 27, 10, 23],
  [20, 31, 6, 7, 26, 15],
  [19, 8, 25, 32, 5, 16],
  [35, 24, 14, 13, 1, 18],
];

// ---------------------------------------------------------------------
// 7x7
// ---------------------------------------------------------------------

export interface Square7 {
  t: number[]; // t[0]..t[48] = textview1..textview49
}

/**
 * Carré 7x7 : une seule valeur de base -> complète les 49 cases.
 * (M7x7Activity.java : bouton "materialbutton1", soustraction=168, div=7)
 */
export function carre7(base: number): Square7 {
  const t: number[] = [];
  for (let i = 0; i < 42; i++) {
    t.push(trunc((base - 168) / 7 + i));
  }
  const t43 = trunc(base - (t[32] + t[10] + t[27] + t[37] + t[5] + t[15])); // t33+t11+t28+t38+t6+t16
  const t44 = trunc(base - (t[6] + t[38] + t[21] + t[11] + t[33] + t[16])); // t7+t39+t22+t12+t34+t17
  const t45 = trunc(base - (t[39] + t[22] + t[12] + t[34] + t[17] + t[0])); // t40+t23+t13+t35+t18+t1
  const t46 = trunc(base - (t[23] + t[13] + t[28] + t[18] + t[1] + t[40])); // t24+t14+t29+t19+t2+t41
  const t47 = trunc(base - (t[7] + t[29] + t[19] + t[2] + t[41] + t[24])); // t8+t30+t20+t3+t42+t25
  const t48 = trunc(base - (t[30] + t[20] + t[3] + t[35] + t[25] + t[8])); // t31+t21+t4+t36+t26+t9
  const t49 = trunc(base - (t[31] + t[14] + t[4] + t[36] + t[26] + t[9])); // t32+t15+t5+t37+t27+t10
  t.push(t43, t44, t45, t46, t47, t48, t49);
  return { t };
}

// Disposition visuelle réelle du 7x7 (vérifiée dans m7x7.xml)
// Rangée 1 : t40 t23 t13 t45 t35 t18 t1
// Rangée 2 : t32 t15 t5  t37 t27 t10 t49
// Rangée 3 : t24 t14 t46 t29 t19 t2  t41
// Rangée 4 : t16 t6  t38 t28 t11 t43 t33
// Rangée 5 : t8  t47 t30 t20 t3  t42 t25
// Rangée 6 : t7  t39 t22 t12 t44 t34 t17
// Rangée 7 : t48 t31 t21 t4  t36 t26 t9
export const SQUARE7_LAYOUT: number[][] = [
  [39, 22, 12, 44, 34, 17, 0],
  [31, 14, 4, 36, 26, 9, 48],
  [23, 13, 45, 28, 18, 1, 40],
  [15, 5, 37, 27, 10, 42, 32],
  [7, 46, 29, 19, 2, 41, 24],
  [6, 38, 21, 11, 43, 33, 16],
  [47, 30, 20, 3, 35, 25, 8],
];

// ---------------------------------------------------------------------
// 8x8
// ---------------------------------------------------------------------

export interface Square8 {
  t: number[]; // t[0]..t[63] = textview1..textview64
}

/**
 * Carré 8x8 : une seule valeur de base (minimum 252, contrôlé dans
 * l'app d'origine) -> complète les 64 cases.
 * (M8x8Activity.java : bouton "imageview1", offset=252, div=8. Les
 * TimerTask échelonnées de 1s en 1s — un simple effet de révélation
 * case par case avec animation de rotation — ne sont pas reproduites,
 * le calcul est instantané ici.)
 */
export function carre8(base: number): Square8 {
  const t: number[] = [];
  for (let i = 0; i < 56; i++) {
    t.push(trunc((base - 252) / 8 + i));
  }
  const t57 = trunc(base - (t[9] + t[23] + t[38] + t[26] + t[43] + t[4] + t[53]));
  const t58 = trunc(base - (t[22] + t[39] + t[8] + t[5] + t[52] + t[27] + t[42]));
  const t59 = trunc(base - (t[55] + t[6] + t[41] + t[24] + t[36] + t[21] + t[11]));
  const t60 = trunc(base - (t[40] + t[25] + t[54] + t[7] + t[10] + t[37] + t[20]));
  const t61 = trunc(base - (t[13] + t[18] + t[35] + t[31] + t[46] + t[49] + t[0]));
  const t62 = trunc(base - (t[19] + t[34] + t[12] + t[48] + t[1] + t[30] + t[47]));
  const t63 = trunc(base - (t[2] + t[51] + t[44] + t[29] + t[33] + t[16] + t[15]));
  const t64 = trunc(base - (t[45] + t[28] + t[3] + t[50] + t[14] + t[32] + t[17]));
  t.push(t57, t58, t59, t60, t61, t62, t63, t64);
  return { t };
}

// Disposition visuelle réelle du 8x8 (vérifiée dans m8x8.xml)
export const SQUARE8_LAYOUT: number[][] = [
  [60, 13, 18, 35, 31, 46, 49, 0],
  [19, 34, 61, 12, 48, 1, 30, 47],
  [45, 28, 3, 50, 14, 63, 32, 17],
  [2, 51, 44, 29, 33, 16, 15, 62],
  [55, 6, 41, 24, 36, 21, 58, 11],
  [40, 25, 54, 7, 59, 10, 37, 20],
  [22, 39, 8, 57, 5, 52, 27, 42],
  [9, 56, 23, 38, 26, 43, 4, 53],
];

// ---------------------------------------------------------------------
// Losange magique (mode additionnel du 8x8)
// ---------------------------------------------------------------------

export interface DiamondCell {
  p: number; // 0..3 — index de la rangée "gauche à droite"
  q: number; // 0..3 — index de la rangée "droite à gauche"
  outer: number;
  inner: number;
}

export interface Diamond8 {
  cells: DiamondCell[]; // 16 cases (losanges), chacune 2 nombres = 32 nombres
}

const DIAMOND8_OFFSET = 124; // = 8 x (32 - 1) / 2, même formule que les autres tailles
export const DIAMOND8_STEP = 8;

/**
 * Losange magique fourni par l'utilisateur : 32 nombres (1 à 32),
 * disposés en losanges eux-mêmes coupés en deux triangles. Vérifié :
 * les 4 rangées "gauche à droite", les 4 rangées "droite à gauche" et
 * les 2 colonnes somment toutes à 132 ; les carrés/losanges intérieurs
 * concentriques (coins opposés) somment tous à 66 (la moitié).
 *
 * Structure : chaque rangée "gauche à droite" (4 au total, indexées
 * p=0..3) et chaque rangée "droite à gauche" (4 au total, indexées
 * q=0..3) se croisent en 16 cases, chaque case portant exactement 2
 * des 32 nombres (l'un "extérieur", l'un "intérieur" du losange qui
 * la représente) — retrouvé en croisant les 8 équations fournies.
 *
 * Généralisation à une valeur de base arbitraire par décalage
 * uniforme, comme pour carre10/carre11 : k = trunc((base - 124) / 8),
 * chaque nombre = valeur de référence + (k - 1). base = 132 restitue
 * exactement le losange fourni (k = 1).
 *
 * IMPORTANT — contrairement aux carrés N×N (où chaque case n'appartient
 * qu'à UNE rangée), ici chaque case appartient à la fois à une rangée
 * "gauche à droite" ET à une rangée "droite à gauche". Le correctif
 * "dernières cases calculées par différence" utilisé pour le 9x9 (une
 * seule case manquante par rangée) ne s'applique donc pas : tenter de
 * calculer 8 cases par différence (une par rangée) crée une dépendance
 * circulaire (la case manquante d'une rangée "gauche à droite" dépend
 * alors de la case manquante d'une rangée "droite à gauche" qui elle-
 * même en dépend), impossible à résoudre par simple soustraction.
 *
 * Le décalage uniforme ne donne donc des sommes EXACTEMENT égales à
 * base que si (base - 124) est un multiple de 8 (voir
 * isValidDiamond8Base ci-dessous) — sinon `trunc()` introduit un écart
 * (ex. base=241 → sommes réelles de 236, pas 241). L'UI doit donc
 * n'accepter que ces valeurs plutôt que d'afficher un losange dont les
 * rangées ne totalisent pas le nombre entré.
 */
export function isValidDiamond8Base(base: number): boolean {
  return Number.isInteger(base) && (base - DIAMOND8_OFFSET) % DIAMOND8_STEP === 0;
}
const DIAMOND8_REFERENCE: [number, number][][] = [
  // p=0
  [
    [1, 24],
    [11, 30],
    [23, 2],
    [9, 32],
  ],
  // p=1
  [
    [28, 13],
    [4, 21],
    [12, 29],
    [17, 8],
  ],
  // p=2
  [
    [31, 10],
    [6, 19],
    [14, 27],
    [20, 5],
  ],
  // p=3
  [
    [7, 18],
    [25, 16],
    [3, 22],
    [15, 26],
  ],
];

export function diamond8(base: number): Diamond8 {
  const k = trunc((base - DIAMOND8_OFFSET) / 8);
  const cells: DiamondCell[] = [];
  for (let p = 0; p < 4; p++) {
    for (let q = 0; q < 4; q++) {
      const [outerRef, innerRef] = DIAMOND8_REFERENCE[p][q];
      cells.push({
        p,
        q,
        outer: trunc(outerRef - 1 + k),
        inner: trunc(innerRef - 1 + k),
      });
    }
  }
  return { cells };
}

/**
 * Grille rectangulaire (pour l'export Word) reproduisant la silhouette
 * du losange : les cases sont groupées par niveau visuel (Y = p + q,
 * 7 niveaux), triées de gauche à droite (X = p - q), chaque case
 * contribuant ses 2 nombres. Les niveaux plus courts que le niveau le
 * plus large (8 nombres, l'équateur) sont complétés par des cases
 * vides de part et d'autre pour rester centrés — comme sur le dessin
 * d'origine.
 */
export function diamond8ToRows(diamond: Diamond8): (number | null)[][] {
  const byLevel = new Map<number, DiamondCell[]>();
  for (const cell of diamond.cells) {
    const y = cell.p + cell.q;
    if (!byLevel.has(y)) byLevel.set(y, []);
    byLevel.get(y)!.push(cell);
  }

  const maxWidth = Math.max(
    ...Array.from(byLevel.values()).map((cells) => cells.length * 2)
  );

  const rows: (number | null)[][] = [];
  for (let y = 0; y <= 6; y++) {
    const cells = (byLevel.get(y) ?? []).slice().sort((a, b) => a.p - a.q - (b.p - b.q));
    const values = cells.flatMap((c) => [c.outer, c.inner]);
    const padding = (maxWidth - values.length) / 2;
    const row: (number | null)[] = [];
    for (let i = 0; i < padding; i++) row.push(null);
    row.push(...values);
    for (let i = 0; i < padding; i++) row.push(null);
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------
// 9x9
// ---------------------------------------------------------------------

export interface Square9 {
  t: (number | null)[]; // t[0]..t[80] = textview1..textview81
}

/**
 * Carré 9x9 : une seule valeur de base (minimum 360).
 *
 * Les 72 premières cases suivent la même formule linéaire que les
 * autres carrés. Dans M9x9Activity.java, le code s'arrête après
 * textview72 avec un commentaire "//KASR" — les 9 dernières cases
 * (textview73 à textview81) sont déclarées et liées (findViewById)
 * mais ne sont JAMAIS calculées dans le code source d'origine
 * (développement laissé inachevé).
 *
 * Complétées ici avec la même logique que le reste du carré magique :
 * chaque ligne de `SQUARE9_LAYOUT` contient exactement UNE de ces 9
 * cases manquantes, et chaque ligne d'un carré magique doit sommer à
 * la valeur entrée (base). La case manquante de chaque ligne vaut donc
 * la différence entre "base" et la somme des 8 autres cases (la
 * "cage" horizontale) de cette même ligne.
 * (M9x9Activity.java : bouton "imageview1", offset=360, div=9)
 */
export function carre9(base: number): Square9 {
  const t: (number | null)[] = [];
  for (let i = 0; i < 72; i++) {
    t.push(trunc((base - 360) / 9 + i));
  }
  for (let i = 72; i < 81; i++) {
    t.push(null); // rempli ci-dessous via la somme de la ligne
  }

  for (const row of SQUARE9_LAYOUT) {
    const missing = row.find((idx) => idx >= 72);
    if (missing === undefined) continue;
    const sumRest = row
      .filter((idx) => idx !== missing)
      .reduce((acc, idx) => acc + (t[idx] as number), 0);
    t[missing] = trunc(base - sumRest);
  }

  return { t };
}

// Disposition visuelle réelle du 9x9 (vérifiée dans m9x9.xml)
export const SQUARE9_LAYOUT: number[][] = [
  [69, 58, 26, 15, 75, 54, 42, 21, 0],
  [49, 38, 27, 5, 65, 53, 32, 11, 80],
  [39, 7, 6, 66, 55, 33, 12, 72, 60],
  [59, 28, 16, 76, 45, 43, 22, 1, 70],
  [19, 18, 77, 56, 44, 23, 2, 71, 50],
  [29, 17, 67, 46, 24, 13, 73, 61, 40],
  [8, 78, 57, 36, 34, 3, 63, 51, 30],
  [9, 68, 47, 35, 14, 74, 52, 41, 20],
  [79, 48, 37, 25, 4, 64, 62, 31, 10],
];

// ---------------------------------------------------------------------
// 10x10
// ---------------------------------------------------------------------

export interface Square10 {
  t: number[]; // t[0]..t[99], en ordre visuel ligne par ligne
}

const OFFSET_10 = 495; // = 10 x (10² - 1) / 2, même formule que les autres tailles

/**
 * Carré 10x10 : contrairement aux tailles 3 à 9, M10x10Activity.java
 * ne contient AUCUNE formule (le clic sur le bouton ne fait rien —
 * développement jamais commencé). Il n'y a donc rien à porter
 * fidèlement depuis l'app d'origine.
 *
 * Carré de référence ci-dessous fourni par l'utilisateur : un carré
 * magique complet et valide (vérifié : les 10 lignes, les 10
 * colonnes ET les deux diagonales somment toutes à 505, avec les 100
 * entiers de 1 à 100 utilisés une seule fois chacun).
 *
 * Généralisation à une valeur de base arbitraire : ajouter la même
 * constante à chaque case d'un carré magique préserve la propriété
 * magique (chaque ligne/colonne gagne 10 fois cette constante). On
 * calcule donc k = trunc((base - 495) / 10) et on décale chaque
 * valeur de référence de (k - 1) : base = 505 restitue exactement le
 * carré de référence (k = 1), base = 495 donne le carré 0..99 (k = 0).
 * C'est le même principe que carre8/carre9 (offset = N x (N² - 1) / 2).
 */
const SQUARE10_REFERENCE: number[][] = [
  [92, 98, 4, 85, 86, 17, 23, 79, 10, 11],
  [99, 80, 81, 87, 93, 24, 5, 6, 12, 18],
  [1, 7, 88, 19, 25, 76, 82, 13, 94, 100],
  [8, 14, 20, 21, 2, 83, 89, 95, 96, 77],
  [15, 16, 22, 3, 9, 90, 91, 97, 78, 84],
  [67, 73, 54, 60, 61, 42, 48, 29, 35, 36],
  [74, 55, 56, 62, 68, 49, 30, 31, 37, 43],
  [51, 57, 63, 69, 75, 26, 32, 38, 44, 50],
  [58, 64, 70, 71, 52, 33, 39, 45, 46, 27],
  [40, 41, 47, 28, 34, 65, 66, 72, 53, 59],
];

export function carre10(base: number): Square10 {
  const k = trunc((base - OFFSET_10) / 10);
  const t = SQUARE10_REFERENCE.flat().map((v) => trunc(v - 1 + k));
  return { t };
}

// Le carré de référence est déjà donné dans l'ordre visuel (ligne par
// ligne) : la disposition est donc l'identité, contrairement aux
// autres tailles qui reproduisent un ordre de vues XML hérité de
// l'app Android d'origine.
export const SQUARE10_LAYOUT: number[][] = Array.from({ length: 10 }, (_, r) =>
  Array.from({ length: 10 }, (_, c) => r * 10 + c)
);

// ---------------------------------------------------------------------
// 11x11
// ---------------------------------------------------------------------

export interface Square11 {
  t: number[]; // t[0]..t[120], en ordre visuel ligne par ligne
}

const OFFSET_11 = 660; // = 11 x (11² - 1) / 2, même formule que les autres tailles

/**
 * Carré 11x11 : taille absente de l'app Android d'origine (le plus
 * grand carré développé était le 10x10, resté inachevé). Même
 * principe que carre10 : carré de référence fourni par l'utilisateur
 * — vérifié comme carré magique complet et valide (les 11 lignes, les
 * 11 colonnes ET les deux diagonales somment toutes à 671, avec les
 * 121 entiers de 1 à 121 utilisés une seule fois chacun) — généralisé
 * à une valeur de base arbitraire par décalage uniforme :
 * k = trunc((base - 660) / 11), chaque case = valeur de référence
 * + (k - 1). base = 671 restitue exactement le carré de référence
 * (k = 1), base = 660 donne le carré 0..120 (k = 0).
 */
const SQUARE11_REFERENCE: number[][] = [
  [68, 81, 94, 107, 120, 1, 14, 27, 40, 53, 66],
  [80, 93, 106, 119, 11, 13, 26, 39, 52, 65, 67],
  [92, 105, 118, 10, 12, 25, 38, 51, 64, 77, 79],
  [104, 117, 9, 22, 24, 37, 50, 63, 76, 78, 91],
  [116, 8, 21, 23, 36, 49, 62, 75, 88, 90, 103],
  [7, 20, 33, 35, 48, 61, 74, 87, 89, 102, 115],
  [19, 32, 34, 47, 60, 73, 86, 99, 101, 114, 6],
  [31, 44, 46, 59, 72, 85, 98, 100, 113, 5, 18],
  [43, 45, 58, 71, 84, 97, 110, 112, 4, 17, 30],
  [55, 57, 70, 83, 96, 109, 111, 3, 16, 29, 42],
  [56, 69, 82, 95, 108, 121, 2, 15, 28, 41, 54],
];

export function carre11(base: number): Square11 {
  const k = trunc((base - OFFSET_11) / 11);
  const t = SQUARE11_REFERENCE.flat().map((v) => trunc(v - 1 + k));
  return { t };
}

// Carré de référence déjà donné dans l'ordre visuel : disposition = identité.
export const SQUARE11_LAYOUT: number[][] = Array.from({ length: 11 }, (_, r) =>
  Array.from({ length: 11 }, (_, c) => r * 11 + c)
);

// ---------------------------------------------------------------------
// Hatim triangulaire
// ---------------------------------------------------------------------

export interface HatimTriangle {
  d: number;
  sommet: number; // sommet du triangle extérieur (haut)
  baseGauche: number; // coin bas-gauche
  baseDroite: number; // coin bas-droit
  gauche: number; // milieu du côté gauche (entre sommet et baseGauche)
  droite: number; // milieu du côté droit (entre sommet et baseDroite)
  bas: number; // milieu du côté bas (entre baseGauche et baseDroite)
  centreHaut: number; // sommet du triangle intérieur (entre gauche et droite)
  centreGauche: number; // coin bas-gauche du triangle intérieur (entre gauche et bas)
  centreDroite: number; // coin bas-droit du triangle intérieur (entre droite et bas)
}

/**
 * Hatim triangulaire "parfait" — 4e mode du 3x3, à côté de Wilaya /
 * Ghazaly / Bayt. Absent de l'app Android d'origine (aucune Activity
 * Java correspondante à porter) : structure géométrique reconstruite
 * et vérifiée à partir d'un exemple fourni par l'utilisateur
 * (sommet=200, base gauche=150, base droite=250, D=644), où chacune
 * des 6 lignes droites du diagramme — les 3 côtés du triangle
 * extérieur ET les 3 côtés du triangle médian intérieur — somme
 * exactement à D :
 *   200+294+150=644   200+194+250=644   150+244+250=644
 *   294+156+194=644   294+106+244=644   194+206+244=644
 *
 * PREMIÈRE VERSION BUGUÉE (corrigée ici) : départager les 3 sommets en
 * 3 valeurs CONSÉCUTIVES autour de D/3 provoquait des répétitions
 * massives dans les 6 cases restantes (démontré : si D est un multiple
 * de 3, "gauche" retombe exactement sur "baseDroite", etc. — observé
 * concrètement avec D=9 -> seulement les valeurs 2/3/4, chacune 3
 * fois).
 *
 * CORRECTIF : la somme des 3 sommets extérieurs (Souter = sommet +
 * baseGauche + baseDroite) est mathématiquement FIXÉE par la structure
 * elle-même, quelle que soit D (démonstration : en notant Smid la
 * somme des 3 milieux extérieurs et Sinner celle des 3 sommets
 * intérieurs, les 6 contraintes de ligne donnent 3D = 2×Souter + Smid
 * et 3D = 2×Smid + Sinner, et Souter+Smid+Sinner = somme totale des 9
 * cases ; en résolvant, Souter = (somme totale)/3 toujours). Avec les
 * 9 chiffres 1..9 (somme totale 45), Souter = 15 obligatoirement, ce
 * qui borne D à l'intervalle [12, 18] pour une solution 100% unique
 * (chiffres 1 à 9 chacun une fois) — et une recherche exhaustive
 * confirme que seuls D = 12, 14, 16, 18 ont une solution (D = 13, 15,
 * 17 n'en ont AUCUNE, quel que soit l'arrangement) : exactement les 4
 * exemples de l'image de référence d'origine.
 *
 * RÉFÉRENCE EXACTE fournie par l'utilisateur (image des 4 triangles
 * D:12/14/16/18) : les valeurs ci-dessous reproduisent très précisément
 * ces 4 diagrammes (vérifié : chaque triangle est bien une permutation
 * des chiffres 1 à 9, et les 6 lignes valent chacune D). Fait notable,
 * vérifié aussi : D:18 est le complément exact de D:12, et D:16 celui
 * de D:14 (chaque case = 10 − la case correspondante) — cohérent avec
 * Souter = 15 (voir plus haut) : remplacer chaque valeur v par 10 − v
 * change chaque ligne de 3 cases de D à 30 − D, donc transforme
 * automatiquement une solution D=12 en solution D=18 (30 − 12), et
 * D=14 en D=16 (30 − 14).
 *
 * Généralisation à une valeur D arbitraire hors {12, 14, 16, 18} —
 * comme carre10/carre11/diamond8, qui décalent uniformément une
 * référence validée : un décalage uniforme de +k sur les 9 cases
 * d'une solution valide augmente chaque ligne (3 cases) de 3k, donc
 * préserve à la fois l'égalité des 6 lignes ET l'unicité des 9
 * valeurs (décaler des valeurs distinctes les garde distinctes). Une
 * des 3 solutions de référence (D=12, 14 ou 16 — un représentant par
 * reste modulo 3) est choisie selon D mod 3, puis décalée de
 * k = (D − D_référence) / 3.
 */
type HatimTriangleCells = {
  a: number; // sommet
  l: number; // gauche
  r: number; // droite
  bl: number; // baseGauche
  m: number; // bas
  br: number; // baseDroite
  ct: number; // centreHaut
  cl: number; // centreGauche
  cr: number; // centreDroite
};

const HATIM_D12: HatimTriangleCells = { a: 4, l: 2, r: 3, bl: 6, m: 1, br: 5, ct: 7, cl: 9, cr: 8 };
const HATIM_D14: HatimTriangleCells = { a: 2, l: 4, r: 7, bl: 8, m: 1, br: 5, ct: 3, cl: 9, cr: 6 };

function hatimComplement(t: HatimTriangleCells): HatimTriangleCells {
  return {
    a: 10 - t.a, l: 10 - t.l, r: 10 - t.r,
    bl: 10 - t.bl, m: 10 - t.m, br: 10 - t.br,
    ct: 10 - t.ct, cl: 10 - t.cl, cr: 10 - t.cr,
  };
}

const HATIM_D18 = hatimComplement(HATIM_D12);
const HATIM_D16 = hatimComplement(HATIM_D14);

// Les 4 seules valeurs de D ayant une solution 100% unique aux chiffres
// 1-9 : reproduites EXACTEMENT (aucun décalage), pour matcher l'image
// de référence au chiffre près.
const HATIM_TRIANGLE_EXACT: Record<number, HatimTriangleCells> = {
  12: HATIM_D12,
  14: HATIM_D14,
  16: HATIM_D16,
  18: HATIM_D18,
};

// Un représentant par reste modulo 3, utilisé pour généraliser à un D
// hors de la table exacte ci-dessus (voir doc de hatimTriangulaire).
const HATIM_TRIANGLE_ANCHOR: Record<number, { d: number } & HatimTriangleCells> = {
  0: { d: 12, ...HATIM_D12 },
  1: { d: 16, ...HATIM_D16 },
  2: { d: 14, ...HATIM_D14 },
};

export function hatimTriangulaire(hajah: number): HatimTriangle {
  const d = trunc(hajah);
  const exact = HATIM_TRIANGLE_EXACT[d];

  let cells: HatimTriangleCells;
  if (exact) {
    cells = exact;
  } else {
    const mod3 = ((d % 3) + 3) % 3;
    const anchor = HATIM_TRIANGLE_ANCHOR[mod3];
    const k = (d - anchor.d) / 3;
    cells = {
      a: anchor.a + k, l: anchor.l + k, r: anchor.r + k,
      bl: anchor.bl + k, m: anchor.m + k, br: anchor.br + k,
      ct: anchor.ct + k, cl: anchor.cl + k, cr: anchor.cr + k,
    };
  }

  return {
    d,
    sommet: cells.a,
    baseGauche: cells.bl,
    baseDroite: cells.br,
    gauche: cells.l,
    droite: cells.r,
    bas: cells.m,
    centreHaut: cells.ct,
    centreGauche: cells.cl,
    centreDroite: cells.cr,
  };
}

/**
 * Grille rectangulaire (pour l'export Word), reproduisant la
 * silhouette du triangle en 4 rangées, cases vides pour combler les
 * coins non utilisés (même principe que diamond8ToRows) :
 *   [   _   , sommet     ,    _     ]
 *   [gauche , centreHaut , droite   ]
 *   [centreGauche, _     , centreDroite]
 *   [baseGauche, bas     , baseDroite]
 */
export function hatimTriangleToRows(
  triangle: HatimTriangle
): (number | null)[][] {
  return [
    [null, triangle.sommet, null],
    [triangle.gauche, triangle.centreHaut, triangle.droite],
    [triangle.centreGauche, null, triangle.centreDroite],
    [triangle.baseGauche, triangle.bas, triangle.baseDroite],
  ];
}
