import { describe, it, expect } from 'vitest';
import {
  ROUND_LETTERS,
  detectRoundLetters,
  shapeFor,
  halfWidthAt,
  bowlPath,
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
    expect(detectRoundLetters('رزقك').map((l) => l.char)).toEqual(['ق']);
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
});

describe('halfWidthAt', () => {
  const { a, b, n } = shapeFor('ق', 100);

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
});

describe('fitText', () => {
  const { a, b, n } = shapeFor('ق', 200);

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

  it('lie chaque segment de texte à la boucle qui le touche (pas de retombée en forme isolée)', () => {
    // Cas signalé : dans « بسم » avec م gonflé, le premier segment « بس »
    // doit se souder à la boucle — son س doit garder sa forme MÉDIANE, pas
    // retomber sur sa forme isolée/finale de fin de mot.
    const tokens = tokenizePhrase(BASMALA, ['م', 'ه']);
    const texts = tokens.filter((t) => t.type === 'text').map((t) => t.value);
    expect(texts).toEqual([
      'بس‍', // début de phrase : liant seulement APRÈS (rien avant à souder)
      '‍ الل‍', // entre deux boucles : liant des DEUX côtés
      '‍ الرح‍',
      '‍ن الرحي‍', // dernier segment : suivi d'une boucle (الرحيم), donc lié après aussi
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
    expect(tokens).toEqual([{ type: 'text', value: 'ربي' }]);
  });

  it('gère deux lettres consécutives sans texte entre elles', () => {
    expect(tokenizePhrase('مم', ['م'])).toEqual([
      { type: 'loop', letter: 'م' },
      { type: 'loop', letter: 'م' },
    ]);
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
