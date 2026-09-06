'use client';
// Module « Al-Qalam » — ÉCRITURE ORNÉE : lettres à boucle gonflée.
//
// Pratique visée : on étire démesurément la boucle (« l'œil ») d'une lettre
// ronde — م ه ص ض ط ظ — et on écrit à l'intérieur une invocation ou un
// verset en micro-écriture.
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
  // Mîm : petite panse presque circulaire — un ROND PLEIN (bowlPath fermé).
  { char: 'م', name: 'Mîm', a: 1.0, b: 0.95, n: 2.6 },
  // Hâ : boucle haute, presque aussi haute que large — ROND PLEIN.
  { char: 'ه', name: 'Hâ', a: 0.95, b: 1.0, n: 2.4 },
  // Sâd / Dâd / Tâ / Zâ : œil long et couché — demandé explicitement comme
  // un ARC DE CERCLE BIEN FERMÉ (bowlPath en dôme, voir ARC_SPAN) : courbe
  // en haut, trait droit en bas, PAS un rond plein comme م/ه.
  { char: 'ص', name: 'Sâd', a: 1.3, b: 0.72, n: 3.2, arc: true },
  { char: 'ض', name: 'Dâd', a: 1.3, b: 0.72, n: 3.2, arc: true },
  // Tâ : œil couché, un peu plus haut que le sâd (hampe verticale à part).
  { char: 'ط', name: 'Tâ', a: 1.2, b: 0.78, n: 3.0, arc: true },
  // Zâ : même panse que le tâ (elle n'en diffère que par son point).
  { char: 'ظ', name: 'Zâ', a: 1.2, b: 0.78, n: 3.0, arc: true },
  // ق (qâf, pourtant la lettre de l'exemple fondateur, رزقك) a été retiré à
  // la demande : sa panse ne se prête pas au rond plein qu'offrent م/ه. ف
  // et و n'ont jamais fait partie de cette liste.
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

// Lettres qui N'OFFRENT JAMAIS de liaison vers l'AVANT (Joining_Type = R
// dans l'Unicode Bidi/Arabic Shaping Algorithm) : elles reçoivent bien un
// trait entrant de la lettre qui les précède (forme FINALE), mais n'en
// tracent aucun vers celle qui les suit — dans une vraie main, rien ne
// relie jamais ce qui vient après l'une d'elles, qui redémarre une forme
// neuve (isolée ou initiale). On y ajoute ة (tâ marbûta) : elle ne clôt
// qu'une fin de mot, jamais suivie d'une autre lettre du même mot — même
// portée qu'elle rejoint le groupe des « ronds » via EQUIV pour le DESSIN,
// sa liaison réelle reste celle d'une lettre qui ne joint pas vers l'avant.
const NON_FORWARD_JOINING = new Set(['ا', 'أ', 'إ', 'آ', 'ٱ', 'د', 'ذ', 'ر', 'ز', 'و', 'ؤ', 'ة']);

// Bloc Unicode des lettres arabes de base (couvre aussi ة, ؤ, ئ…) — sert à
// écarter tout ce qui N'EST PAS une lettre (espace, chiffre, ponctuation,
// le liant ZWJ lui-même) des candidats à une liaison vers l'avant : rien de
// tout ça ne joint jamais, quoi qu'il arrive (Joining_Type = U dans
// l'algorithme, « Non_Joining »). Sans ce filtre, un segment de texte
// finissant par un ESPACE avant une boucle (très courant : c'est la forme
// normale d'un mot qui commence par la lettre gonflée, ex. « يا » + boucle
// (ه) de « هادي ») laissait passer un tatweel à travers l'espace — un trait
// qui n'existe dans aucune main réelle.
const ARABIC_LETTER = /[ء-ي]/;

/** Ce caractère offre-t-il une liaison vers ce qui le suit ? */
function charJoinsForward(ch) {
  return !!ch && ARABIC_LETTER.test(ch) && !NON_FORWARD_JOINING.has(ch);
}

/**
 * Ce jeton commence-t-il par un vrai espace — donc un mot NEUF, séparé de
 * ce qui précède ? `‍?` avale un liant ZWJ déjà posé (voir JOIN) sans le
 * laisser masquer l'espace réel juste derrière lui.
 */
function tokenStartsWithSpace(tok) {
  return tok.type === 'text' && /^‍?\s/.test(tok.value);
}

/** Lettres rondes réellement présentes dans le mot, dans l'ordre du tableau. */
export function detectRoundLetters(word) {
  const chars = new Set(
    Array.from(String(word || '')).map((c) => EQUIV[c] || c)
  );
  return ROUND_LETTERS.filter((l) => chars.has(l.char));
}

/** Géométrie absolue (unités SVG) d'une boucle, pour un rayon de base donné. */
export function shapeFor(char, radius) {
  const cfg = BY_CHAR.get(EQUIV[char] || char) || BY_CHAR.get('ه');
  return { a: cfg.a * radius, b: cfg.b * radius, n: cfg.n, name: cfg.name, arc: !!cfg.arc };
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

// Portion de superellipse effectivement tracée pour une lettre « arc »
// (ص ض ط ظ, voir ROUND_LETTERS) : un DÔME BIEN FERMÉ — courbe en haut,
// refermé par un trait DROIT en bas — jamais un rond plein comme م/ه, ni un
// croissant resté ouvert. π (demi-tour) donne exactement ce dôme : la moitié
// SUPÉRIEURE de la superellipse, complétée par le trait droit que 'Z' trace
// tout seul entre le point d'arrivée et celui de départ (tous deux à y=0,
// de part et d'autre du centre).
export const ARC_SPAN = Math.PI;

/**
 * Contour de la boucle, centré sur (0,0). Rond plein par défaut (arcSpan =
 * 2π, tour complet) ; avec `arcSpan` < 2π (voir ARC_SPAN), seule la portion
 * SUPÉRIEURE de la forme est courbe — le reste du tour, toujours fermé par
 * `Z`, devient un simple trait droit (un dôme, pas un rond, pour ص ض ط ظ).
 */
export function bowlPath(a, b, n, steps = 240, arcSpan = Math.PI * 2) {
  const e = 2 / n;
  const full = arcSpan >= Math.PI * 2 - 1e-9;
  // t=π (cos=-1, x=-a, y=0) est le point de départ d'un dôme : la moitié
  // SUPÉRIEURE de la forme (vers t=3π/2, le haut) jusqu'à t=2π (x=+a, y=0) —
  // Z referme alors par un trait droit entre ces deux points, à y=0.
  const start = full ? 0 : Math.PI;
  const count = full ? steps : Math.max(8, Math.round(steps * (arcSpan / (Math.PI * 2))));
  const pts = [];
  for (let i = 0; i <= count; i++) {
    if (full && i === count) break; // comportement historique : pas de point dupliqué, 'Z' referme le tour
    const t = start + (i / (full ? steps : count)) * (full ? Math.PI * 2 : arcSpan);
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = a * Math.sign(c) * Math.pow(Math.abs(c), e);
    const y = b * Math.sign(s) * Math.pow(Math.abs(s), e);
    pts.push(r2(x) + ',' + r2(y));
  }
  return 'M' + pts.join('L') + 'Z';
}

// Il y avait ici une fonction `tailPath` : un court trait descendant sous la
// boucle, pour la faire lire comme une LETTRE plutôt qu'un ovale posé là.
// Retirée à la demande : « seulement des ronds, pas les traits qui tirent
// vers le bas » — la boucle (bowlPath) est maintenant le contour complet de
// chaque lettre gonflée, sans appendice.

// ── Calage du texte intérieur ───────────────────────────────────────────────
export const LINE_RATIO = 1.45; // interligne, en multiples de la taille de police
export const INSET_RATIO = 0.06; // marge intérieure, en proportion du rayon

/**
 * Tente de placer tous les mots sur exactement `count` lignes, centrées
 * verticalement DANS [yMin, yMax] (par défaut [-b, b], le rond plein
 * habituel — un dôme, voir ARC_SPAN, passe [-b, 0] : lui seul est dessiné,
 * inutile de tenter d'y caser du texte sous y=0 où il n'y a plus de forme).
 * Renvoie les lignes, ou null si tout ne tient pas — c'est fitText qui
 * ajuste alors la taille.
 *
 * Chaque ligne est mesurée à sa hauteur la PLUS CONTRAIGNANTE (le bord de bande
 * le plus éloigné du centre) : sans ça, un mot calé sur la largeur du milieu de
 * la bande dépasserait du contour en haut et en bas de la boucle.
 */
function fitOnLines({ words, a, b, n, fontSize, measure, inset, count, yMin, yMax }) {
  const lineHeight = fontSize * LINE_RATIO;
  const top = yMin + ((yMax - yMin) - count * lineHeight) / 2;
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
 * @param {number} [opts.yMin] borne haute réelle de la forme (défaut -b — un
 *   rond plein est symétrique ; un dôme, voir ARC_SPAN, passe -b)
 * @param {number} [opts.yMax] borne basse réelle de la forme (défaut +b ;
 *   un dôme passe 0 — rien n'est dessiné au-delà)
 * @returns {{fontSize: number, lines: {text: string, y: number}[]}|null}
 */
export function fitText({ text, a, b, n, measure, maxFont, minFont = 5, step = 0.5, yMin = -b, yMax = b }) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;

  const span = yMax - yMin;
  const inset = INSET_RATIO * Math.min(a, b);
  const ceiling = maxFont || span / 4;

  for (let f = ceiling; f >= minFont; f -= step) {
    const maxLines = Math.floor((span - 2 * inset) / (f * LINE_RATIO));
    for (let count = 1; count <= maxLines; count++) {
      const lines = fitOnLines({ words, a, b, n, fontSize: f, measure, inset, count, yMin, yMax });
      if (lines) return { fontSize: r2(f), lines };
    }
  }
  return null;
}

// ── Phrase à plusieurs boucles ──────────────────────────────────────────────
// La pratique visée : dans une phrase entière (ex. « بسم الله الرحمن
// الرحيم »), CHAQUE occurrence d'une ou plusieurs lettres choisies devient sa
// propre boucle — 4 boucles pour la basmala avec م et ه gonflés
// (بس-م, الل-ه, الرح-م-ن, ...-حي-م), le même vœu répété dans chacune.

/**
 * Découpe la phrase en une suite de segments de texte et de marqueurs de
 * boucle, dans l'ordre de lecture (l'ordre naturel de la chaîne JS EST
 * l'ordre de lecture arabe — seul l'AFFICHAGE est inversé par
 * `direction:rtl`, jamais l'ordre des caractères en mémoire). Chaque segment
 * de texte collé à une boucle reçoit un liant sans chasse (voir JOIN)
 * pour que sa lettre de bord garde sa forme liée plutôt que de retomber sur
 * sa forme isolée/finale.
 *
 * Un segment de texte qui couvre plusieurs mots entiers (aucune lettre
 * choisie n'y apparaît, ex. un long passage non gonflé) est éclaté ici en
 * autant de MORCEAUX PAR MOT (coupure juste avant chaque espace, qui reste
 * collé au morceau suivant) — c'est ce qui permet à layoutRows de renvoyer
 * un tel passage à la ligne mot par mot plutôt qu'en bloc, ou pire lettre
 * par lettre (voir composePhrasePages/groupWords, qui s'appuient là-dessus
 * pour ne JAMAIS couper un mot en deux entre deux lignes).
 *
 * Chaque jeton porte aussi `joinsForward` : est-ce que son DERNIER
 * caractère réel (le plus proche du jeton suivant, en ordre de lecture)
 * offre une liaison vers l'avant ? Faux pour un segment de texte terminé
 * par une lettre à liaison unilatérale (ا د ذ ر ز و…, voir
 * NON_FORWARD_JOINING), par un espace, ou pour une boucle issue d'un ة —
 * c'est ce champ qui permet à composePhrasePages de NE PAS tracer de
 * tatweel là où aucune liaison réelle n'existe.
 * @param {string} phrase
 * @param {string[]} letters lettres à gonfler (formes canoniques, ex. 'ه' pas 'ة')
 * @returns {Array<{type:'text', value:string, joinsForward:boolean}|{type:'loop', letter:string, joinsForward:boolean}>}
 */
export function tokenizePhrase(phrase, letters) {
  const set = new Set(letters);
  /** @type {Array<{type:'text', value:string}|{type:'loop', letter:string, joinsForward:boolean}>} */
  const coarse = [];
  let buf = '';
  for (const ch of Array.from(String(phrase || ''))) {
    const norm = EQUIV[ch] || ch;
    if (set.has(norm)) {
      if (buf) coarse.push({ type: 'text', value: buf });
      buf = '';
      coarse.push({ type: 'loop', letter: norm, joinsForward: charJoinsForward(ch) });
    } else {
      buf += ch;
    }
  }
  if (buf) coarse.push({ type: 'text', value: buf });

  // Éclatement par mot — sur le texte BRUT, avant tout liant : un ZWJ déjà
  // posé serait un caractère « non-espace » comme un autre pour la coupure
  // ci-dessous, et se retrouverait à tort séparé du mot qu'il précède.
  /** @type {Array<{type:'text', value:string, joinsForward:boolean}|{type:'loop', letter:string, joinsForward:boolean}>} */
  const tokens = [];
  for (const tok of coarse) {
    if (tok.type !== 'text') {
      tokens.push(tok);
      continue;
    }
    const pieces = tok.value.split(/(?<=\S)(?=\s)/).filter(Boolean);
    for (const piece of pieces) {
      tokens.push({ type: 'text', value: piece, joinsForward: charJoinsForward(Array.from(piece).pop()) });
    }
  }

  // Un segment de texte collé à une boucle doit percevoir cette boucle comme
  // une lettre qui joint, sous peine de voir sa lettre de bord retomber sur
  // sa forme isolée/finale (ex. le س de « بس », premier segment de « بسم
  // الله… » avec م gonflé) — voir le commentaire de JOIN plus haut. Mais
  // JAMAIS si le voisin ne joint justement pas vers l'avant, NI si un vrai
  // espace sépare les deux (ex. « الله » + boucle(ه) suivie du mot SUIVANT,
  // séparé par un espace — la boucle elle-même joint bien vers l'avant,
  // mais rien ne doit relier deux mots distincts). Signalé : « الله » se
  // présentait avec un tatweel après son ه final, comme s'il continuait
  // dans le mot suivant. Un morceau de mot intermédiaire (ni premier ni
  // dernier de son segment d'origine) ne touche jamais directement une
  // boucle : aucune des deux conditions ci-dessous ne s'y applique jamais.
  for (let i = 0; i < tokens.length; i += 1) {
    // `tok` local plutôt que relire tokens[i] : TypeScript ne rétrécit pas le
    // type d'un accès indexé répété, seulement celui d'une variable locale.
    const tok = tokens[i];
    if (tok.type !== 'text') continue;
    let value = tok.value;
    const prev = i > 0 ? tokens[i - 1] : null;
    const next = i < tokens.length - 1 ? tokens[i + 1] : null;
    if (prev && prev.type === 'loop' && prev.joinsForward && !tokenStartsWithSpace(tok)) value = JOIN + value;
    if (next && next.type === 'loop' && tok.joinsForward) value = value + JOIN;
    tokens[i] = { ...tok, value };
  }

  return tokens;
}

/**
 * Un jeton démarre-t-il un mot NEUF — donc un point où repasser à la ligne
 * ne coûte rien ? Vrai pour le tout premier jeton, pour un texte qui
 * commence par un espace (le sien, ou celui laissé par l'éclatement par mot
 * ci-dessus), ou juste après un texte qui SE TERMINE par un espace (ex.
 * juste avant une boucle qui commence un mot neuf, comme le ه de « هادي »
 * dans « يا هادي »). Faux sinon : ce jeton est collé au précédent (même
 * mot), les séparer le couperait en deux.
 */
function startsNewWord(tokens, i) {
  if (i === 0) return true;
  const cur = tokens[i];
  const prev = tokens[i - 1];
  if (tokenStartsWithSpace(cur)) return true;
  if (prev.type === 'text' && /\s$/.test(prev.value)) return true;
  return false;
}

/**
 * Regroupe les jetons (tokenizePhrase) en MOTS indivisibles pour le passage
 * à la ligne — une boucle et le morceau de texte qui la touche sans espace
 * (ex. « ال » + boucle(ق) + « يوم » pour « القيوم ») forment UN SEUL groupe :
 * layoutRows ne les sépare jamais entre deux lignes, sous peine de couper le
 * mot en deux (signalé : « قيوم » rendu « قيو » puis « م » sur la ligne
 * suivante, ce qui lui fait perdre son sens).
 */
function groupWords(tokens) {
  const groups = [];
  let cur = [];
  tokens.forEach((tok, i) => {
    if (cur.length && startsNewWord(tokens, i)) {
      groups.push(cur);
      cur = [];
    }
    cur.push(tok);
  });
  if (cur.length) groups.push(cur);
  return groups;
}

// Réglages propres à la composition en phrase — distincts de PIECE (boucle
// unique) : ici les boucles sont modestes et RÉPÉTÉES en ligne, pas une seule
// géante, donc les proportions ne se déduisent pas des mêmes constantes.
export const PHRASE_PIECE = {
  // Format A4 PAYSAGE exact (297 × 210 mm, ratio 297/210) — chaque page a
  // TOUJOURS cette taille pleine (voir composePhrasePages : H n'est plus
  // rétréci au contenu d'une page moins remplie, ex. la dernière).
  W: 1200,
  H_MAX: Math.round(1200 * (210 / 297)),
  MARGIN: 46,
  GAP_RATIO: 0.16, // court trait entre deux éléments consécutifs, en proportion du rayon
  TEXT_FONT_RATIO: 0.55, // taille du texte courant, en proportion du rayon des boucles
  TEXT_FONT_MIN: 14,
  TEXT_FONT_MAX: 190,
  // Densité CIBLE d'une page pleine, INDÉPENDANTE du nombre total de jetons —
  // c'est la pagination (composePhrasePages) qui absorbe un texte plus long,
  // pas le rayon des boucles. Sans cette cible fixe, une phrase répétée « des
  // centaines de fois » forçait un rayon minuscule pour tout faire tenir sur
  // UNE seule page (boucles illisibles) — signalé après coup.
  ROWS_PER_PAGE_TARGET: 4,
  RADIUS_FLOOR: 14, // en dessous, une boucle ne peut plus rien contenir d'utile
  RADIUS_STEP: 0.97, // décroissance multiplicative à chaque essai (seulement si le rayon cible ne convient pas)
  // Borne haute de raison : au-delà, une pièce à imprimer ressemble moins à
  // un ouvrage calligraphié qu'à un tirage industriel — signalé comme un
  // débordement, avec un message distinct de « le vœu est trop long ».
  MAX_PAGES: 40,
};

/**
 * Range les jetons (texte/boucle) en lignes, en partant du bord DROIT de
 * chaque ligne (lecture arabe) et en repassant à la ligne quand le MOT
 * suivant (voir groupWords — une boucle et le texte qui la touche sans
 * espace comptent comme UN SEUL mot) ne tient plus dans la largeur restante.
 * Un mot ne se scinde JAMAIS entre deux lignes. Renvoie null si un mot, à
 * lui seul, dépasse la largeur utile — ce rayon est alors impraticable.
 */
function layoutRows({ tokens, radius, textFont, measure, maxWidth, gap }) {
  const widthOf = (tok) => {
    if (tok.type === 'text') return measure(tok.value, textFont);
    const norm = shapeFor(tok.letter, 1);
    return radius * norm.a * 2; // plus de queue à réserver : la boucle EST le contour complet
  };

  const rows = [];
  let row = [];
  let used = 0;

  for (const group of groupWords(tokens)) {
    const withW = group.map((tok) => ({ ...tok, w: widthOf(tok) }));
    const groupW = withW.reduce((sum, t) => sum + t.w, 0) + (withW.length - 1) * gap;
    if (groupW > maxWidth) return null; // ce mot (boucle comprise) ne rentre nulle part à ce rayon

    const addW = row.length ? gap + groupW : groupW;
    if (row.length && used + addW > maxWidth) {
      rows.push(row);
      row = [];
      used = 0;
    }
    row.push(...withW);
    // Recalculé en entier plutôt qu'accumulé : plus sûr qu'un `used +=`
    // distinct pour le premier mot d'une ligne vs les suivants.
    used = row.reduce((sum, t) => sum + t.w, 0) + (row.length - 1) * gap;
  }
  if (row.length) rows.push(row);
  return rows;
}

/**
 * Répartit des lignes déjà calculées (voir layoutRows) sur autant de PAGES
 * que nécessaire, chacune tenant dans maxHeight. Pure arithmétique, sans
 * connaissance du contenu des lignes — c'est pour ça qu'elle est testable
 * séparément du reste de composePhrasePages.
 * @returns {number[][]} un tableau de pages, chaque page étant un tableau
 *   d'INDICES dans `rows`.
 */
export function paginateRows(rowCount, rowHeight, rowGap, maxHeight) {
  if (rowCount <= 0) return [];
  // Combien de lignes tiennent sur une page pleine : n*rowHeight +
  // (n-1)*rowGap ≤ maxHeight, résolu pour n (au moins 1 — une ligne qui, à
  // elle seule, dépasse maxHeight occupe quand même sa propre page plutôt
  // que de disparaître).
  const perPage = Math.max(1, Math.floor((maxHeight + rowGap) / (rowHeight + rowGap)));
  const pages = [];
  for (let i = 0; i < rowCount; i += perPage) {
    const page = [];
    for (let j = i; j < Math.min(i + perPage, rowCount); j += 1) page.push(j);
    pages.push(page);
  }
  return pages;
}

/**
 * Fusionne les morceaux de texte ADJACENTS d'une même ligne — issus de
 * l'éclatement par mot de tokenizePhrase (voir groupWords) — en un seul
 * élément de rendu. Sans ça, deux mots simplement voisins (aucune boucle
 * entre eux, ex. un long passage non gonflé qui a dû être renvoyé à la
 * ligne mot par mot) afficheraient un espacement et une épaisseur de
 * tatweel artificiels entre eux, alors qu'ils doivent s'écouler comme un
 * texte normal. Deux jetons `text` ne sont JAMAIS adjacents dans une ligne
 * sauf s'ils viennent du même segment d'origine (tokenizePhrase alterne
 * toujours texte/boucle avant l'éclatement par mot) : fusionner est donc
 * toujours exact, jamais une approximation.
 */
function mergeAdjacentText(row, measure, textFont) {
  const merged = [];
  for (const tok of row) {
    const last = merged[merged.length - 1];
    if (tok.type === 'text' && last && last.type === 'text') {
      const value = last.value + tok.value;
      merged[merged.length - 1] = { type: 'text', value, joinsForward: tok.joinsForward, w: measure(value, textFont) };
    } else {
      merged.push(tok);
    }
  }
  return merged;
}

/**
 * Plus petit rayon (parmi les FORMES effectivement utilisées, la pire
 * gagne) auquel le vœu tient dans une boucle, même en micro-écriture.
 * Cherché par doublement puis dichotomie plutôt que par pas fixe : un vœu
 * très long peut demander un rayon bien plus grand que la cible de densité,
 * et un pas fixe serait soit trop lent, soit trop grossier. Renvoie 0 sans
 * vœu (rien à caser).
 *
 * Utilisé pour AGRANDIR les boucles quand le vœu l'exige — demandé
 * explicitement : « au lieu de rétrécir le texte, augmenter les rondeurs »
 * plutôt que de réduire le texte (déjà réduit au minimum lisible par
 * fitText) ou de signaler un débordement.
 */
function minRadiusForVow(shapes, innerText, measure) {
  const text = String(innerText || '').trim();
  if (!text) return 0;

  // Pas PROPORTIONNEL au rayon essayé, pas fixe : fitText balaie toutes les
  // tailles de police entre `maxFont` et `minFont` par pas de `step` — à
  // rayon élevé, maxFont (∝ rayon) s'éloigne d'autant du plancher, et un pas
  // fixe ferait exploser le nombre d'essais (cette recherche appelle fitText
  // des dizaines de fois, sur un vœu parfois très long : pas question que
  // CHAQUE appel devienne lui-même coûteux). Le résultat final n'a pas
  // besoin d'être pixel-près, seulement assez grand pour vraiment caser le
  // vœu — le calage RÉEL, précis, se refait de toute façon avec le pas fin
  // habituel une fois le rayon choisi.
  const fits = (radius) => shapes.every((s) => {
    const a = s.a * radius;
    const b = s.b * radius;
    const step = Math.max(0.35, radius * 0.01);
    // Un dôme (voir ARC_SPAN) n'occupe que [-b, 0] : compter sur toute la
    // hauteur [-b, b] sous-estimerait le rayon requis pour lui.
    const yMin = -b;
    const yMax = s.arc ? 0 : b;
    return !!fitText({ text, a, b, n: s.n, measure, maxFont: radius * 0.32, minFont: 3, step, yMin, yMax });
  });

  let lo = 0;
  let hi = 10;
  while (!fits(hi) && hi < 200000) {
    lo = hi;
    hi *= 1.6;
  }
  if (!fits(hi)) return hi; // vœu extrême : le débordement restera de toute façon signalé
  for (let i = 0; i < 20; i += 1) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid; else lo = mid;
  }
  return hi;
}

/**
 * Calcule la mise en page COMPLÈTE d'une phrase à plusieurs boucles, sur
 * autant de pages A4 paysage que nécessaire.
 *
 * Le rayon des boucles est calé sur une DENSITÉ CIBLE (ROWS_PER_PAGE_TARGET
 * lignes par page pleine), PAS sur « tout faire tenir en une seule vue » —
 * c'est la pagination qui absorbe un texte plus long, jamais le rayon. Une
 * phrase de 4 boucles et une de 400 produisent donc des boucles à peu près
 * de la MÊME taille lisible ; seule la seconde s'étale sur plusieurs pages.
 * Le rayon ne descend sous cette cible que si un mot entier (avec sa boucle,
 * la lettre gonflée étant très large) ne tient de toute façon pas dans la
 * largeur de page — cas rare, indépendant du nombre de répétitions.
 *
 * @returns {{
 *   pages: {W:number,H:number,items:object[],connectors:object[]}[],
 *   pageCount: number, radius: number, loops: number,
 *   overflow: boolean, overflowReason: 'vow'|'pages'|'layout'|null,
 * }}
 */
export function composePhrasePages({ phrase, letters, innerText, measure }) {
  const { W, H_MAX, MARGIN, GAP_RATIO, TEXT_FONT_RATIO, TEXT_FONT_MIN, TEXT_FONT_MAX, ROWS_PER_PAGE_TARGET, RADIUS_FLOOR, RADIUS_STEP, MAX_PAGES } = PHRASE_PIECE;
  const maxWidth = W - 2 * MARGIN;
  const maxHeight = H_MAX - 2 * MARGIN;

  const tokens = tokenizePhrase(phrase, letters);
  const usedLetters = letters.filter((l) => tokens.some((t) => t.type === 'loop' && t.letter === l));

  // Hauteur de ligne UNIFORME (mêmes proportions pour toutes les boucles,
  // quel que soit leur rayon commun) : le pire des cas parmi les lettres
  // effectivement présentes. Haut et bas sont désormais IDENTIQUES — la
  // boucle (bowlPath) est symétrique, sans queue qui alourdirait le bas.
  //
  // Un dôme (ص ض ط ظ, voir ARC_SPAN) n'occupe RÉELLEMENT que [-b/2, b/2]
  // une fois recentré sur la ligne (voir plus bas, `loopCy`) — la MOITIÉ de
  // la place d'un rond plein, qui occupe [-b, b]. Compter `b` plein pour un
  // dôme (comme avant) réservait deux fois plus de hauteur de ligne que
  // nécessaire : chaque page ne se remplissait qu'à moitié, le reste restant
  // blanc — signalé. `shapeExtent` donne la VRAIE demi-hauteur occupée par
  // chaque type de boucle, dôme ou rond.
  const shapeExtent = (s) => (s.arc ? s.b / 2 : s.b);
  const shapes = usedLetters.length ? usedLetters.map((l) => shapeFor(l, 1)) : [shapeFor('ه', 1)];
  const bRatio = Math.max(...shapes.map(shapeExtent));
  const topRatio = bRatio;
  const bottomRatio = bRatio;

  // Rayon CIBLE : celui qui fait tenir exactement ROWS_PER_PAGE_TARGET
  // lignes sur une page pleine (n*h + (n-1)*0.15h = maxHeight, résolu pour
  // le rayon r où h = r*(topRatio+bottomRatio)).
  const n = ROWS_PER_PAGE_TARGET;
  const targetRadius = maxHeight / ((n + Math.max(0, n - 1) * 0.15) * (topRatio + bottomRatio));

  // Si le vœu ne tient pas à cette cible même en micro-écriture, ON AGRANDIT
  // LES BOUCLES plutôt que de rétrécir davantage le texte ou de renoncer —
  // demandé explicitement. La recherche de largeur ci-dessous part alors de
  // ce rayon plus grand (et peut encore le réduire si un mot ne rentre pas,
  // exactement comme avant).
  const hasInner = !!String(innerText || '').trim();
  const vowRadius = hasInner ? minRadiusForVow(shapes, innerText, measure) : 0;
  let radius = Math.max(targetRadius, vowRadius);

  let rows = null;
  let textFont = 0;
  for (; radius >= RADIUS_FLOOR; radius *= RADIUS_STEP) {
    textFont = Math.min(TEXT_FONT_MAX, Math.max(TEXT_FONT_MIN, radius * TEXT_FONT_RATIO));
    const gap = radius * GAP_RATIO;
    const candidate = layoutRows({ tokens, radius, textFont, measure, maxWidth, gap });
    if (candidate) {
      rows = candidate;
      break;
    }
  }

  if (!rows) {
    // Un mot entier (avec sa boucle si elle le touche — voir groupWords, un
    // mot ne se scinde jamais entre deux lignes) ne tient dans la largeur de
    // page, même au rayon plancher. Rare et indépendant du nombre de
    // répétitions (voir le commentaire d'en-tête) : distinct du débordement
    // « vœu trop long », signalé séparément par overflowReason.
    return { pages: [], pageCount: 0, radius: 0, loops: 0, overflow: true, overflowReason: 'layout' };
  }

  const rowHeight = radius * (topRatio + bottomRatio);
  const rowGap = rowHeight * 0.15;
  const rowPages = paginateRows(rows.length, rowHeight, rowGap, maxHeight);

  // Épaisseur du tatweel : celle de la lettre qu'il prolonge — demandé
  // explicitement (« le tatweel doit avoir la même épaisseur que la lettre
  // qui la précède »), plutôt qu'un trait à largeur fixe arbitraire. radius
  // et textFont sont fixés pour tout l'appel (recherche déjà terminée à ce
  // point), donc ces deux épaisseurs aussi.
  const loopStroke = Math.max(2, radius * 0.045);
  const textStroke = Math.max(2, textFont * 0.09);

  let anyVowOverflow = false;
  const pagesOverflow = rowPages.length > MAX_PAGES;
  const kept = pagesOverflow ? rowPages.slice(0, MAX_PAGES) : rowPages;

  const pages = kept.map((rowIndices) => {
    // TOUJOURS la taille pleine A4 (H_MAX), même pour une page moins remplie
    // (typiquement la dernière) : son contenu reste centré dedans plutôt que
    // de rétrécir la page à ce contenu — demandé explicitement (« que les
    // pages soient en A4 »).
    const H = H_MAX;
    const contentH = rowIndices.length * rowHeight + (rowIndices.length - 1) * rowGap;
    const startY = MARGIN + (H - 2 * MARGIN - contentH) / 2;

    const items = [];
    const connectors = [];

    rowIndices.forEach((rowIdx, ri) => {
      // Fusion des morceaux de mots voisins (voir mergeAdjacentText) : sans
      // ça, un long passage non gonflé renvoyé à la ligne mot par mot
      // afficherait un espacement et un tatweel artificiels entre des mots
      // qui n'ont pourtant rien à voir avec l'ornement.
      const row = mergeAdjacentText(rows[rowIdx], measure, textFont);
      const rowTop = startY + ri * (rowHeight + rowGap);
      const cy = rowTop + radius * topRatio;
      // Ligne de base du texte courant de la ligne — PAS le centre de la
      // boucle (cy) : c'est ce niveau qui sert aussi au tatweel (connecteur)
      // ci-dessous, pour qu'il reste au même niveau que la lettre qui le
      // précède plutôt que de flotter au milieu des boucles.
      const textY = cy + textFont * 0.32;
      // itemRight avance de DROITE à GAUCHE (lecture arabe). prevTouch
      // retient le bord GAUCHE RÉEL du jeton précédent, à la hauteur textY —
      // pour une boucle, ce n'est PAS cx-a (sa demi-largeur MAXIMALE, au
      // centre cy) mais halfWidthAt(textY-cy, …) : à toute autre hauteur que
      // le centre, une superellipse est plus étroite, et un connecteur tracé
      // jusqu'à cx-a chevaucherait ou manquerait le tracé réel — imprécision
      // signalée. prevTok porte le jeton lui-même (pas seulement sa
      // position) : c'est lui qui dit si CE jeton joint vers l'avant
      // (prevTok.joinsForward, voir tokenizePhrase/NON_FORWARD_JOINING) et
      // quelle épaisseur donner au tatweel — la sienne, jamais une valeur
      // fixe.
      let itemRight = W - MARGIN;
      // Représente le jeton précédent pour LE calcul du connecteur suivant :
      // pour une boucle, de quoi retrouver son bord à N'IMPORTE QUELLE
      // hauteur (cx, cy réellement rendu, norm) ; pour un texte, ses deux
      // bords (fixes, measure() ne dépend pas de la hauteur). Le bord
      // effectif ne se calcule qu'au moment de bâtir CHAQUE connecteur (voir
      // connectorY ci-dessous) — jamais par avance à une hauteur générique.
      let prevShape = null;
      let prevTok = null;

      row.forEach((tok) => {
        const itemLeft = itemRight - tok.w;

        let norm = null;
        let cx = null;
        let loopCy = cy;
        if (tok.type === 'loop') {
          norm = shapeFor(tok.letter, radius);
          cx = itemRight - norm.a;
          // Un dôme (ص ض ط ظ, ARC_SPAN) n'occupe que [-b, 0] dans son propre
          // repère — recentré ICI à cy+b/2 pour occuper visuellement le
          // même créneau qu'un rond plein voisin sur la même ligne (qui,
          // lui, occupe [-b, b] centré sur cy) : sans ce recentrage, le
          // dôme flottait bien plus haut que la base commune — signalé.
          loopCy = norm.arc ? cy + norm.b / 2 : cy;
        }
        const curShape = norm
          ? { kind: 'loop', cx, cy: loopCy, a: norm.a, b: norm.b, n: norm.n, arc: norm.arc }
          : { kind: 'text', left: itemLeft, right: itemRight };

        // Hauteur À LAQUELLE le tatweel touche ses DEUX voisins : par
        // défaut la ligne de base du texte courant (textY) — SAUF si l'un
        // des deux voisins est un dôme (ARC_SPAN), auquel cas on prend la
        // hauteur de SON trait plat (loopCy, y local = 0, demi-largeur
        // EXACTEMENT a). À la hauteur textY générique, un dôme touche en
        // pleine COURBE (textY tombe dans [-b, 0], pas sur le trait plat) :
        // le tatweel grimpait vers le haut au lieu de courir sur le trait
        // plat, formant un coude visible — signalé (« doit être dans la
        // ligne droite, pas en haut »).
        let connectorY = textY;
        if (norm && norm.arc) connectorY = loopCy;
        else if (prevShape && prevShape.kind === 'loop' && prevShape.arc) connectorY = prevShape.cy;

        const edgeAt = (shape, side) => {
          if (shape.kind === 'text') return side === 'left' ? shape.left : shape.right;
          const half = halfWidthAt(connectorY - shape.cy, shape.a, shape.b, shape.n);
          return side === 'left' ? shape.cx - half : shape.cx + half;
        };
        const rightTouch = edgeAt(curShape, 'right');

        // Le tatweel ne se trace QUE si la lettre précédente joint
        // réellement vers l'avant ET qu'aucun vrai espace ne le sépare de
        // CE jeton (ex. « الله » + boucle(ه) suivie d'un mot NEUF, séparé
        // par un espace — la boucle joint bien vers l'avant en soi, mais
        // rien ne doit relier deux mots distincts) — signalé.
        //
        // PAS de chevauchement volontaire ici (essayé, puis retiré) : ça
        // faisait déborder le trait dans les boucles étroites ou dans le
        // corps des lettres voisines — moins esthétique que le petit écart
        // qu'il visait à corriger. Le point de contact reste le contour
        // RÉEL (halfWidthAt côté boucle), sans marge de sécurité ajoutée.
        if (prevTok && prevTok.joinsForward && !tokenStartsWithSpace(tok)) {
          const width = prevTok.type === 'loop' ? loopStroke : textStroke;
          const prevTouch = edgeAt(prevShape, 'left');
          connectors.push({ x1: prevTouch, x2: rightTouch, y: connectorY, width });
        }

        if (tok.type === 'text') {
          items.push({
            type: 'text',
            value: tok.value,
            x: itemRight - tok.w / 2,
            y: textY,
            fontSize: textFont,
          });
        } else {
          // Un dôme (ص ض ط ظ, voir ARC_SPAN) n'a de forme que sur [-b, 0] —
          // rien n'est dessiné en dessous du trait droit du bas : le texte
          // ne doit jamais tenter d'y déborder.
          const inner = hasInner
            ? fitText({
                text: innerText, a: norm.a, b: norm.b, n: norm.n, measure,
                maxFont: radius * 0.32, minFont: 3, step: 0.35,
                yMin: -norm.b, yMax: norm.arc ? 0 : norm.b,
              })
            : null;
          if (hasInner && !inner) anyVowOverflow = true;
          items.push({
            type: 'loop',
            cx,
            cy: loopCy,
            bowl: bowlPath(norm.a, norm.b, norm.n, 240, norm.arc ? ARC_SPAN : Math.PI * 2),
            stroke: loopStroke,
            inner,
          });
        }

        prevShape = curShape;
        prevTok = tok;
        itemRight = itemLeft - radius * GAP_RATIO;
      });
    });

    return { W, H, items, connectors };
  });

  return {
    pages,
    pageCount: pages.length,
    radius,
    loops: usedLetters.length ? tokens.filter((t) => t.type === 'loop').length : 0,
    overflow: anyVowOverflow || pagesOverflow,
    overflowReason: anyVowOverflow ? 'vow' : pagesOverflow ? 'pages' : null,
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
const ORNE_PAGE_STYLE_ID = 'alqalam-orne-page-style';

// Format A4 PAYSAGE en pixels CSS à 96 dpi (297mm / 210mm × 96/25.4), posé en
// ATTRIBUTS width/height (pas seulement en CSS) sur chaque SVG au moment de
// l'impression — filet de sécurité pour un moteur qui ignorerait la feuille
// de style injectée : un <svg> SANS attribut de taille retombe sur 300×150 px
// par défaut, minuscule et sans rapport avec la page — d'où l'apparence
// signalée (pièce centrée, énorme vide autour). Le viewBox garde la mise à
// l'échelle interne intacte ; ces attributs ne fixent que la boîte externe.
const PRINT_PX_PER_MM = 96 / 25.4;
const PRINT_W_PX = Math.round(297 * PRINT_PX_PER_MM);
const PRINT_H_PX = Math.round(210 * PRINT_PX_PER_MM);

/**
 * Ouvre l'impression navigateur sur la pièce (« Enregistrer en PDF ») —
 * une ou PLUSIEURS pages (voir composePhrasePages : une phrase longue se
 * pagine plutôt que de rapetisser les boucles). `container` est l'élément
 * qui enveloppe les svg de chaque page (le nœud sur lequel OrneePhrasePiece
 * pose sa ref) ; chaque svg.orne-svg qu'il contient devient sa propre page
 * imprimée (break-after: page), dans l'ordre du DOM.
 */
export async function printPieces(container, docName) {
  if (!container) throw new Error('Aucune pièce à imprimer.');
  const svgs = Array.from(container.querySelectorAll('svg.orne-svg'));
  if (!svgs.length) throw new Error('Aucune pièce à imprimer.');

  const { PDF_PRINT_ROOT_ID, PDF_PRINT_STYLE_ID } = await import('./alqalam');

  // PIÈGE ÉVITÉ ICI (signalé à deux reprises : PDF centré sur une page
  // presque vide, y compris après un premier correctif de la mise en page)
  // : appeler ensurePrintStylesInjected() (lib/alqalam.js) posait DEUX
  // déclarations @page concurrentes dans deux <style> distincts — la
  // sienne (portrait implicite, jamais changée), la nôtre (paysage). L'ordre
  // entre @page de deux feuilles SÉPARÉES n'est pas départagé de façon
  // fiable par tous les moteurs (notamment mobiles) : @page leur revenait
  // parfois en PORTRAIT malgré notre surcharge, alors que la pièce reste
  // dimensionnée en PAYSAGE — mise à l'échelle sur la largeur (plus étroite
  // en portrait), elle se retrouvait minuscule avec un grand vide en
  // dessous. On ne dépend donc plus DU TOUT de cette feuille : la nôtre
  // reprend elle-même tout ce dont on a besoin (masquer le reste de la
  // page, afficher la racine) — un seul @page actif — et on désactive en
  // plus l'AUTRE le temps de notre impression, au cas où un export texte
  // l'aurait déjà injectée plus tôt dans la session.
  const otherStyle = document.getElementById(PDF_PRINT_STYLE_ID);
  const otherStyleParent = otherStyle ? otherStyle.parentNode : null;
  if (otherStyle) otherStyle.remove();

  let pageStyle = document.getElementById(ORNE_PAGE_STYLE_ID);
  if (!pageStyle) {
    pageStyle = document.createElement('style');
    pageStyle.id = ORNE_PAGE_STYLE_ID;
    document.head.appendChild(pageStyle);
  }
  // NOTE : `height: 100%` (essayé un temps sur html/body/racine/page/svg
  // pour caler la pièce sans dépendre de `vh`) a produit une régression
  // signalée séparément : une seule page imprimée au lieu de toutes.
  // `height: 100%` chaîné sur plusieurs `.orne-print-page` EMPILÉS force
  // chacun à revendiquer la même hauteur que son parent (donc qu'UNE seule
  // page), ce qui perturbe le calcul des sauts de page sur certains moteurs
  // (le cas signalé). On revient donc au flux BLOC ordinaire déjà vérifié :
  // largeur 100 %, hauteur AUTO (suit le ratio propre du SVG, qui est déjà
  // celui de la page) — chaque `.orne-print-page` ne prend que la hauteur
  // de son contenu, et `break-after: page` gère la pagination normalement.
  //
  // `@page margin: 0` (PAS une marge de quelques mm) : reproduit ET corrigé
  // en Chromium réel (page.pdf()) — une marge non nulle réduit la boîte
  // imprimable à un ratio légèrement DIFFÉRENT de 297/210 (celui, EXACT, du
  // SVG), alors que le SVG est mis à l'échelle sur la LARGEUR (100%) avec
  // une hauteur AUTO qui suit son propre ratio 297/210 — sur la boîte
  // légèrement plus étroite en hauteur qu'engendre la marge, ce ratio fait
  // déborder le SVG de quelques pixels sous le bas de la page. Avec
  // `break-after: page` sur CHAQUE pièce, ce léger débordement suffit à
  // pousser un fragment sur une page suivante quasi vide, intercalée entre
  // chaque pièce réelle (vérifié : 7 pièces → 14 pages, la moitié vides).
  // Marge à 0 : boîte imprimable EXACTEMENT 297×210, aucun débordement,
  // aucune page parasite (revérifié : 7 pièces → 7 pages, toutes pleines).
  // La pièce a de toute façon déjà sa propre marge interne (PHRASE_PIECE.
  // MARGIN, en unités SVG) — une marge @page par-dessus n'aurait jamais dû
  // être nécessaire.
  pageStyle.textContent = `
    @media print {
      body > *:not(#${PDF_PRINT_ROOT_ID}) { display: none !important; }
      @page { size: A4 landscape; margin: 0; }
      body { margin: 0; }
      #${PDF_PRINT_ROOT_ID} { display: block !important; }
      #${PDF_PRINT_ROOT_ID} .orne-print-page {
        width: 100%;
        break-after: page; page-break-after: always;
      }
      #${PDF_PRINT_ROOT_ID} .orne-print-page:last-child {
        break-after: auto; page-break-after: auto;
      }
      #${PDF_PRINT_ROOT_ID} svg { display: block; width: 100%; height: auto; }
    }
    @media screen {
      #${PDF_PRINT_ROOT_ID} { display: none !important; }
    }
  `;

  let root = document.getElementById(PDF_PRINT_ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = PDF_PRINT_ROOT_ID;
    document.body.appendChild(root);
  }
  const pages = svgs.map((svgEl) => {
    const wrap = document.createElement('div');
    wrap.className = 'orne-print-page';
    const clone = svgEl.cloneNode(true);
    clone.removeAttribute('style');
    // Filet de sécurité, voir le commentaire de PRINT_W_PX/PRINT_H_PX.
    clone.setAttribute('width', String(PRINT_W_PX));
    clone.setAttribute('height', String(PRINT_H_PX));
    wrap.appendChild(clone);
    return wrap;
  });
  root.replaceChildren(...pages);

  const previousTitle = document.title;
  if (docName) document.title = docName; // nom suggéré par « Enregistrer en PDF »

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    root.remove();
    pageStyle.remove();
    if (otherStyle && otherStyleParent) otherStyleParent.appendChild(otherStyle);
    document.title = previousTitle;
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  // Repli : certains navigateurs mobiles n'émettent pas 'afterprint'.
  setTimeout(cleanup, 5 * 60 * 1000);

  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}
