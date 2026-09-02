import { describe, it, expect } from 'vitest';
import {
  calculateWeight, classifyLetter, alphabetForClassification, getAllowedLengths,
  generateThalsams, validateResult, THALSAM_ALPHABET, LUMINOUS_LETTERS, ENDINGS, DEFAULT_MAX_RESULTS,
} from './thalsam';

describe('calculateWeight', () => {
  it('somme les valeurs des lettres (exemple §6 : وش = 1006)', () => {
    expect(calculateWeight('وش')).toBe(1006);
  });

  it('lève une erreur sur une lettre inconnue de la table', () => {
    expect(() => calculateWeight('abc')).toThrow(/Lettre inconnue/);
  });

  it('renvoie 0 pour une chaîne vide', () => {
    expect(calculateWeight('')).toBe(0);
  });
});

describe('classifyLetter', () => {
  it('classe les 14 lettres lumineuses (§4)', () => {
    for (const l of LUMINOUS_LETTERS) expect(classifyLetter(l)).toBe('LUMINEUSE');
  });

  it('classe le reste NON_LUMINEUSE', () => {
    for (const l of THALSAM_ALPHABET) {
      if (!LUMINOUS_LETTERS.includes(l)) expect(classifyLetter(l)).toBe('NON_LUMINEUSE');
    }
  });
});

describe('alphabetForClassification', () => {
  it('mixed (défaut) renvoie les 28 lettres', () => {
    expect(alphabetForClassification({ mode: 'mixed' }).length).toBe(28);
    expect(alphabetForClassification(undefined).length).toBe(28);
  });

  it('luminousOnly renvoie exactement les 14 lettres lumineuses', () => {
    const r = alphabetForClassification({ mode: 'luminousOnly' });
    expect(r.length).toBe(14);
    expect(r.every((l) => LUMINOUS_LETTERS.includes(l))).toBe(true);
  });

  it('nonLuminousOnly renvoie exactement les 14 autres lettres', () => {
    const r = alphabetForClassification({ mode: 'nonLuminousOnly' });
    expect(r.length).toBe(14);
    expect(r.every((l) => !LUMINOUS_LETTERS.includes(l))).toBe(true);
  });

  it('custom filtre à la liste fournie (jamais une lettre hors table)', () => {
    const r = alphabetForClassification({ mode: 'custom', customLetters: ['ا', 'ب', 'xyz'] });
    expect(r).toEqual(['ا', 'ب']);
  });
});

describe('getAllowedLengths', () => {
  it('exact renvoie une seule longueur', () => {
    expect(getAllowedLengths({ mode: 'exact', exact: 7 })).toEqual([7]);
  });

  it('range renvoie l’intervalle complet', () => {
    expect(getAllowedLengths({ mode: 'range', min: 5, max: 8 })).toEqual([5, 6, 7, 8]);
  });

  it('auto renvoie une plage bornée', () => {
    const r = getAllowedLengths({ mode: 'auto' });
    expect(r[0]).toBe(1);
    expect(r.length).toBeGreaterThan(1);
  });

  it('rejette une configuration invalide (vide)', () => {
    expect(getAllowedLengths({ mode: 'exact', exact: 0 })).toEqual([]);
    expect(getAllowedLengths({ mode: 'range', min: 8, max: 5 })).toEqual([]);
    expect(getAllowedLengths({ mode: 'inconnue' })).toEqual([]);
  });
});

describe('generateThalsams — exemple travaillé de la spécification (§13)', () => {
  it('2743 / 7 lettres exactement / finition وش → au moins un résultat, tous vérifiés', () => {
    const out = generateThalsams({
      targetWeight: 2743,
      length: { mode: 'exact', exact: 7 },
      ending: { mode: 'specific', selected: 'وش' },
      generation: { allowRepeatedLetters: true },
    });
    expect(out.error).toBeUndefined();
    expect(out.totalResults).toBeGreaterThan(0);
    for (const r of out.results) {
      expect(r.totalWeight).toBe(2743);
      expect(r.endingWeight).toBe(1006);
      expect(r.rootWeight).toBe(1737);
      expect(r.totalLetters).toBe(7);
      expect(r.rootLetters).toBe(5);
      expect(r.ending).toBe('وش');
      expect(r.thalsam.endsWith('وش')).toBe(true);
      expect(r.verified).toBe(true);
      expect(validateResult(r, 2743)).toBe(true);
      // Vérification indépendante lettre par lettre (§15).
      const sum = r.calculation.reduce((s, c) => s + c.value, 0);
      expect(sum).toBe(2743);
    }
  });
});

describe('generateThalsams — mode automatique (longueur + finition)', () => {
  it('teste plusieurs finitions et longueurs, tous les résultats respectent la cible', () => {
    // Les 6 finitions pèsent toutes au moins 302 (بس) — une cible trop petite
    // (< poids de la finition la plus légère) ne pourrait jamais matcher,
    // quelle que soit la racine : 1090 dépasse la plus lourde (عيش = 1080).
    const out = generateThalsams({
      targetWeight: 1090,
      length: { mode: 'range', min: 3, max: 5 },
      ending: { mode: 'auto' },
      maxResults: 15,
    });
    expect(out.totalResults).toBeGreaterThan(0);
    for (const r of out.results) {
      expect(r.totalWeight).toBe(1090);
      expect(ENDINGS).toContain(r.ending);
      expect(r.totalLetters).toBeGreaterThanOrEqual(3);
      expect(r.totalLetters).toBeLessThanOrEqual(5);
    }
  });
});

describe('generateThalsams — répétition interdite', () => {
  it('aucune lettre ne se répète dans la racine quand allowRepeatedLetters=false', () => {
    const out = generateThalsams({
      targetWeight: 66, // ش(1000) exclu de fait, petites lettres seulement
      length: { mode: 'exact', exact: 3 },
      ending: { mode: 'specific', selected: 'ش' },
      generation: { allowRepeatedLetters: false },
      maxResults: 20,
    });
    for (const r of out.results) {
      const letters = [...r.root];
      expect(new Set(letters).size).toBe(letters.length);
    }
  });
});

describe('generateThalsams — classification lumineuse', () => {
  it('luminousOnly : toutes les lettres de la racine sont lumineuses (la finition, elle, n’est pas contrainte)', () => {
    // ending وش (1006) + racine d'1 lettre valant 9 (ط, lumineuse) = 1015.
    const out = generateThalsams({
      targetWeight: 1015,
      length: { mode: 'exact', exact: 3 },
      ending: { mode: 'specific', selected: 'وش' },
      letterClassification: { mode: 'luminousOnly' },
    });
    expect(out.totalResults).toBeGreaterThan(0);
    for (const r of out.results) {
      expect(r.rootLetters).toBe(1);
      for (const l of r.root) expect(LUMINOUS_LETTERS).toContain(l);
    }
  });

  it('nonLuminousOnly : aucune lettre lumineuse dans la racine', () => {
    // ending ش (1000) + racine d'1 lettre valant 90 (ض, non lumineuse) = 1090.
    const out = generateThalsams({
      targetWeight: 1090,
      length: { mode: 'exact', exact: 2 },
      ending: { mode: 'specific', selected: 'ش' },
      letterClassification: { mode: 'nonLuminousOnly' },
    });
    expect(out.totalResults).toBeGreaterThan(0);
    for (const r of out.results) {
      for (const l of r.root) expect(LUMINOUS_LETTERS).not.toContain(l);
    }
  });
});

describe('generateThalsams — garde-fous', () => {
  it('poids cible invalide -> erreur, aucun résultat', () => {
    expect(generateThalsams({ targetWeight: 0 }).error).toBeTruthy();
    expect(generateThalsams({ targetWeight: -5 }).error).toBeTruthy();
    expect(generateThalsams({ targetWeight: NaN }).error).toBeTruthy();
  });

  it('finition spécifique inconnue -> erreur explicite', () => {
    const out = generateThalsams({
      targetWeight: 100,
      length: { mode: 'exact', exact: 3 },
      ending: { mode: 'specific', selected: 'inconnue' },
    });
    expect(out.error).toMatch(/Finition inconnue/);
  });

  it('cible hors de portée (finition seule déjà trop lourde) -> résultats vides, pas d’erreur', () => {
    const out = generateThalsams({
      targetWeight: 5,
      length: { mode: 'exact', exact: 1 },
      ending: { mode: 'specific', selected: 'وش' }, // poids 1006 > 5
    });
    expect(out.error).toBeUndefined();
    expect(out.results).toEqual([]);
  });

  it('respecte maxResults', () => {
    const out = generateThalsams({
      targetWeight: 30,
      length: { mode: 'range', min: 1, max: 3 },
      ending: { mode: 'auto' },
      maxResults: 3,
    });
    expect(out.results.length).toBeLessThanOrEqual(3);
  });
});

describe('generateThalsams — garde-fou anti-explosion combinatoire (§18/§30)', () => {
  it('longueur auto + cible difficile à atteindre : se termine vite (budget de nœuds), sans jamais planter', () => {
    const start = Date.now();
    const out = generateThalsams({
      targetWeight: 999_983, // grand nombre premier-like, aucune structure simple à trouver
      length: { mode: 'auto' },
      ending: { mode: 'auto' },
    });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000); // le budget de nœuds doit couper la recherche bien avant
    expect(Array.isArray(out.results)).toBe(true);
  });
});

describe('validateResult', () => {
  it('rejette un résultat dont le poids ou la finition ne correspond pas', () => {
    const fake = { thalsam: 'اب', ending: 'ش', totalLetters: 2 };
    expect(validateResult(fake, 999)).toBe(false); // poids faux
    const fake2 = { thalsam: 'ابش', ending: 'ب', totalLetters: 3 }; // ne finit pas par "ب"... si, mais poids faux
    expect(validateResult(fake2, 0)).toBe(false);
  });
});

describe('generateThalsams — cible large et facilement atteignable (longueur/finition auto)', () => {
  it('trouve rapidement des résultats jusqu’au plafond maxResults, tous vérifiés', () => {
    const start = Date.now();
    const out = generateThalsams({ targetWeight: 5000, length: { mode: 'auto' }, ending: { mode: 'auto' } });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
    expect(out.totalResults).toBe(DEFAULT_MAX_RESULTS);
    expect(out.truncated).toBe(true);
    for (const r of out.results) expect(r.totalWeight).toBe(5000);
  });
});
