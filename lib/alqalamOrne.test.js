import { describe, it, expect } from 'vitest';
import {
  ROUND_LETTERS,
  detectRoundLetters,
  shapeFor,
  halfWidthAt,
  bowlPath,
  tailPath,
  fitText,
  composePiece,
  stripLetterOccurrences,
  PIECE,
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

describe('composePiece', () => {
  const VOEU =
    'اللهم ارزقني آلاف مليارات وآلاف مليون سيارات وآلاف مليون منازل وبيوت ' +
    'وسخر لي رجال الدنيا ونساءها وهب زوجات وأولاد صالحين وصحة كاملة';

  // Extrait les points d'un tracé « M x,y L x,y … » ou d'une courbe « M … Q … ».
  const pointsOf = (d) =>
    d
      .replace(/[MLQZ]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p.split(',').map(Number));

  // Ce test garde les deux débordements trouvés à l'œil au premier rendu : le
  // mot sortait à droite (text-anchor inversé en RTL) et la queue de la lettre
  // sortait à gauche (aucune réserve prévue pour elle).
  it('garde boucle, queue et texte dans la page, pour chaque lettre', () => {
    for (const letter of ROUND_LETTERS) {
      const p = composePiece({ word: 'رزقك', letter: letter.char, innerText: VOEU, measure });
      const ctx = `lettre ${letter.char}`;

      expect(p.H, ctx).toBeGreaterThan(0);
      expect(p.H, ctx).toBeLessThanOrEqual(PIECE.H_MAX);

      for (const d of [p.bowl, p.tail].filter(Boolean)) {
        for (const [x, y] of pointsOf(d)) {
          expect(p.cx + x, ctx).toBeGreaterThanOrEqual(-0.01);
          expect(p.cx + x, ctx).toBeLessThanOrEqual(p.W + 0.01);
          expect(p.cy + y, ctx).toBeGreaterThanOrEqual(-0.01);
          expect(p.cy + y, ctx).toBeLessThanOrEqual(p.H + 0.01);
        }
      }

      // Le mot est ancré en son MILIEU : ses deux bords doivent tenir.
      const halfWord = measure(p.word, p.wordFont) / 2;
      expect(p.wordX - halfWord, ctx).toBeGreaterThanOrEqual(0);
      expect(p.wordX + halfWord, ctx).toBeLessThanOrEqual(p.W + 0.01);
    }
  });

  it('ajuste la hauteur à la lettre plutôt qu’une toile figée', () => {
    const plat = composePiece({ word: 'نصر', letter: 'ص', innerText: VOEU, measure });
    const rond = composePiece({ word: 'الله', letter: 'ه', innerText: VOEU, measure });
    expect(plat.H).toBeLessThan(rond.H);
  });

  it('relie le mot à la boucle sans les chevaucher', () => {
    const p = composePiece({ word: 'رزقك', letter: 'ق', innerText: VOEU, measure });
    expect(p.connector).not.toBeNull();
    expect(p.connector.x1).toBeGreaterThanOrEqual(p.cx + p.a - 0.01);
    expect(p.connector.x2).toBeGreaterThan(p.connector.x1);
  });

  it('se passe de trait de liaison quand il n’y a pas de mot', () => {
    const p = composePiece({ word: '  ', letter: 'ق', innerText: VOEU, measure });
    expect(p.connector).toBeNull();
    expect(p.word).toBe('');
  });

  it('signale un texte trop long au lieu de le tronquer', () => {
    // La micro-écriture (voir plus bas) case déjà plusieurs centaines de
    // répétitions d'une formule courante — il faut donc un volume nettement
    // plus grand pour dépasser une capacité désormais réelle, pas symbolique.
    const p = composePiece({
      word: 'رزقك',
      letter: 'ق',
      innerText: 'كلمة '.repeat(10000),
      measure,
    });
    expect(p.inner).toBeNull();
    expect(p.overflow).toBe(true);
  });

  it('n’annonce aucun débordement sans texte intérieur', () => {
    const p = composePiece({ word: 'رزقك', letter: 'ق', innerText: '', measure });
    expect(p.overflow).toBe(false);
  });
});

describe('stripLetterOccurrences', () => {
  it('retire la lettre gonflée pour éviter de la montrer deux fois', () => {
    // Cas signalé : الله + ه affichait « الله » (déjà terminé par un ه, lui
    // -même arrondi dans la police) À CÔTÉ de la boucle censée le représenter.
    expect(stripLetterOccurrences('الله', 'ه')).toBe('الل');
  });

  it("retire aussi l'équivalent ة", () => {
    expect(stripLetterOccurrences('رحمة', 'ه')).toBe('رحم');
  });

  it('retire toutes les occurrences si la lettre apparaît plusieurs fois', () => {
    expect(stripLetterOccurrences('ممم', 'م')).toBe('');
  });

  it('laisse le mot intact si la lettre en est absente', () => {
    expect(stripLetterOccurrences('ربي', 'ق')).toBe('ربي');
  });
});

describe('composePiece — mot affiché', () => {
  it('n’affiche plus la lettre gonflée dans le mot (aucun ه ni ة restant)', () => {
    const p = composePiece({ word: 'الله', letter: 'ه', innerText: '', measure });
    expect(p.word).toBe('الل');
    expect(p.word).not.toMatch(/[هة]/);
  });

  it('garde le reste du mot pour une lettre au milieu (رزقك + ق)', () => {
    const p = composePiece({ word: 'رزقك', letter: 'ق', innerText: '', measure });
    expect(p.word).toBe('رزك');
  });
});

describe('composePiece — micro-écriture (textes longs)', () => {
  const PHRASE = 'اللهم ارزقني رزقا واسعا حلالا';

  it('case un texte répété plusieurs centaines de fois (usage réel visé)', () => {
    const text = Array(300).fill(PHRASE).join(' ');
    const p = composePiece({ word: 'رزقك', letter: 'ق', innerText: text, measure });
    expect(p.overflow).toBe(false);
    expect(p.inner).not.toBeNull();
    // Le texte est replacé EN ENTIER, jamais tronqué en silence.
    const placed = p.inner.lines.map((l) => l.text).join(' ').split(/\s+/);
    expect(placed).toEqual(text.split(/\s+/));
  });

  it('reste rapide même sur un très gros volume', () => {
    const text = Array(800).fill(PHRASE).join(' ');
    const t0 = performance.now();
    composePiece({ word: 'رزقك', letter: 'ق', innerText: text, measure });
    expect(performance.now() - t0).toBeLessThan(500);
  });
});
