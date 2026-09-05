'use client';
// Module « Al-Qalam » — ÉCRITURE ORNÉE : lettres à boucle gonflée.
//
// Pratique visée : on étire démesurément la boucle (« l'œil ») d'une lettre
// ronde — م ق ه ص ض ط — et on écrit à l'intérieur une invocation ou un verset
// en micro-écriture.
//
// POURQUOI UN MODULE GRAPHIQUE À PART, et pas un réglage des modes existants :
// un glyphe de police est un contour FIGÉ. Aucun réglage typographique
// (font-size, graisse, font-feature-settings) ne permet de gonfler la seule
// panse d'un ق ni d'y couler du texte ; l'allongement kashida/tatweel (ـ) est
// le seul étirement que les polices savent faire, et il ne crée aucune zone
// remplissable. Le reste d'Al-Qalam (lib/alqalam.js) reste donc purement
// textuel ; ici tout est tracé en SVG.
//
// La géométrie et le calage du texte sont sans DOM (makeMeasurer et printPiece
// mis à part, réservés au navigateur) — d'où lib/alqalamOrne.test.js. Le module
// texte n'est chargé QU'À l'impression (import dynamique dans printPiece) :
// statique, il ferait entrer Firebase dans ce test de géométrie pure.

// ── Forme des boucles ───────────────────────────────────────────────────────
// Chaque boucle est une SUPERELLIPSE  |x/a|^n + |y/b|^n = 1 :
//   • a, b — demi-largeur / demi-hauteur, en proportion du rayon de base ;
//   • n    — « rondeur ». n = 2 donne une ellipse ; au-delà, la forme se
//            remplit vers les angles, ce qui rapproche du tracé calligraphique
//            (panse pleine, fond aplati) ET agrandit la surface écrivable.
//
// Une seule et même formule sert à tracer le contour ET à mesurer la largeur
// disponible ligne par ligne : le texte ne peut donc jamais déborder du dessin,
// quelles que soient les proportions choisies pour une lettre.
export const ROUND_LETTERS = [
  // Mîm : petite panse presque circulaire.
  { char: 'م', name: 'Mîm', a: 1.0, b: 0.95, n: 2.6, tail: 'down' },
  // Qâf : panse profonde et large — la lettre de l'exemple (رزقك).
  { char: 'ق', name: 'Qâf', a: 1.15, b: 0.9, n: 2.8, tail: 'down' },
  // Hâ : boucle haute, presque aussi haute que large.
  { char: 'ه', name: 'Hâ', a: 0.95, b: 1.0, n: 2.4, tail: 'none' },
  // Sâd / Dâd : œil long et couché, fond très aplati.
  { char: 'ص', name: 'Sâd', a: 1.3, b: 0.72, n: 3.2, tail: 'flat' },
  { char: 'ض', name: 'Dâd', a: 1.3, b: 0.72, n: 3.2, tail: 'flat' },
  // Tâ : œil couché, un peu plus haut que le sâd (hampe verticale à part).
  { char: 'ط', name: 'Tâ', a: 1.2, b: 0.78, n: 3.0, tail: 'flat' },
];

const BY_CHAR = new Map(ROUND_LETTERS.map((l) => [l.char, l]));

// ة s'écrit comme un ه bouclé : on l'accepte comme une occurrence de ه.
const EQUIV = { ة: 'ه' };

/** Lettres rondes réellement présentes dans le mot, dans l'ordre du tableau. */
export function detectRoundLetters(word) {
  const chars = new Set(
    Array.from(String(word || '')).map((c) => EQUIV[c] || c)
  );
  return ROUND_LETTERS.filter((l) => chars.has(l.char));
}

/**
 * Retire du mot toute occurrence de la lettre gonflée (et son équivalent —
 * ة pour ه). Le mot affiché à côté de la pièce ne doit PAS montrer la lettre
 * une seconde fois : elle est déjà représentée, en grand, par la boucle. Sans
 * ce retrait, un mot comme « الله » affiche son propre ه (lui-même arrondi
 * dans cette police) juste à côté de la boucle censée LE représenter — deux
 * ronds pour une seule lettre, lus comme une redite plutôt qu'un seul motif
 * agrandi. Simplification assumée : si la lettre apparaît plusieurs fois
 * dans le mot (rare), toutes les occurrences sont retirées — il n'existe pas
 * de sélection par position, seulement par lettre.
 */
export function stripLetterOccurrences(word, letter) {
  return Array.from(String(word || ''))
    .filter((c) => (EQUIV[c] || c) !== letter)
    .join('');
}

/** Géométrie absolue (unités SVG) d'une boucle, pour un rayon de base donné. */
export function shapeFor(char, radius) {
  const cfg = BY_CHAR.get(EQUIV[char] || char) || BY_CHAR.get('ق');
  return { a: cfg.a * radius, b: cfg.b * radius, n: cfg.n, tail: cfg.tail, name: cfg.name };
}

/**
 * Demi-largeur de la boucle à la hauteur y (0 = centre). Renvoie 0 hors forme.
 * C'est la fonction qui garantit que le texte reste dans le tracé.
 */
export function halfWidthAt(y, a, b, n) {
  const t = Math.abs(y / b);
  if (t >= 1) return 0;
  return a * Math.pow(1 - Math.pow(t, n), 1 / n);
}

const r2 = (v) => Math.round(v * 100) / 100;

/** Contour fermé de la boucle, centré sur (0,0). */
export function bowlPath(a, b, n, steps = 240) {
  const e = 2 / n;
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = a * Math.sign(c) * Math.pow(Math.abs(c), e);
    const y = b * Math.sign(s) * Math.pow(Math.abs(s), e);
    pts.push(r2(x) + ',' + r2(y));
  }
  return 'M' + pts.join('L') + 'Z';
}

/**
 * Queue de la lettre : court trait qui descend de la boucle, pour qu'elle se
 * lise comme une LETTRE et non comme un ovale posé là. Centré sur (0,0) comme
 * le contour.
 */
export function tailPath(a, b, kind) {
  if (kind === 'none') return null;
  if (kind === 'flat') {
    // Sâd/Dâd/Tâ : le trait file horizontalement vers la gauche.
    return `M${r2(-a * 0.75)},${r2(b * 0.72)}Q${r2(-a * 1.35)},${r2(b * 1.02)} ${r2(-a * 1.6)},${r2(b * 0.62)}`;
  }
  // Mîm/Qâf : la queue plonge sous la ligne.
  return `M${r2(-a * 0.5)},${r2(b * 0.86)}Q${r2(-a * 0.95)},${r2(b * 1.5)} ${r2(-a * 1.25)},${r2(b * 1.15)}`;
}

// ── Calage du texte intérieur ───────────────────────────────────────────────
export const LINE_RATIO = 1.45; // interligne, en multiples de la taille de police
export const INSET_RATIO = 0.06; // marge intérieure, en proportion du rayon

/**
 * Tente de placer tous les mots sur exactement `count` lignes, centrées
 * verticalement. Renvoie les lignes, ou null si tout ne tient pas — c'est
 * fitText qui ajuste alors la taille.
 *
 * Chaque ligne est mesurée à sa hauteur la PLUS CONTRAIGNANTE (le bord de bande
 * le plus éloigné du centre) : sans ça, un mot calé sur la largeur du milieu de
 * la bande dépasserait du contour en haut et en bas de la boucle.
 */
function fitOnLines({ words, a, b, n, fontSize, measure, inset, count }) {
  const lineHeight = fontSize * LINE_RATIO;
  const top = -(count * lineHeight) / 2;
  const lines = [];
  let wi = 0;

  for (let i = 0; i < count; i++) {
    const yTop = top + i * lineHeight;
    const yBot = yTop + lineHeight;
    const yWorst = Math.max(Math.abs(yTop), Math.abs(yBot));
    const avail = 2 * halfWidthAt(yWorst, a, b, n) - 2 * inset;
    if (avail <= 0) return null;

    let line = '';
    while (wi < words.length) {
      const next = line ? line + ' ' + words[wi] : words[wi];
      if (measure(next, fontSize) > avail) break;
      line = next;
      wi += 1;
    }
    // Même seul, le mot ne rentre pas sur cette ligne : cette configuration
    // est perdue, on laissera fitText réduire la police.
    if (!line) return null;

    // Ligne de base placée aux ~3/4 de la bande : l'œil cale le texte sur ce
    // repère, pas sur le milieu géométrique de l'interligne.
    lines.push({ text: line, y: yTop + lineHeight * 0.74 });
  }

  return wi >= words.length ? lines : null;
}

/**
 * Cherche la PLUS GRANDE taille de police à laquelle le texte tient dans la
 * boucle, et le nombre de lignes le plus faible à cette taille — le texte
 * remplit ainsi la forme au lieu de flotter au centre.
 *
 * @param {object} opts
 * @param {string} opts.text texte à écrire dans la boucle
 * @param {number} opts.a demi-largeur de la boucle
 * @param {number} opts.b demi-hauteur de la boucle
 * @param {number} opts.n rondeur de la superellipse
 * @param {(text: string, fontSize: number) => number} opts.measure largeur rendue
 * @param {number} [opts.maxFont] taille de départ (plafond)
 * @param {number} [opts.minFont] taille en deçà de laquelle on renonce
 * @param {number} [opts.step] pas de décroissance
 * @returns {{fontSize: number, lines: {text: string, y: number}[]}|null}
 */
export function fitText({ text, a, b, n, measure, maxFont, minFont = 5, step = 0.5 }) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;

  const inset = INSET_RATIO * Math.min(a, b);
  const ceiling = maxFont || b / 2;

  for (let f = ceiling; f >= minFont; f -= step) {
    const maxLines = Math.floor((2 * b - 2 * inset) / (f * LINE_RATIO));
    for (let count = 1; count <= maxLines; count++) {
      const lines = fitOnLines({ words, a, b, n, fontSize: f, measure, inset, count });
      if (lines) return { fontSize: r2(f), lines };
    }
  }
  return null;
}

// ── Composition de la pièce ─────────────────────────────────────────────────
// Repère de composition, aux proportions d'un A4 paysage (297 × 210).
export const PIECE = {
  W: 1200,
  H_MAX: 850, // borne haute ; la hauteur réelle s'ajuste à la lettre (voir plus bas)
  MARGIN: 46,
  CONNECTOR: 96, // trait reliant le mot à la boucle
  WORD_MAX_W: 340,
  WORD_MAX_FONT: 175,
  WORD_MIN_FONT: 26,
};

// Place occupée par la queue de la lettre AU-DELÀ de la boucle, en proportion
// de la demi-hauteur (vers le bas) et de la demi-largeur (vers la gauche).
// Sans ces réserves, la queue sortait de la page — elle part précisément du
// bord de la boucle, qui est déjà collé à la marge.
const TAIL_DROP = { down: 1.34, flat: 1.1, none: 1.02 };
const TAIL_LEFT = { down: 0.25, flat: 0.6, none: 0 };

/**
 * Calcule toute la mise en page : taille et position de la boucle, du mot, du
 * trait de liaison, et calage du texte intérieur. Aucune dépendance au DOM en
 * dehors de `measure` — d'où sa présence ici plutôt que dans le composant.
 */
export function composePiece({ word, letter, innerText, measure }) {
  const { W, H_MAX, MARGIN, CONNECTOR, WORD_MAX_W, WORD_MAX_FONT, WORD_MIN_FONT } = PIECE;
  const norm = shapeFor(letter, 1);
  const drop = TAIL_DROP[norm.tail] || 1.02;
  const lead = TAIL_LEFT[norm.tail] || 0;

  // Le mot AFFICHÉ exclut la lettre gonflée (voir stripLetterOccurrences) :
  // elle est déjà représentée par la boucle, l'y montrer aussi la répéterait.
  const w = stripLetterOccurrences(word, letter).trim();
  let wordFont = WORD_MAX_FONT;
  if (w) {
    while (wordFont > WORD_MIN_FONT && measure(w, wordFont) > WORD_MAX_W) wordFont -= 2;
  }
  const wordW = w ? measure(w, wordFont) : 0;

  const availW = W - 2 * MARGIN - wordW - (w ? CONNECTOR : 0);
  // La boucle occupe toute la place restante, bornée par la largeur utile
  // (boucle + débord de queue à gauche) et par la hauteur maximale de page.
  const radius = Math.min(
    availW / (norm.a * (2 + lead)),
    (H_MAX - 2 * MARGIN) / (norm.b * (1 + drop))
  );

  const a = norm.a * radius;
  const b = norm.b * radius;

  // Hauteur AJUSTÉE au contenu, pas figée : les six lettres ont des
  // proportions très différentes (le sâd est large et plat, le hâ presque
  // circulaire). Une toile fixe laissait, pour les lettres plates, la moitié
  // de la page vide — et donc une pièce imprimée deux fois trop petite, la
  // feuille étant mise à l'échelle sur sa largeur.
  const contentH = b * (1 + drop);
  const H = 2 * MARGIN + Math.max(contentH, wordFont * 1.15);

  const cx = MARGIN + a * (1 + lead);
  const cy = MARGIN + b + (H - 2 * MARGIN - contentH) / 2;

  const hasInner = !!String(innerText || '').trim();
  // minFont/step abaissés par rapport aux défauts de fitText : la pratique
  // visée (versets ou vœux répétés « des centaines de fois », comme le texte
  // déjà composé en écriture simple/intercalée/rasmique) produit des volumes
  // que le plancher par défaut (5, pas 0.5) ne pouvait pas caser — la pièce
  // se contentait de signaler un débordement. En descendant à 3 (encore
  // imprimable : ~0,7 mm de hauteur de lettre sur la page A4 visée) avec un
  // pas plus fin, on gagne surtout des PALIERS DE LIGNES supplémentaires
  // avant même d'atteindre ce plancher — vérifié : un texte qui débordait à
  // 300 répétitions d'une formule de 5 mots tient désormais jusqu'à 800+,
  // en quelques dizaines de millisecondes (aucun souci de performance).
  const inner = hasInner
    ? fitText({ text: innerText, a, b, n: norm.n, measure, maxFont: radius * 0.1, minFont: 3, step: 0.35 })
    : null;

  const wordLeft = W - MARGIN - wordW;
  const bowlRight = cx + a;

  return {
    W, H,
    a, b, cx, cy, radius,
    n: norm.n,
    bowl: bowlPath(a, b, norm.n),
    tail: tailPath(a, b, norm.tail),
    stroke: Math.max(3, radius * 0.035),
    word: w,
    wordFont,
    // Ancrage au MILIEU de la colonne réservée au mot, volontairement : en
    // RTL, text-anchor "start"/"end" s'inversent (start = bord droit), un
    // piège qui envoyait le mot hors du cadre. "middle" ne dépend pas du sens
    // d'écriture.
    wordX: W - MARGIN - wordW / 2,
    // Ligne de base : l'arabe se cale un peu sous le centre optique.
    wordBaseline: cy + wordFont * 0.32,
    connector: w && wordLeft > bowlRight + 8 ? { x1: bowlRight, x2: wordLeft, y: cy } : null,
    inner,
    // Texte fourni mais impossible à caser, même à la taille minimale.
    overflow: hasInner && !inner,
  };
}

// ── Mesure des largeurs (navigateur) ────────────────────────────────────────
/**
 * Mesureur basé sur un canvas hors écran. Le shaping arabe (lettres liées)
 * est fait par le moteur du navigateur sur la chaîne entière — c'est pour ça
 * qu'on mesure des mots complets et jamais des caractères isolés.
 */
export function makeMeasurer(fontFamily, weight = 700) {
  const ctx = document.createElement('canvas').getContext('2d');
  return (text, fontSize) => {
    ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
    return ctx.measureText(text).width;
  };
}

/** Attend que la police calligraphique soit prête : mesurer avant fausse tout. */
export async function ensureFontReady(spec) {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await document.fonts.load(spec);
    await document.fonts.ready;
  } catch {
    /* police indisponible (hors-ligne) — repli navigateur, mesures approchées */
  }
}

// ── Impression (PDF) ────────────────────────────────────────────────────────
// On réutilise la racine et les styles d'impression du module texte
// (lib/alqalam.js) : deux mécanismes concurrents se neutraliseraient, la règle
// `body > *:not(#racine)` de l'un masquant la racine de l'autre. On n'ajoute
// ici qu'une SURCHARGE @page en paysage — la pièce est large — retirée après
// impression pour que l'export texte retrouve son A4 portrait.
const ORNE_PAGE_STYLE_ID = 'alqalam-orne-page-style';

/** Ouvre l'impression navigateur sur la pièce (« Enregistrer en PDF »). */
export async function printPiece(svgEl, docName) {
  if (!svgEl) throw new Error('Aucune pièce à imprimer.');

  const { PDF_PRINT_ROOT_ID, ensurePrintStylesInjected } = await import('./alqalam');
  ensurePrintStylesInjected();

  // Injectée APRÈS celle du module texte : à descripteurs @page équivalents,
  // la dernière règle l'emporte.
  let pageStyle = document.getElementById(ORNE_PAGE_STYLE_ID);
  if (!pageStyle) {
    pageStyle = document.createElement('style');
    pageStyle.id = ORNE_PAGE_STYLE_ID;
    document.head.appendChild(pageStyle);
  }
  pageStyle.textContent = `
    @media print {
      @page { size: A4 landscape; margin: 10mm; }
      #${PDF_PRINT_ROOT_ID} { display: flex !important; align-items: center; justify-content: center; height: 100%; }
      #${PDF_PRINT_ROOT_ID} svg { width: 100%; height: auto; max-height: 100%; }
    }
  `;

  let root = document.getElementById(PDF_PRINT_ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = PDF_PRINT_ROOT_ID;
    document.body.appendChild(root);
  }
  const clone = svgEl.cloneNode(true);
  clone.removeAttribute('style');
  root.replaceChildren(clone);

  const previousTitle = document.title;
  if (docName) document.title = docName; // nom suggéré par « Enregistrer en PDF »

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    root.remove();
    pageStyle.remove();
    document.title = previousTitle;
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  // Repli : certains navigateurs mobiles n'émettent pas 'afterprint'.
  setTimeout(cleanup, 5 * 60 * 1000);

  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}
