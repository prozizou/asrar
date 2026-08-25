import { describe, it, expect } from 'vitest';
import {
  normalizeGroupInput,
  progressPct,
  partSize,
  clampFait,
  cleanText,
  TARGET_MAX,
  PARTS_MAX,
  NAME_MAX,
} from './zikrLogic';

describe('normalizeGroupInput', () => {
  it('accepte une saisie valide et la normalise', () => {
    const r = normalizeGroupInput({ name: '  Khatm Yâ Latîf ', phrase: ' يا لطيف ', target: '100000', parts: '3' });
    expect(r).toEqual({ name: 'Khatm Yâ Latîf', phrase: 'يا لطيف', target: 100000, parts: 3 });
  });

  it('préserve le texte arabe (pas de caractères d’évasion à retirer)', () => {
    const r = normalizeGroupInput({ name: 'Test', phrase: 'أستغفر الله العظيم', target: 1000, parts: 2 });
    expect(r.phrase).toBe('أستغفر الله العظيم');
  });

  it('rejette un nom vide', () => {
    expect(normalizeGroupInput({ name: '   ', phrase: 'x', target: 10, parts: 1 })).toEqual({ error: 'name' });
  });

  it('rejette un nom devenu vide après retrait des caractères dangereux', () => {
    expect(normalizeGroupInput({ name: '<>&"', phrase: 'x', target: 10, parts: 1 })).toEqual({ error: 'name' });
  });

  it('rejette une phrase vide', () => {
    expect(normalizeGroupInput({ name: 'ok', phrase: '', target: 10, parts: 1 })).toEqual({ error: 'phrase' });
  });

  it('rejette un objectif nul, négatif, non numérique ou hors borne', () => {
    expect(normalizeGroupInput({ name: 'a', phrase: 'b', target: 0, parts: 1 })).toEqual({ error: 'target' });
    expect(normalizeGroupInput({ name: 'a', phrase: 'b', target: -5, parts: 1 })).toEqual({ error: 'target' });
    expect(normalizeGroupInput({ name: 'a', phrase: 'b', target: 'abc', parts: 1 })).toEqual({ error: 'target' });
    expect(normalizeGroupInput({ name: 'a', phrase: 'b', target: TARGET_MAX + 1, parts: 1 })).toEqual({ error: 'target' });
  });

  it('rejette un nombre de parts invalide, hors borne, ou supérieur à l’objectif', () => {
    expect(normalizeGroupInput({ name: 'a', phrase: 'b', target: 100, parts: 0 })).toEqual({ error: 'parts' });
    expect(normalizeGroupInput({ name: 'a', phrase: 'b', target: 100, parts: 'x' })).toEqual({ error: 'parts' });
    expect(normalizeGroupInput({ name: 'a', phrase: 'b', target: 100, parts: PARTS_MAX + 1 })).toEqual({ error: 'parts' });
    expect(normalizeGroupInput({ name: 'a', phrase: 'b', target: 5, parts: 6 })).toEqual({ error: 'parts' });
  });

  it('tronque un nom trop long à NAME_MAX', () => {
    const r = normalizeGroupInput({ name: 'x'.repeat(200), phrase: 'p', target: 10, parts: 1 });
    expect(r.name.length).toBe(NAME_MAX);
  });
});

describe('partSize', () => {
  it('répartit à parts égales quand la division tombe juste', () => {
    expect(partSize(900, 3, 0)).toBe(300);
    expect(partSize(900, 3, 1)).toBe(300);
    expect(partSize(900, 3, 2)).toBe(300);
  });

  it('donne le reste à la dernière part', () => {
    expect(partSize(1000, 3, 0)).toBe(333);
    expect(partSize(1000, 3, 1)).toBe(333);
    expect(partSize(1000, 3, 2)).toBe(334);
  });

  it('la somme des parts vaut toujours exactement l’objectif', () => {
    const objectif = 1234, parts = 7;
    let sum = 0;
    for (let r = 0; r < parts; r++) sum += partSize(objectif, parts, r);
    expect(sum).toBe(objectif);
  });

  it('renvoie 0 pour un rang hors bornes ou parts nul', () => {
    expect(partSize(100, 0, 0)).toBe(0);
    expect(partSize(100, 3, 3)).toBe(0);
    expect(partSize(100, 3, -1)).toBe(0);
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
