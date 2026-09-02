import { describe, it, expect } from 'vitest';
import {
  calculateWeight, classifyLetter, alphabetForClassification, getAllowedLengths,
  generateThalsams, validateResult, THALSAM_ALPHABET, LUMINOUS_LETTERS, ENDINGS, DEFAULT_MAX_RESULTS,
} from './thalsam';

describe('ENDINGS — liste corrigée', () => {
  it('ne contient plus بس (retirée par erreur)', () => {
    expect(ENDINGS).not.toContain('بس');
  });

  it('contient les 4 nouvelles finitions avec le bon poids', () => {
    expect(ENDINGS).toEqual(expect.arrayContaining(['ديش', 'دديش', 'طش', 'ياش']));
    expect(calculateWeight('ديش')).toBe(1014); // د4 + ي10 + ش1000
    expect(calculateWeight('دديش')).toBe(1018); // د4 + د4 + ي10 + ش1000
    expect(calculateWeight('طش')).toBe(1009); // ط9 + ش1000
    expect(calculateWeight('ياش')).toBe(1011); // ي10 + ا1 + ش1000
  });

  it('a 9 finitions au total', () => {
    expect(ENDINGS.length).toBe(9);
  });
});

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

  it('auto sans cible (repli) démarre à 1', () => {
    const r = getAllowedLengths({ mode: 'auto' });
    expect(r[0]).toBe(1);
    expect(r.length).toBeGreaterThan(1);
  });

  it('auto avec une cible démarre au minimum théorique ceil(cible/1000) — un gros poids reste atteignable', () => {
    // 16641 : impossible en moins de 17 lettres (ceil(16641/1000)=17), quelle
    // que soit la lettre choisie (ش=1000 est la plus lourde de la table).
    const r = getAllowedLengths({ mode: 'auto' }, 16641);
    expect(r[0]).toBe(17);
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
    // Les 9 finitions pèsent toutes au moins 1000 (ش) — une cible trop petite
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

  it('16641 (le mode "auto" était bloqué à 12 lettres avant correction) trouve des résultats rapidement', () => {
    const start = Date.now();
    const out = generateThalsams({ targetWeight: 16641, length: { mode: 'auto' }, ending: { mode: 'auto' } });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
    expect(out.error).toBeUndefined();
    expect(out.totalResults).toBeGreaterThan(0);
    for (const r of out.results) {
      expect(r.totalWeight).toBe(16641);
      expect(r.totalLetters).toBeGreaterThanOrEqual(17); // ceil(16641/1000)
      expect(validateResult(r, 16641)).toBe(true);
    }
  });

  it('16641 en longueur exacte (19 lettres) fonctionne aussi', () => {
    const out = generateThalsams({
      targetWeight: 16641,
      length: { mode: 'exact', exact: 19 },
      ending: { mode: 'specific', selected: 'ش' },
    });
    expect(out.totalResults).toBeGreaterThan(0);
    for (const r of out.results) {
      expect(r.totalWeight).toBe(16641);
      expect(r.totalLetters).toBe(19);
    }
  });

  it('16641 en 17 lettres exactement (minimum théorique, mais réellement IMPOSSIBLE avec cette finition) renvoie 0 résultat sans erreur ni approximation (§24)', () => {
    // ceil(16641/1000)=17 est le minimum ATTEIGNABLE en magnitude, mais pas
    // forcément un minimum RÉALISABLE : les dénominations disponibles ont des
    // trous (ex. aucune lettre ne vaut 641) qui rendent certaines sommes
    // exactes impossibles à un nombre de lettres donné, même dans la bonne
    // fourchette de grandeur. §30 : jamais de résultat approximatif affiché
    // comme exact dans ce cas — un tableau vide, pas une erreur ni un plantage.
    const out = generateThalsams({
      targetWeight: 16641,
      length: { mode: 'exact', exact: 17 },
      ending: { mode: 'specific', selected: 'ش' },
    });
    expect(out.error).toBeUndefined();
    expect(out.results).toEqual([]);
  });
});

describe('generateThalsams — très gros poids cible (jusqu’à TARGET_WEIGHT_MAX)', () => {
  it('500 000 en auto/auto : résultats trouvés en un temps borné', () => {
    const start = Date.now();
    const out = generateThalsams({ targetWeight: 500_000, length: { mode: 'auto' }, ending: { mode: 'auto' } });
    expect(Date.now() - start).toBeLessThan(1000);
    expect(out.totalResults).toBeGreaterThan(0);
    for (const r of out.results) expect(r.totalWeight).toBe(500_000);
  });

  it('999 983 (nécessite ~1000 lettres) : résultats trouvés en un temps borné', () => {
    const start = Date.now();
    const out = generateThalsams({
      targetWeight: 999_983,
      length: { mode: 'auto' },
      ending: { mode: 'specific', selected: 'ش' },
    });
    expect(Date.now() - start).toBeLessThan(1000);
    expect(out.totalResults).toBeGreaterThan(0);
    for (const r of out.results) expect(r.totalWeight).toBe(999_983);
  });
});
