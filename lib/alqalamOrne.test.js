import { describe, it, expect } from 'vitest';
import {
  ROUND_LETTERS,
  detectRoundLetters,
  shapeFor,
  halfWidthAt,
  bowlPath,
  tailPath,
  fitText,
  tokenizePhrase,
  composePhrasePiece,
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

describe('tailPath', () => {
  it('est absente pour les lettres sans queue', () => {
    expect(tailPath(100, 80, 'none')).toBeNull();
  });

  it('part du bas de la boucle pour une queue plongeante', () => {
    expect(tailPath(100, 80, 'down')).toMatch(/^M-50,68\.8Q/);
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

describe('composePhrasePiece', () => {
  const BASMALA = 'بسم الله الرحمن الرحيم';
  const VOEU = 'اللهم ارزقني رزقا واسعا حلالا';

  it('produit une boucle par occurrence de lettre choisie (cas visé : 4 pour la basmala)', () => {
    const p = composePhrasePiece({ phrase: BASMALA, letters: ['م', 'ه'], innerText: VOEU, measure });
    expect(p.overflow).toBe(false);
    expect(p.loops).toBe(4);
    expect(p.items.filter((it) => it.type === 'loop')).toHaveLength(4);
    // Chaque boucle a bien reçu (et casé) le vœu.
    for (const loop of p.items.filter((it) => it.type === 'loop')) {
      expect(loop.inner).not.toBeNull();
    }
  });

  it('respecte les bornes de page (largeur ET hauteur)', () => {
    const p = composePhrasePiece({ phrase: BASMALA, letters: ['م', 'ه'], innerText: VOEU, measure });
    expect(p.H).toBeLessThanOrEqual(PHRASE_PIECE.H_MAX);
    for (const it of p.items) {
      if (it.type === 'loop') {
        // Le contour complet (boucle + queue éventuelle) doit tenir en x et y.
        for (const d of [it.bowl, it.tail].filter(Boolean)) {
          const pts = d.replace(/[MLQZ]/g, ' ').trim().split(/\s+/).filter(Boolean).map((s) => s.split(',').map(Number));
          for (const [x, y] of pts) {
            expect(it.cx + x).toBeGreaterThanOrEqual(-0.5);
            expect(it.cx + x).toBeLessThanOrEqual(p.W + 0.5);
            expect(it.cy + y).toBeGreaterThanOrEqual(-0.5);
            expect(it.cy + y).toBeLessThanOrEqual(p.H + 0.5);
          }
        }
      } else {
        expect(it.x - measure(it.value, it.fontSize) / 2).toBeGreaterThanOrEqual(-0.5);
        expect(it.x + measure(it.value, it.fontSize) / 2).toBeLessThanOrEqual(p.W + 0.5);
      }
    }
  });

  it('reconstitue le texte affiché EXACTEMENT dans l’ordre de lecture (rien perdu, rien dupliqué)', () => {
    const p = composePhrasePiece({ phrase: BASMALA, letters: ['م', 'ه'], innerText: VOEU, measure });
    // Liants (voir tokenizePhrase, testés directement là-bas) retirés ici :
    // ce test porte sur l'ordre et le contenu, pas sur leur placement exact.
    const rebuilt = p.items
      .map((it) => (it.type === 'text' ? it.value : 'ⓛ'))
      .join('')
      .replace(/‍/g, '');
    expect(rebuilt).toBe('بسⓛ اللⓛ الرحⓛن الرحيⓛ');
  });

  it('sans lettre choisie présente, écrit la phrase telle quelle (aucune boucle)', () => {
    const p = composePhrasePiece({ phrase: BASMALA, letters: ['ق'], innerText: VOEU, measure });
    expect(p.loops).toBe(0);
    expect(p.items).toHaveLength(1);
    expect(p.items[0].type).toBe('text');
    expect(p.items[0].value).toBe(BASMALA);
  });

  it('signale un débordement si le vœu est bien trop long pour le nombre de boucles', () => {
    const p = composePhrasePiece({
      phrase: BASMALA,
      letters: ['م', 'ه'],
      innerText: 'كلمة '.repeat(2000),
      measure,
    });
    expect(p.overflow).toBe(true);
    // La MISE EN PAGE réussit quand même (elle ne dépend pas de la longueur
    // du vœu, seulement du nombre de jetons) : les boucles sont bien là,
    // simplement vides — c'est le CALAGE DU VŒU dans chacune qui échoue.
    const loops = p.items.filter((it) => it.type === 'loop');
    expect(loops.length).toBeGreaterThan(0);
    expect(loops.every((l) => l.inner === null)).toBe(true);
  });

  it('signale aussi un débordement quand la PHRASE elle-même est trop longue (trop de boucles pour la page)', () => {
    // Ici ce n'est plus le vœu qui déborde mais la mise en page globale :
    // même au rayon plancher, des centaines de boucles ne tiennent plus dans
    // la hauteur de page — la recherche de rayon échoue entièrement (aucune
    // valeur ne satisfait la largeur ET la hauteur), avant même de calculer
    // le calage du vœu dans une boucle.
    const phrase = Array(300).fill('محمد').join(' ');
    const p = composePhrasePiece({ phrase, letters: ['م'], innerText: 'يا رزاق', measure });
    expect(p.overflow).toBe(true);
    expect(p.items).toEqual([]);
    expect(p.H).toBeLessThanOrEqual(PHRASE_PIECE.H_MAX);
  });

  it('reste rapide (recherche de rayon incluse)', () => {
    const t0 = performance.now();
    composePhrasePiece({ phrase: BASMALA, letters: ['م', 'ه'], innerText: VOEU, measure });
    expect(performance.now() - t0).toBeLessThan(300);
  });
});
