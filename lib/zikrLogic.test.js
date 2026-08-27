import { describe, it, expect } from 'vitest';
import {
  normalizeGroupInput,
  normalizeAmount,
  progressPct,
  clampFait,
  cleanText,
  TARGET_MAX,
  NAME_MAX,
} from './zikrLogic';

describe('normalizeGroupInput', () => {
  it('accepte une saisie valide et la normalise', () => {
    const r = normalizeGroupInput({ name: '  Khatm Yâ Latîf ', phrase: ' يا لطيف ', target: '100000' });
    expect(r).toEqual({ name: 'Khatm Yâ Latîf', phrase: 'يا لطيف', target: 100000 });
  });

  it('préserve le texte arabe (pas de caractères d’évasion à retirer)', () => {
    const r = normalizeGroupInput({ name: 'Test', phrase: 'أستغفر الله العظيم', target: 1000 });
    expect(r.phrase).toBe('أستغفر الله العظيم');
  });

  it('rejette un nom vide', () => {
    expect(normalizeGroupInput({ name: '   ', phrase: 'x', target: 10 })).toEqual({ error: 'name' });
  });

  it('rejette un nom devenu vide après retrait des caractères dangereux', () => {
    expect(normalizeGroupInput({ name: '<>&"', phrase: 'x', target: 10 })).toEqual({ error: 'name' });
  });

  it('rejette une phrase vide', () => {
    expect(normalizeGroupInput({ name: 'ok', phrase: '', target: 10 })).toEqual({ error: 'phrase' });
  });

  it('rejette un objectif nul, négatif, non numérique ou hors borne', () => {
    expect(normalizeGroupInput({ name: 'a', phrase: 'b', target: 0 })).toEqual({ error: 'target' });
    expect(normalizeGroupInput({ name: 'a', phrase: 'b', target: -5 })).toEqual({ error: 'target' });
    expect(normalizeGroupInput({ name: 'a', phrase: 'b', target: 'abc' })).toEqual({ error: 'target' });
    expect(normalizeGroupInput({ name: 'a', phrase: 'b', target: TARGET_MAX + 1 })).toEqual({ error: 'target' });
  });

  it('tronque un nom trop long à NAME_MAX', () => {
    const r = normalizeGroupInput({ name: 'x'.repeat(200), phrase: 'p', target: 10 });
    expect(r.name.length).toBe(NAME_MAX);
  });
});

describe('normalizeAmount', () => {
  it('accepte un nombre entier positif dans la limite du restant', () => {
    expect(normalizeAmount(50, 100)).toEqual({ amount: 50 });
    expect(normalizeAmount('50', 100)).toEqual({ amount: 50 });
  });

  it('accepte de prendre exactement tout le restant', () => {
    expect(normalizeAmount(100, 100)).toEqual({ amount: 100 });
  });

  it('tronque un décimal vers le bas', () => {
    expect(normalizeAmount(12.9, 100)).toEqual({ amount: 12 });
  });

  it('rejette un nombre supérieur au restant (la somme ne doit jamais dépasser l’objectif)', () => {
    expect(normalizeAmount(101, 100)).toEqual({ error: 'amount' });
  });

  it('rejette zéro, négatif ou non numérique', () => {
    expect(normalizeAmount(0, 100)).toEqual({ error: 'amount' });
    expect(normalizeAmount(-5, 100)).toEqual({ error: 'amount' });
    expect(normalizeAmount('x', 100)).toEqual({ error: 'amount' });
  });

  it('rejette tout engagement quand il ne reste plus rien à prendre (groupe complet)', () => {
    expect(normalizeAmount(1, 0)).toEqual({ error: 'amount' });
  });
});

describe('progressPct', () => {
  it('calcule le pourcentage cumulé', () => {
    expect(progressPct(50, 200)).toBe(25);
  });

  it('borne à 100 même en dépassement', () => {
    expect(progressPct(300, 200)).toBe(100);
  });

  it('renvoie 0 pour un objectif nul ou invalide', () => {
    expect(progressPct(10, 0)).toBe(0);
    expect(progressPct(10, -1)).toBe(0);
    expect(progressPct(10, NaN)).toBe(0);
  });

  it('traite un total absent comme 0', () => {
    expect(progressPct(undefined, 100)).toBe(0);
  });
});

describe('clampFait', () => {
  it('garde un avancement entier dans [0, part]', () => {
    expect(clampFait(120, 333)).toBe(120);
  });

  it('plafonne à la taille de la part (on n’égrène pas au-delà de sa part)', () => {
    expect(clampFait(500, 333)).toBe(333);
  });

  it('renvoie 0 pour zéro, négatif ou non numérique', () => {
    expect(clampFait(0, 100)).toBe(0);
    expect(clampFait(-10, 100)).toBe(0);
    expect(clampFait('x', 100)).toBe(0);
  });

  it('tronque un décimal vers le bas', () => {
    expect(clampFait(12.9, 100)).toBe(12);
  });
});

describe('cleanText', () => {
  it('retire les caractères d’évasion HTML et normalise les espaces', () => {
    expect(cleanText('a<b>c&"d', 100)).toBe('a b c d');
  });
});
