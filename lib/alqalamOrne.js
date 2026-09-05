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

// Liant sans chasse (Zero Width Joiner) : placé au point de coupe, il fait
// percevoir aux deux lettres voisines la présence d'une lettre qui joint des
// deux côtés — exactement ce que fera visuellement la boucle — au lieu de
// les laisser retomber sur leur forme isolée/finale par défaut. Repose sur
// une propriété standard du moteur de rendu de texte arabe (Joining_Type=C,
// « Join_Causing » — même mécanisme que la police l'applique déjà pour lier
// les lettres normalement) : aucune bidouille propre à cette police.
// Exemple concret (celui signalé) : dans « بسم » avec م gonflé, retirer
// juste le م donne « بس » — le س, dernier caractère, prend sa forme ISOLÉE
// (la queue recourbée de fin de mot), alors qu'il doit rester visuellement
// « en train de se lier » à la boucle qui le suit. Le ZWJ lui redonne sa
// forme MÉDIANE, identique à celle qu'il a réellement dans « بسم ».
const JOIN = '‍';

/** Lettres rondes réellement présentes dans le mot, dans l'ordre du tableau. */
export function detectRoundLetters(word) {
  const chars = new Set(
    Array.from(String(word || '')).map((c) => EQUIV[c] || c)
  );
  return ROUND_LETTERS.filter((l) => chars.has(l.char));
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

// Place occupée par la queue de la lettre AU-DELÀ de la boucle, en proportion
// de la demi-hauteur (vers le bas) et de la demi-largeur (vers la gauche).
// Sans ces réserves, la queue sortait de la page — elle part précisément du
// bord de la boucle, qui est déjà collé à la marge. Partagé par toutes les
// boucles de composePhrasePiece (chacune garde les proportions de SA lettre).
const TAIL_DROP = { down: 1.34, flat: 1.1, none: 1.02 };
const TAIL_LEFT = { down: 0.25, flat: 0.6, none: 0 };

// ── Phrase à plusieurs boucles ──────────────────────────────────────────────
// La pratique visée : dans une phrase entière (ex. « بسم الله الرحمن
// الرحيم »), CHAQUE occurrence d'une ou plusieurs lettres choisies devient sa
// propre boucle — 4 boucles pour la basmala avec م et ه gonflés
// (بس-م, الل-ه, الرح-م-ن, ...-حي-م), le même vœu répété dans chacune.

/**
 * Découpe la phrase en une suite alternée de segments de texte et de
 * marqueurs de boucle, dans l'ordre de lecture (l'ordre naturel de la chaîne
 * JS EST l'ordre de lecture arabe — seul l'AFFICHAGE est inversé par
 * `direction:rtl`, jamais l'ordre des caractères en mémoire). Chaque segment
 * de texte collé à une boucle reçoit un liant sans chasse (voir JOIN)
 * pour que sa lettre de bord garde sa forme liée plutôt que de retomber sur
 * sa forme isolée/finale.
 * @param {string} phrase
 * @param {string[]} letters lettres à gonfler (formes canoniques, ex. 'ه' pas 'ة')
 * @returns {Array<{type:'text', value:string}|{type:'loop', letter:string}>}
 */
export function tokenizePhrase(phrase, letters) {
  const set = new Set(letters);
  /** @type {Array<{type:'text', value:string}|{type:'loop', letter:string}>} */
  const tokens = [];
  let buf = '';
  for (const ch of Array.from(String(phrase || ''))) {
    const norm = EQUIV[ch] || ch;
    if (set.has(norm)) {
      if (buf) tokens.push({ type: 'text', value: buf });
      buf = '';
      tokens.push({ type: 'loop', letter: norm });
    } else {
      buf += ch;
    }
  }
  if (buf) tokens.push({ type: 'text', value: buf });

  // Un segment de texte collé à une boucle doit percevoir cette boucle comme
  // une lettre qui joint, sous peine de voir sa lettre de bord retomber sur
  // sa forme isolée/finale (ex. le س de « بس », premier segment de « بسم
  // الله… » avec م gonflé) — voir le commentaire de JOIN plus haut.
  for (let i = 0; i < tokens.length; i += 1) {
    // `tok` local plutôt que relire tokens[i] : TypeScript ne rétrécit pas le
    // type d'un accès indexé répété, seulement celui d'une variable locale.
    const tok = tokens[i];
    if (tok.type !== 'text') continue;
    let value = tok.value;
    if (i > 0 && tokens[i - 1].type === 'loop') value = JOIN + value;
    if (i < tokens.length - 1 && tokens[i + 1].type === 'loop') value = value + JOIN;
    tokens[i] = { ...tok, value };
  }

  return tokens;
}

// Réglages propres à la composition en phrase — distincts de PIECE (boucle
// unique) : ici les boucles sont modestes et RÉPÉTÉES en ligne, pas une seule
// géante, donc les proportions ne se déduisent pas des mêmes constantes.
export const PHRASE_PIECE = {
  W: 1200,
  H_MAX: 850,
  MARGIN: 46,
  GAP_RATIO: 0.16, // court trait entre deux éléments consécutifs, en proportion du rayon
  TEXT_FONT_RATIO: 0.55, // taille du texte courant, en proportion du rayon des boucles
  TEXT_FONT_MIN: 14,
  TEXT_FONT_MAX: 190,
  RADIUS_START_RATIO: 0.5, // point de départ de la recherche, en proportion de la demi-page utile
  RADIUS_FLOOR: 14, // en dessous, une boucle ne peut plus rien contenir d'utile
  RADIUS_STEP: 0.97, // décroissance multiplicative à chaque essai
};

/**
 * Range les jetons (texte/boucle) en lignes, en partant du bord DROIT de
 * chaque ligne (lecture arabe) et en repassant à la ligne quand un jeton ne
 * tient plus dans la largeur restante. Renvoie null si un seul jeton, à lui
 * seul, dépasse la largeur utile — ce rayon est alors impraticable.
 */
function layoutRows({ tokens, radius, textFont, measure, maxWidth, gap }) {
  const widthOf = (tok) => {
    if (tok.type === 'text') return measure(tok.value, textFont);
    const norm = shapeFor(tok.letter, 1);
    const lead = TAIL_LEFT[norm.tail] || 0;
    return radius * norm.a * (2 + lead);
  };

  const rows = [];
  let row = [];
  let used = 0;

  for (const tok of tokens) {
    const w = widthOf(tok);
    if (w > maxWidth) return null; // ce jeton seul ne rentre nulle part à ce rayon
    const addW = row.length ? gap + w : w;
    if (row.length && used + addW > maxWidth) {
      rows.push(row);
      row = [];
      used = 0;
    }
    row.push({ ...tok, w });
    used += row.length > 1 ? gap + w : w;
  }
  if (row.length) rows.push(row);
  return rows;
}

/**
 * Calcule toute la mise en page d'une phrase à plusieurs boucles : recherche
 * le plus grand rayon commun à toutes les boucles pour lequel (a) la phrase
 * entière tient dans la page, PUIS vérifie (b) que le vœu tient dans chaque
 * boucle à ce rayon. Les deux tirent en sens contraire — un rayon plus grand
 * aide (b) mais dégrade (a), puisque moins de jetons tiennent par ligne — la
 * recherche part donc du plus grand rayon possible et ne descend que pour
 * satisfaire (a) ; si (b) échoue malgré tout au meilleur rayon trouvé pour
 * (a), aucun rayon plus petit ne ferait mieux : c'est un vrai débordement.
 */
export function composePhrasePiece({ phrase, letters, innerText, measure }) {
  const { W, H_MAX, MARGIN, GAP_RATIO, TEXT_FONT_RATIO, TEXT_FONT_MIN, TEXT_FONT_MAX, RADIUS_START_RATIO, RADIUS_FLOOR, RADIUS_STEP } = PHRASE_PIECE;
  const maxWidth = W - 2 * MARGIN;
  const maxHeight = H_MAX - 2 * MARGIN;

  const tokens = tokenizePhrase(phrase, letters);
  const usedLetters = letters.filter((l) => tokens.some((t) => t.type === 'loop' && t.letter === l));

  // Hauteur de ligne UNIFORME (mêmes proportions pour toutes les boucles,
  // quel que soit leur rayon commun) : le pire des cas parmi les lettres
  // effectivement présentes, haut et bas calculés séparément — le haut d'une
  // boucle ne dépend jamais de la queue, seul le bas en dépend.
  const shapes = usedLetters.length ? usedLetters.map((l) => shapeFor(l, 1)) : [shapeFor('ه', 1)];
  const topRatio = Math.max(...shapes.map((s) => s.b));
  const bottomRatio = Math.max(...shapes.map((s) => s.b * (TAIL_DROP[s.tail] || 1.02)));

  let radius = (Math.min(maxWidth, maxHeight) / 2) * RADIUS_START_RATIO;
  let rows = null;
  let textFont = 0;

  for (; radius >= RADIUS_FLOOR; radius *= RADIUS_STEP) {
    textFont = Math.min(TEXT_FONT_MAX, Math.max(TEXT_FONT_MIN, radius * TEXT_FONT_RATIO));
    const gap = radius * GAP_RATIO;
    const candidate = layoutRows({ tokens, radius, textFont, measure, maxWidth, gap });
    if (!candidate) continue;
    const rowHeight = radius * (topRatio + bottomRatio);
    const rowGap = rowHeight * 0.15;
    const totalHeight = candidate.length * rowHeight + (candidate.length - 1) * rowGap;
    if (totalHeight <= maxHeight) {
      rows = candidate;
      break;
    }
  }

  if (!rows) {
    // Même forme que le retour normal ci-dessous (`items`, pas `rows`) : un
    // appelant qui lit toujours `p.items` ne doit jamais tomber sur
    // `undefined` selon que la composition a réussi ou pas.
    return { W, H: H_MAX, radius: 0, items: [], connectors: [], loops: 0, overflow: true };
  }

  const rowHeight = radius * (topRatio + bottomRatio);
  const rowGap = rowHeight * 0.15;
  const contentH = rows.length * rowHeight + (rows.length - 1) * rowGap;
  const H = Math.min(H_MAX, 2 * MARGIN + contentH);
  const startY = MARGIN + (H - 2 * MARGIN - contentH) / 2;

  const hasInner = !!String(innerText || '').trim();
  const items = [];
  const connectors = [];
  let anyOverflow = false;

  rows.forEach((row, ri) => {
    const rowTop = startY + ri * (rowHeight + rowGap);
    const cy = rowTop + radius * topRatio;
    // itemRight avance de DROITE à GAUCHE (lecture arabe) ; prevLeft retient
    // le bord gauche RÉEL du jeton précédent pour tracer le connecteur dans
    // le bon intervalle — dériver ce bord d'un curseur déjà décalé du gap
    // (comme un essai précédent le faisait) place le trait un cran trop loin,
    // À L'INTÉRIEUR du jeton suivant plutôt que dans l'espace qui les sépare.
    let itemRight = W - MARGIN;
    let prevLeft = null;

    row.forEach((tok) => {
      const itemLeft = itemRight - tok.w;
      if (prevLeft !== null) {
        connectors.push({ x1: itemRight, x2: prevLeft, y: cy });
      }

      if (tok.type === 'text') {
        items.push({
          type: 'text',
          value: tok.value,
          x: itemRight - tok.w / 2,
          y: cy + textFont * 0.32,
          fontSize: textFont,
        });
      } else {
        const norm = shapeFor(tok.letter, radius);
        const cx = itemRight - norm.a;
        const inner = hasInner
          ? fitText({ text: innerText, a: norm.a, b: norm.b, n: norm.n, measure, maxFont: radius * 0.32, minFont: 3, step: 0.35 })
          : null;
        if (hasInner && !inner) anyOverflow = true;
        items.push({
          type: 'loop',
          cx,
          cy,
          bowl: bowlPath(norm.a, norm.b, norm.n),
          tail: tailPath(norm.a, norm.b, norm.tail),
          stroke: Math.max(2, radius * 0.045),
          inner,
        });
      }

      prevLeft = itemLeft;
      itemRight = itemLeft - radius * GAP_RATIO;
    });
  });

  return { W, H, radius, items, connectors, loops: usedLetters.length ? tokens.filter((t) => t.type === 'loop').length : 0, overflow: anyOverflow };
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
