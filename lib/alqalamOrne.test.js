import { describe, it, expect } from 'vitest';
import {
  ROUND_LETTERS,
  detectRoundLetters,
  shapeFor,
  halfWidthAt,
  bowlPath,
  ARC_SPAN,
  fitText,
  tokenizePhrase,
  composePhrasePages,
  paginateRows,
  PHRASE_PIECE,
  LINE_RATIO,
  INSET_RATIO,
} from './alqalamOrne';

// Mesureur déterministe : largeur proportionnelle au nombre de caractères.
// Suffit pour éprouver la géométrie et le calage, sans dépendre d'une police.
const measure = (text, fontSize) => text.length * fontSize * 0.5;

describe('detectRoundLetters', () => {
  it('ne retient que les lettres rondes présentes', () => {
    // ق (qâf) a été retiré des lettres rondes — رزقك n'en garde donc aucune,
    // مر (qui contient un vrai rond, م) montre la sélectivité.
    expect(detectRoundLetters('رزقك')).toEqual([]);
    expect(detectRoundLetters('قمر').map((l) => l.char)).toEqual(['م']);
  });

  it('reconnaît le tâ marbûta comme un hâ', () => {
    expect(detectRoundLetters('رحمة').map((l) => l.char)).toEqual(['م', 'ه']);
  });

  it('renvoie une liste vide sans lettre ronde', () => {
    expect(detectRoundLetters('ربي')).toEqual([]);
  });

  it('ne duplique pas une lettre répétée', () => {
    expect(detectRoundLetters('مم').map((l) => l.char)).toEqual(['م']);
  });

  it('reconnaît ظ (zâ) parmi les lettres rondes', () => {
    expect(detectRoundLetters('نظر').map((l) => l.char)).toEqual(['ظ']);
  });
});

describe('shapeFor — rond plein vs arc', () => {
  it('marque م et ه comme des ronds pleins (arc: false)', () => {
    expect(shapeFor('م', 100).arc).toBe(false);
    expect(shapeFor('ه', 100).arc).toBe(false);
  });

  it('marque ص ض ط ظ comme des arcs de cercle (arc: true) — demandé explicitement', () => {
    for (const char of ['ص', 'ض', 'ط', 'ظ']) {
      expect(shapeFor(char, 100).arc, char).toBe(true);
    }
  });
});

describe('halfWidthAt', () => {
  const { a, b, n } = shapeFor('ه', 100);

  it('est maximale au centre et nulle aux pôles', () => {
    expect(halfWidthAt(0, a, b, n)).toBeCloseTo(a, 6);
    expect(halfWidthAt(b, a, b, n)).toBe(0);
    expect(halfWidthAt(-b, a, b, n)).toBe(0);
  });

  it('reste nulle hors de la forme', () => {
    expect(halfWidthAt(b * 2, a, b, n)).toBe(0);
  });

  it('décroît de façon monotone en s’éloignant du centre', () => {
    let prev = Infinity;
    for (let y = 0; y < b; y += b / 40) {
      const w = halfWidthAt(y, a, b, n);
      expect(w).toBeLessThanOrEqual(prev + 1e-9);
      prev = w;
    }
  });

  it('est symétrique', () => {
    expect(halfWidthAt(b * 0.4, a, b, n)).toBeCloseTo(halfWidthAt(-b * 0.4, a, b, n), 9);
  });

  it('offre plus de surface qu’une ellipse à mi-hauteur (n > 2)', () => {
    // C'est tout l'intérêt de la superellipse : une panse plus pleine.
    const ellipse = a * Math.sqrt(1 - 0.25);
    expect(halfWidthAt(b * 0.5, a, b, n)).toBeGreaterThan(ellipse);
  });
});

describe('bowlPath', () => {
  it('produit un contour fermé', () => {
    const d = bowlPath(100, 80, 2.8, 24);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d.split('L')).toHaveLength(24);
  });

  it('reste dans la boîte englobante de la forme', () => {
    const a = 120;
    const b = 90;
    const d = bowlPath(a, b, 3, 120);
    const coords = d.replace(/^M/, '').replace(/Z$/, '').split('L');
    for (const pair of coords) {
      const [x, y] = pair.split(',').map(Number);
      expect(Math.abs(x)).toBeLessThanOrEqual(a + 0.01);
      expect(Math.abs(y)).toBeLessThanOrEqual(b + 0.01);
    }
  });

  it('ne génère aucune coordonnée NaN', () => {
    expect(bowlPath(100, 80, 2.4, 60)).not.toMatch(/NaN/);
  });

  it('trace un ARC OUVERT (pas un rond plein) quand arcSpan < 2π — demandé pour ص ض ط ظ', () => {
    const d = bowlPath(100, 80, 3, 240, ARC_SPAN);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(false); // ouvert : pas de fermeture automatique
  });

  it('reste dans la boîte englobante même en arc ouvert', () => {
    const a = 120;
    const b = 90;
    const d = bowlPath(a, b, 3, 240, ARC_SPAN);
    const coords = d.replace(/^M/, '').split('L');
    for (const pair of coords) {
      const [x, y] = pair.split(',').map(Number);
      expect(Math.abs(x)).toBeLessThanOrEqual(a + 0.01);
      expect(Math.abs(y)).toBeLessThanOrEqual(b + 0.01);
    }
  });
});

describe('fitText', () => {
  const { a, b, n } = shapeFor('ه', 200);

  it('renvoie null sans texte', () => {
    expect(fitText({ text: '   ', a, b, n, measure, maxFont: 20 })).toBeNull();
  });

  it('place tous les mots sans en perdre', () => {
    const text = 'اللهم ارزقني آلاف مليارات وآلاف مليون سيارات ومنازل وبيوت وصحة كاملة';
    const res = fitText({ text, a, b, n, measure, maxFont: 30 });
    expect(res).not.toBeNull();
    expect(res.lines.join(' ').length).toBeGreaterThan(0);
    const placed = res.lines.map((l) => l.text).join(' ').split(/\s+/);
    expect(placed).toEqual(text.split(/\s+/));
  });

  it('garde chaque ligne dans le contour, y compris aux extrémités', () => {
    const text = Array.from({ length: 40 }, (_, i) => 'كلمة' + i).join(' ');
    const res = fitText({ text, a, b, n, measure, maxFont: 30 });
    expect(res).not.toBeNull();
    const inset = INSET_RATIO * Math.min(a, b);
    const lineHeight = res.fontSize * LINE_RATIO;
    for (const line of res.lines) {
      // Bande verticale réellement occupée par la ligne (cf. fitOnLines).
      const yTop = line.y - lineHeight * 0.74;
      const yWorst = Math.max(Math.abs(yTop), Math.abs(yTop + lineHeight));
      const avail = 2 * halfWidthAt(yWorst, a, b, n) - 2 * inset;
      expect(measure(line.text, res.fontSize)).toBeLessThanOrEqual(avail + 1e-6);
    }
  });

  it('centre le bloc de lignes verticalement', () => {
    const res = fitText({ text: 'ربنا اغفر لنا ذنوبنا', a, b, n, measure, maxFont: 30 });
    const lineHeight = res.fontSize * LINE_RATIO;
    const first = res.lines[0].y - lineHeight * 0.74;
    const last = res.lines[res.lines.length - 1].y - lineHeight * 0.74 + lineHeight;
    expect(first + last).toBeCloseTo(0, 6);
  });

  it('réduit la police quand le texte est long', () => {
    const court = fitText({ text: 'يا رزاق', a, b, n, measure, maxFont: 40 });
    const long = fitText({
      text: Array.from({ length: 60 }, () => 'اللهم').join(' '),
      a, b, n, measure, maxFont: 40,
    });
    expect(long.fontSize).toBeLessThan(court.fontSize);
  });

  it('abandonne proprement si un seul mot est trop large même au minimum', () => {
    const enorme = 'م'.repeat(4000);
    expect(fitText({ text: enorme, a, b, n, measure, maxFont: 20, minFont: 5 })).toBeNull();
  });

  it('couvre chacune des six lettres rondes', () => {
    for (const letter of ROUND_LETTERS) {
      const s = shapeFor(letter.char, 200);
      const res = fitText({ text: 'اللهم صل على سيدنا محمد وسلم', ...s, measure, maxFont: 30 });
      expect(res, letter.char).not.toBeNull();
    }
  });
});

describe('tokenizePhrase', () => {
  const BASMALA = 'بسم الله الرحمن الرحيم';

  it('isole une occurrence de chaque lettre choisie, dans l’ordre de lecture', () => {
    const tokens = tokenizePhrase(BASMALA, ['م', 'ه']);
    // Liants (voir test dédié plus bas) retirés ici : ce test porte sur
    // l'ORDRE DE LECTURE et le contenu, pas sur leur placement exact.
    const rebuilt = tokens
      .map((t) => (t.type === 'loop' ? 'ⓛ' + t.letter : t.value))
      .join('')
      .replace(/‍/g, '');
    expect(rebuilt).toBe('بسⓛم اللⓛه الرحⓛمن الرحيⓛم');
  });

  it('lie chaque segment de texte à la boucle qui le touche (pas de retombée en forme isolée), MAIS jamais à travers un vrai espace', () => {
    // Cas signalé : dans « بسم » avec م gonflé, le premier segment « بس »
    // doit se souder à la boucle — son س doit garder sa forme MÉDIANE, pas
    // retomber sur sa forme isolée/finale de fin de mot. Mais بسم, الله,
    // الرحمن et الرحيم restent 4 MOTS séparés par de vrais espaces : aucun
    // liant ne doit prétendre les souder entre eux (signalé : « الله »
    // se présentait avec un tatweel après son ه final, comme s'il
    // continuait dans le mot suivant).
    const tokens = tokenizePhrase(BASMALA, ['م', 'ه']);
    const texts = tokens.filter((t) => t.type === 'text').map((t) => t.value);
    expect(texts).toEqual([
      'بس‍', // début de phrase : liant seulement APRÈS (rien avant à souder)
      ' الل‍', // « الله » : un vrai espace le sépare de بسم (aucun liant en
      // tête), mais collé à SA PROPRE boucle (ه) sans espace.
      ' الرح‍', // idem pour « الرحمن », séparé de « الله » par un espace.
      '‍ن', // fin de « الرحمن » : collé à la boucle qui précède, mais PAS
      // d'espace — reste dans le MÊME mot, pas de liant après lui (le
      // prochain jeton n'est pas une boucle, c'est le mot suivant).
      ' الرحي‍', // début de « الرحيم » : un vrai espace le sépare du
      // jeton précédent (aucun liant en tête), mais lié à la boucle qui
      // le suit. Les deux se recollent normalement au rendu (voir
      // mergeAdjacentText, testé dans composePhrasePages) : cette coupure
      // est ce qui permet à layoutRows de renvoyer « الرحيم » à la ligne
      // sans jamais couper « الرحمن » ni « الرحيم » en deux.
    ]);
  });

  it('compte exactement 4 boucles pour la basmala (م×3, ه×1)', () => {
    const tokens = tokenizePhrase(BASMALA, ['م', 'ه']);
    const loops = tokens.filter((t) => t.type === 'loop');
    expect(loops).toHaveLength(4);
    expect(loops.map((l) => l.letter)).toEqual(['م', 'ه', 'م', 'م']);
  });

  it('reconnaît ة comme une occurrence de ه', () => {
    const tokens = tokenizePhrase('رحمة', ['ه']);
    expect(tokens.filter((t) => t.type === 'loop')).toHaveLength(1);
  });

  it('ne coupe rien sans lettre choisie présente', () => {
    const tokens = tokenizePhrase('ربي', ['ق']);
    expect(tokens).toEqual([{ type: 'text', value: 'ربي', joinsForward: true }]);
  });

  it('gère deux lettres consécutives sans texte entre elles', () => {
    expect(tokenizePhrase('مم', ['م'])).toEqual([
      { type: 'loop', letter: 'م', joinsForward: true },
      { type: 'loop', letter: 'م', joinsForward: true },
    ]);
  });

  it('détecte qu’un segment de texte terminé par une lettre à liaison unilatérale (ر، و، د، ذ، ز، ا) ne joint pas vers l’avant', () => {
    // « برق » : le segment « بر » qui précède la boucle (ق) finit par ر, qui
    // n'offre jamais de liaison vers l'avant — aucun liant ajouté après lui.
    const tokens = tokenizePhrase('برق', ['ق']);
    const text = tokens.find((t) => t.type === 'text');
    expect(text.value).toBe('بر');
    expect(text.joinsForward).toBe(false);
  });

  it('une occurrence de ة (via EQUIV) ne joint jamais vers l’avant, même dessinée comme un ه', () => {
    // « رحمة » : la boucle vient d'un ة, qui ne clôt qu'une fin de mot —
    // jamais suivie d'une autre lettre du même mot.
    const tokens = tokenizePhrase('رحمة يا رب', ['ه']);
    const loop = tokens.find((t) => t.type === 'loop');
    expect(loop.joinsForward).toBe(false);
    // Le segment suivant ne reçoit donc PAS de liant en tête : ce n'est pas
    // ce qui doit se passer entre un ة et le mot suivant. (Éclaté par mot,
    // ce segment ne porte d'ailleurs que le premier mot, « يا » — voir le
    // test dédié à l'éclatement par mot pour ce détail.)
    const after = tokens[tokens.indexOf(loop) + 1];
    expect(after.value.startsWith('‍')).toBe(false);
    expect(after.value).toBe(' يا');
  });

  it('une occurrence authentique de ه (pas ة) joint normalement vers l’avant', () => {
    const tokens = tokenizePhrase(BASMALA, ['ه']);
    const loop = tokens.find((t) => t.type === 'loop');
    expect(loop.joinsForward).toBe(true);
  });

  it('un espace bloque la liaison vers l’avant même après une lettre qui joint normalement', () => {
    // « من » finit par ن (joint normalement), mais un vrai espace le sépare
    // de la boucle (ه, début du mot suivant « هادي ») : la présence d'une
    // lettre qui joint AVANT l'espace ne doit rien changer, l'espace
    // l'emporte toujours.
    const tokens = tokenizePhrase('من هادي', ['ه']);
    const loopIdx = tokens.findIndex((t) => t.type === 'loop');
    expect(tokens[loopIdx - 1].joinsForward).toBe(false);
  });

  it('éclate un segment de texte non gonflé en morceaux par MOT, jamais par lettre', () => {
    // Sans lettre choisie dans « الحي القيوم », tout resterait un seul bloc
    // avant l'éclatement ; ici il doit ressortir en deux mots ENTIERS.
    const tokens = tokenizePhrase('الحي القيوم', ['ق']);
    const texts = tokens.filter((t) => t.type === 'text').map((t) => t.value);
    expect(texts[0]).toBe('الحي');
    expect(texts[1]).toBe(' ال‍');
  });
});

describe('paginateRows', () => {
  it('met tout sur une seule page quand tout tient', () => {
    expect(paginateRows(3, 100, 15, 400)).toEqual([[0, 1, 2]]);
  });

  it('répartit sur plusieurs pages quand ça déborde', () => {
    // 3 lignes par page pleine : 3*100 + 2*15 = 330 ≤ 400, mais
    // 4*100 + 3*15 = 445 > 400.
    const pages = paginateRows(10, 100, 15, 400);
    expect(pages).toHaveLength(4);
    expect(pages[0]).toEqual([0, 1, 2]);
    expect(pages[3]).toEqual([9]);
  });

  it('renvoie un tableau vide sans ligne', () => {
    expect(paginateRows(0, 100, 15, 400)).toEqual([]);
  });

  it('donne à chaque ligne sa propre page si une seule dépasse déjà la hauteur', () => {
    expect(paginateRows(3, 500, 15, 400)).toEqual([[0], [1], [2]]);
  });
});

describe('composePhrasePages', () => {
  const BASMALA = 'بسم الله الرحمن الرحيم';
  const VOEU = 'اللهم ارزقني رزقا واسعا حلالا';

  const allItems = (p) => p.pages.flatMap((pg) => pg.items);

  it('produit une boucle par occurrence de lettre choisie (cas visé : 4 pour la basmala)', () => {
    const p = composePhrasePages({ phrase: BASMALA, letters: ['م', 'ه'], innerText: VOEU, measure });
    expect(p.overflow).toBe(false);
    expect(p.loops).toBe(4);
    const items = allItems(p);
    expect(items.filter((it) => it.type === 'loop')).toHaveLength(4);
    // Chaque boucle a bien reçu (et casé) le vœu.
    for (const loop of items.filter((it) => it.type === 'loop')) {
      expect(loop.inner).not.toBeNull();
    }
  });

  it('ne dessine QUE des ronds — aucune queue sous les lettres gonflées', () => {
    // Demandé explicitement : « seulement des ronds, pas les traits qui
    // tirent vers le bas ». bowlPath (fermé, symétrique) reste le seul
    // contour ; il n'y a plus de champ `tail` du tout sur les boucles.
    const p = composePhrasePages({ phrase: BASMALA, letters: ['م', 'ه'], innerText: VOEU, measure });
    for (const loop of allItems(p).filter((it) => it.type === 'loop')) {
      expect(loop.tail).toBeUndefined();
    }
  });

  it('respecte les bornes de CHAQUE page (largeur ET hauteur)', () => {
    const p = composePhrasePages({ phrase: BASMALA, letters: ['م', 'ه'], innerText: VOEU, measure });
    for (const page of p.pages) {
      expect(page.H).toBe(PHRASE_PIECE.H_MAX);
      for (const it of page.items) {
        if (it.type === 'loop') {
          const pts = it.bowl.replace(/[MLQZ]/g, ' ').trim().split(/\s+/).filter(Boolean).map((s) => s.split(',').map(Number));
          for (const [x, y] of pts) {
            expect(it.cx + x).toBeGreaterThanOrEqual(-0.5);
            expect(it.cx + x).toBeLessThanOrEqual(page.W + 0.5);
            expect(it.cy + y).toBeGreaterThanOrEqual(-0.5);
            expect(it.cy + y).toBeLessThanOrEqual(page.H + 0.5);
          }
        } else {
          expect(it.x - measure(it.value, it.fontSize) / 2).toBeGreaterThanOrEqual(-0.5);
          expect(it.x + measure(it.value, it.fontSize) / 2).toBeLessThanOrEqual(page.W + 0.5);
        }
      }
    }
  });

  it('donne à CHAQUE page — même la dernière, moins remplie — la taille pleine A4', () => {
    // Avant, une page moins remplie (typiquement la dernière) rétrécissait
    // à son contenu ; demandé explicitement : « que les pages soient en
    // A4 » — toutes, uniformément.
    const phrase = Array(20).fill(BASMALA).join(' ');
    const p = composePhrasePages({ phrase, letters: ['م', 'ه'], innerText: VOEU, measure });
    expect(p.pageCount).toBeGreaterThan(1);
    expect(p.pages.every((pg) => pg.H === PHRASE_PIECE.H_MAX)).toBe(true);
  });

  it('a un format A4 PAYSAGE exact (ratio 297/210)', () => {
    expect(PHRASE_PIECE.W / PHRASE_PIECE.H_MAX).toBeCloseTo(297 / 210, 2);
  });

  it('aligne le tatweel (connecteur) sur la ligne de base du texte, pas sur le centre de la boucle', () => {
    const p = composePhrasePages({ phrase: BASMALA, letters: ['م', 'ه'], innerText: VOEU, measure });
    const page = p.pages[0];
    const textYs = new Set(page.items.filter((it) => it.type === 'text').map((it) => it.y));
    expect(page.connectors.length).toBeGreaterThan(0);
    for (const c of page.connectors) {
      expect(textYs.has(c.y)).toBe(true);
    }
  });

  it('touche le bord RÉEL de la boucle à la hauteur du tatweel, pas sa demi-largeur maximale (cx±a)', () => {
    // Signalé : imprécision visible au zoom — une superellipse est plus
    // étroite hors de son centre vertical (cy), et le tatweel n'est PAS
    // tracé à cy mais à textY (légèrement décalé) : son point de contact
    // avec la boucle doit suivre le contour RÉEL à cette hauteur
    // (halfWidthAt), jamais la demi-largeur maximale a (qui n'existe
    // qu'exactement à cy).
    const p = composePhrasePages({ phrase: 'بمر', letters: ['م'], innerText: 'يا رزاق', measure });
    const page = p.pages[0];
    expect(page.connectors).toHaveLength(2); // ب→boucle et boucle→ر
    const loop = page.items.find((it) => it.type === 'loop');
    const shape = shapeFor('م', p.radius);
    const halfAtTextY = halfWidthAt(page.connectors[0].y - loop.cy, shape.a, shape.b, shape.n);
    expect(halfAtTextY).toBeLessThan(shape.a); // hors du centre : forcément plus étroit
    // Chaque connecteur touche la boucle exactement à cx±halfAtTextY.
    const touchXs = page.connectors
      .flatMap((c) => [c.x1, c.x2])
      .filter((x) => Math.abs(Math.abs(x - loop.cx) - halfAtTextY) < 0.01);
    expect(touchXs).toHaveLength(2); // un par connecteur, du bon côté
  });

  it('ne trace le tatweel qu’aux jonctions où une vraie liaison existe (une lettre qui joint, ET aucun espace)', () => {
    // « برق » (ق gonflé) seul : « بر » précède la boucle mais finit par ر,
    // qui ne joint jamais vers l'avant — aucun connecteur.
    const p1 = composePhrasePages({ phrase: 'برق', letters: ['ق'], innerText: 'يا رزاق', measure });
    expect(p1.pages[0].connectors).toHaveLength(0);

    // « القيوم » (ق gonflé) : ال + boucle + يوم forment UN SEUL mot, sans
    // aucun espace — les deux jonctions sont de vraies liaisons.
    const p2 = composePhrasePages({ phrase: 'القيوم', letters: ['ق'], innerText: 'يا رزاق', measure });
    expect(p2.pages[0].connectors).toHaveLength(2);
    const loop = p2.pages[0].items.find((it) => it.type === 'loop');
    expect(loop).toBeDefined();
    // Et l'un des deux a l'épaisseur de la boucle (voir test suivant pour
    // le cas symétrique côté texte).
    expect(p2.pages[0].connectors.some((c) => c.width === loop.stroke)).toBe(true);

    // « برق الليل » : la boucle (ق) est en revanche suivie d'un MOT NEUF
    // (« الليل », séparé par un espace) — signalé : un tatweel apparaissait
    // à tort après un mot complet, comme s'il continuait dans le suivant.
    // Toujours aucun connecteur ici.
    const p3 = composePhrasePages({ phrase: 'برق الليل', letters: ['ق'], innerText: 'يا رزاق', measure });
    expect(p3.pages[0].connectors).toHaveLength(0);
  });

  it('donne au tatweel la même épaisseur que la lettre (texte ou boucle) qui le précède', () => {
    const p = composePhrasePages({ phrase: BASMALA, letters: ['م', 'ه'], innerText: VOEU, measure });
    const page = p.pages[0];
    const loop = page.items.find((it) => it.type === 'loop');
    const widths = new Set(page.connectors.map((c) => c.width));
    // Deux épaisseurs distinctes doivent apparaître (celle du texte suivi
    // d'une boucle, celle d'une boucle suivie de texte) — jamais une seule
    // valeur fixe partagée par tous les connecteurs.
    expect(widths.size).toBe(2);
    expect(widths.has(loop.stroke)).toBe(true);
  });

  it('un espace avant une boucle bloque aussi le tatweel, même après une lettre qui joint normalement', () => {
    // « من » se termine par ن, qui joint normalement vers l'avant — mais un
    // vrai espace le sépare de la boucle (ه, mot suivant « هادي ») : aucune
    // liaison ne doit être perçue à travers cet espace (voir le test dédié
    // dans tokenizePhrase pour la même vérification au niveau des jetons).
    const p = composePhrasePages({ phrase: 'من هادي', letters: ['ه'], innerText: 'يا رزاق', measure });
    const page = p.pages[0];
    expect(page.connectors).toHaveLength(1); // seulement boucle→"ادي" (ه joint normalement)
    const textBefore = page.items.find((it) => it.type === 'text' && it.value.trim() === 'من');
    expect(textBefore).toBeDefined();
  });

  it('ne coupe JAMAIS un mot entre deux lignes, même quand une boucle le touche sans espace', () => {
    // Cas signalé : « القيوم » (ق gonflé) ne doit jamais être rendu
    // « قيو » en fin d'une ligne puis « م » au début de la suivante — ال,
    // la boucle (ق) et يوم doivent rester ensemble, quelle que soit la
    // longueur du texte qui précède et qui force le retour à la ligne.
    const p = composePhrasePages({
      phrase: 'يا رحيم الحي القيوم',
      letters: ['ق'],
      innerText: 'يا رزاق',
      measure,
    });
    const page = p.pages[0];
    const loop = page.items.find((it) => it.type === 'loop');
    expect(loop).toBeDefined();
    const before = page.items.find((it) => it.type === 'text' && it.value.endsWith('ال‍'));
    const after = page.items.find((it) => it.type === 'text' && it.value.startsWith('‍يوم'));
    expect(before).toBeDefined();
    expect(after).toBeDefined();
    // Les trois morceaux du même mot partagent la même ligne (même cy pour
    // la boucle, même y pour le texte — cf. textY = cy + décalage constant).
    expect(before.y).toBe(after.y);
  });

  it('reconstitue le texte affiché EXACTEMENT dans l’ordre de lecture (rien perdu, rien dupliqué)', () => {
    const p = composePhrasePages({ phrase: BASMALA, letters: ['م', 'ه'], innerText: VOEU, measure });
    // Liants (voir tokenizePhrase, testés directement là-bas) retirés ici :
    // ce test porte sur l'ordre et le contenu, pas sur leur placement exact.
    const rebuilt = allItems(p)
      .map((it) => (it.type === 'text' ? it.value : 'ⓛ'))
      .join('')
      .replace(/‍/g, '');
    expect(rebuilt).toBe('بسⓛ اللⓛ الرحⓛن الرحيⓛ');
  });

  it('sans lettre choisie présente, écrit la phrase telle quelle (aucune boucle)', () => {
    const p = composePhrasePages({ phrase: BASMALA, letters: ['ق'], innerText: VOEU, measure });
    expect(p.loops).toBe(0);
    const items = allItems(p);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('text');
    expect(items[0].value).toBe(BASMALA);
  });

  it('AGRANDIT les boucles quand le vœu ne tient pas à la densité cible, au lieu de rétrécir le texte ou de renoncer', () => {
    // Demandé explicitement : « au lieu de rétrécir le texte, augmenter les
    // rondeurs ». Un vœu bien plus long que d'habitude, mais pas absurde,
    // doit faire grandir le rayon au-delà de la cible de densité — pas
    // rester bloqué dessus en signalant un débordement.
    const longVoeu = Array(100).fill('اللهم ارزقني رزقا واسعا حلالا طيبا').join(' ');
    const petit = composePhrasePages({ phrase: BASMALA, letters: ['م', 'ه'], innerText: VOEU, measure });
    const grand = composePhrasePages({ phrase: BASMALA, letters: ['م', 'ه'], innerText: longVoeu, measure });
    expect(grand.radius).toBeGreaterThan(petit.radius);
    expect(grand.overflow).toBe(false);
    const loops = grand.pages[0].items.filter((it) => it.type === 'loop');
    expect(loops.every((l) => l.inner !== null)).toBe(true);
  });

  it('signale un débordement du VŒU si trop long, sans affecter la mise en page (les boucles restent)', () => {
    const p = composePhrasePages({
      phrase: BASMALA,
      letters: ['م', 'ه'],
      innerText: 'كلمة '.repeat(10000),
      measure,
    });
    expect(p.overflow).toBe(true);
    expect(p.overflowReason).toBe('vow');
    // La MISE EN PAGE réussit quand même (elle ne dépend pas de la longueur
    // du vœu, seulement du nombre de jetons) : les boucles sont bien là,
    // simplement vides — c'est le CALAGE DU VŒU dans chacune qui échoue.
    const loops = allItems(p).filter((it) => it.type === 'loop');
    expect(loops.length).toBeGreaterThan(0);
    expect(loops.every((l) => l.inner === null)).toBe(true);
  });

  it('pagine sur PLUSIEURS pages une phrase trop longue pour une seule, SANS réduire le rayon des boucles', () => {
    // 20 basmalas mises bout à bout : largement plus que ce qu'une seule
    // page peut contenir à la densité cible — c'est la pagination qui
    // absorbe, pas un rayon qui rétrécirait.
    const phrase = Array(20).fill(BASMALA).join(' ');
    const p = composePhrasePages({ phrase, letters: ['م', 'ه'], innerText: VOEU, measure });
    expect(p.pageCount).toBeGreaterThan(1);
    expect(p.overflow).toBe(false);
  });

  it('signale un débordement de PAGES quand même la pagination ne suffit plus (MAX_PAGES dépassé)', () => {
    // Des milliers de boucles : même réparties sur des dizaines de pages, ça
    // dépasse la borne de raison MAX_PAGES — distinct du débordement « vœu ».
    const phrase = Array(1000).fill('محمد').join(' ');
    const p = composePhrasePages({ phrase, letters: ['م'], innerText: 'يا رزاق', measure });
    expect(p.overflow).toBe(true);
    expect(p.overflowReason).toBe('pages');
    expect(p.pageCount).toBeLessThanOrEqual(PHRASE_PIECE.MAX_PAGES);
  });

  it('garde un rayon STABLE, indépendant du nombre de répétitions de la phrase', () => {
    // Le cœur du correctif : avant, répéter la phrase « des centaines de
    // fois » forçait un rayon minuscule pour tout faire tenir sur une seule
    // page. Maintenant le rayon ne dépend que de la densité cible par page.
    const once = composePhrasePages({ phrase: BASMALA, letters: ['م', 'ه'], innerText: VOEU, measure });
    const repeated = composePhrasePages({
      phrase: Array(10).fill(BASMALA).join(' '),
      letters: ['م', 'ه'],
      innerText: VOEU,
      measure,
    });
    expect(repeated.radius).toBeCloseTo(once.radius, 6);
  });

  it('reste rapide (recherche de rayon et pagination incluses)', () => {
    const t0 = performance.now();
    composePhrasePages({
      phrase: Array(20).fill(BASMALA).join(' '),
      letters: ['م', 'ه'],
      innerText: VOEU,
      measure,
    });
    expect(performance.now() - t0).toBeLessThan(500);
  });
});
