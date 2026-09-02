import { describe, it, expect } from 'vitest';
import {
  normalizeGroupInput,
  normalizeSessionAt,
  totalFait,
  progressPct,
  normalizeFait,
  normalizeRythme,
  cleanText,
  TARGET_MAX,
  RYTHME_MAX,
  NAME_MAX,
} from './zikrLogic';

describe('normalizeGroupInput', () => {
  it('accepte une saisie valide (formule préréglée) et la normalise', () => {
    const r = normalizeGroupInput({ name: '  Khatm Yâ Latîf ', presetId: 'salawat', target: '100000' });
    expect(r).toEqual({
      name: 'Khatm Yâ Latîf',
      presetId: 'salawat',
      arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّد',
      transliteration: 'Salât ‘alâ Nabiy',
      target: 100000,
      private: false,
      sessionAt: null,
    });
  });

  it('accepte un zikr privé (private:true, invisible dans la liste publique — voir pages/api/zikr.js)', () => {
    const r = normalizeGroupInput({ name: 'Test', presetId: 'salawat', target: 10, private: true });
    expect(r.private).toBe(true);
  });

  it('accepte un horaire de session optionnel (epoch ms)', () => {
    const r = normalizeGroupInput({ name: 'Test', presetId: 'salawat', target: 10, sessionAt: 1234567890 });
    expect(r.sessionAt).toBe(1234567890);
  });

  it('accepte un « Zikr libre » avec une formule arabe saisie à la main', () => {
    const r = normalizeGroupInput({ name: 'Test', presetId: 'libre', arabic: ' أستغفر الله العظيم ', target: 1000 });
    expect(r.presetId).toBe('libre');
    expect(r.arabic).toBe('أستغفر الله العظيم');
  });

  it('rejette un nom vide', () => {
    expect(normalizeGroupInput({ name: '   ', presetId: 'salawat', target: 10 })).toEqual({ error: 'name' });
  });

  it('rejette un nom devenu vide après retrait des caractères dangereux', () => {
    expect(normalizeGroupInput({ name: '<>&"', presetId: 'salawat', target: 10 })).toEqual({ error: 'name' });
  });

  it('rejette une formule (presetId) inconnue', () => {
    expect(normalizeGroupInput({ name: 'ok', presetId: 'inconnue', target: 10 })).toEqual({ error: 'preset' });
  });

  it('rejette un « Zikr libre » sans formule arabe saisie', () => {
    expect(normalizeGroupInput({ name: 'ok', presetId: 'libre', arabic: '   ', target: 10 })).toEqual({ error: 'arabic' });
  });

  it('rejette un objectif nul, négatif, non numérique ou hors borne', () => {
    expect(normalizeGroupInput({ name: 'a', presetId: 'salawat', target: 0 })).toEqual({ error: 'target' });
    expect(normalizeGroupInput({ name: 'a', presetId: 'salawat', target: -5 })).toEqual({ error: 'target' });
    expect(normalizeGroupInput({ name: 'a', presetId: 'salawat', target: 'abc' })).toEqual({ error: 'target' });
    expect(normalizeGroupInput({ name: 'a', presetId: 'salawat', target: TARGET_MAX + 1 })).toEqual({ error: 'target' });
  });

  it('tronque un nom trop long à NAME_MAX', () => {
    const r = normalizeGroupInput({ name: 'x'.repeat(200), presetId: 'salawat', target: 10 });
    expect(r.name.length).toBe(NAME_MAX);
  });
});

describe('normalizeSessionAt', () => {
  it('accepte un epoch ms positif', () => {
    expect(normalizeSessionAt(1234567890123)).toBe(1234567890123);
    expect(normalizeSessionAt('1234567890123')).toBe(1234567890123);
  });

  it('renvoie null pour absent, vide, nul ou négatif (champ optionnel, jamais bloquant)', () => {
    expect(normalizeSessionAt(undefined)).toBeNull();
    expect(normalizeSessionAt(null)).toBeNull();
    expect(normalizeSessionAt('')).toBeNull();
    expect(normalizeSessionAt(0)).toBeNull();
    expect(normalizeSessionAt(-5)).toBeNull();
    expect(normalizeSessionAt('abc')).toBeNull();
  });

  it('tronque un décimal', () => {
    expect(normalizeSessionAt(1234567890123.9)).toBe(1234567890123);
  });
});

describe('totalFait', () => {
  it('somme les grains des participants actifs', () => {
    expect(totalFait({ a: { fait: 10 }, b: { fait: 25 } }, 0)).toBe(35);
  });

  it('ajoute ce qu’avaient déjà fait ceux qui sont partis (faitPartis)', () => {
    expect(totalFait({ a: { fait: 10 } }, 90)).toBe(100);
  });

  it('traite l’absence de participants ou de faitPartis comme 0', () => {
    expect(totalFait(undefined, undefined)).toBe(0);
    expect(totalFait({}, 0)).toBe(0);
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

describe('normalizeFait', () => {
  it('accepte un entier positif SANS plafond (objectif partagé, pas de part individuelle)', () => {
    expect(normalizeFait(120)).toBe(120);
    expect(normalizeFait(999999)).toBe(999999);
  });

  it('tronque un décimal vers le bas', () => {
    expect(normalizeFait(12.9)).toBe(12);
  });

  it('renvoie 0 pour zéro, négatif ou non numérique', () => {
    expect(normalizeFait(0)).toBe(0);
    expect(normalizeFait(-10)).toBe(0);
    expect(normalizeFait('x')).toBe(0);
  });
});

describe('normalizeRythme', () => {
  it('accepte un entier positif', () => {
    expect(normalizeRythme(42)).toBe(42);
  });

  it('plafonne à RYTHME_MAX (garde-fou de stockage, jamais bloquant)', () => {
    expect(normalizeRythme(RYTHME_MAX + 500)).toBe(RYTHME_MAX);
  });

  it('renvoie 0 pour zéro, négatif ou non numérique', () => {
    expect(normalizeRythme(0)).toBe(0);
    expect(normalizeRythme(-5)).toBe(0);
    expect(normalizeRythme('x')).toBe(0);
  });
});

describe('cleanText', () => {
  it('retire les caractères d’évasion HTML et normalise les espaces', () => {
    expect(cleanText('a<b>c&"d', 100)).toBe('a b c d');
  });
});
