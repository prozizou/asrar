import { describe, it, expect } from 'vitest';
import {
  stripDiacritics,
  abjadWeight,
  countCombinations,
  hasAllah,
  describeCombo,
  resultSearchText,
  NAMES,
  NAMES_SORTED,
  NUM_NAMES,
  searchCombinations,
} from './combinaisons';

describe('stripDiacritics', () => {
  it('retire le tashkeel sans toucher aux lettres', () => {
    expect(stripDiacritics('مُحَمَّد')).toBe('محمد');
  });
});

describe('abjadWeight', () => {
  it('somme les valeurs abjad (ا=1, ب=2, ج=3)', () => {
    expect(abjadWeight('ابج')).toBe(6);
  });

  it('ignore les caractères hors table', () => {
    expect(abjadWeight('a1!')).toBe(0);
  });
});

describe('countCombinations (C(n,k))', () => {
  it('valeurs connues', () => {
    expect(countCombinations(5, 2)).toBe(10);
    expect(countCombinations(10, 0)).toBe(1);
    expect(countCombinations(10, 10)).toBe(1);
  });

  it('renvoie 0 si k>n ou k<0', () => {
    expect(countCombinations(3, 5)).toBe(0);
    expect(countCombinations(3, -1)).toBe(0);
  });
});

describe('NAMES / NAMES_SORTED (table des 99 Noms)', () => {
  it('contient les 99 Noms + Allah lui-même (100 entrées, cf. NAMES_DATA)', () => {
    expect(NAMES).toHaveLength(100);
    expect(NUM_NAMES).toBe(100);
  });

  it('NAMES_SORTED est trié par poids croissant', () => {
    for (let i = 1; i < NAMES_SORTED.length; i++) {
      expect(NAMES_SORTED[i].weight).toBeGreaterThanOrEqual(NAMES_SORTED[i - 1].weight);
    }
  });

  it('contient "Allah" (forme propre "الله")', () => {
    expect(NAMES.some((n) => n.clean === 'الله')).toBe(true);
  });
});

describe('hasAllah / describeCombo / resultSearchText', () => {
  const allahIdx = NAMES_SORTED.findIndex((n) => n.clean === 'الله');
  const otherIdx = NAMES_SORTED.findIndex((n) => n.clean !== 'الله');

  it('hasAllah détecte la présence du Nom suprême dans une combinaison', () => {
    expect(hasAllah([allahIdx, otherIdx])).toBe(true);
    expect(hasAllah([otherIdx])).toBe(false);
  });

  it('describeCombo calcule le total et la formule', () => {
    const idx = [otherIdx];
    const { total, formula, isAllah } = describeCombo(idx);
    expect(total).toBe(NAMES_SORTED[otherIdx].weight);
    expect(formula).toContain('=');
    expect(isAllah).toBe(false);
  });

  it('resultSearchText inclut le nom affiché, la traduction et le poids', () => {
    const txt = resultSearchText([otherIdx]);
    const n = NAMES_SORTED[otherIdx];
    expect(txt).toContain(String(n.weight));
    expect(txt).toBe(txt.toLowerCase());
  });
});

describe('searchCombinations (backtracking)', () => {
  it('trouve au moins une combinaison de k=1 noms dont le poids exact existe dans la table', () => {
    const target = NAMES_SORTED[0].weight;
    return searchCombinations({ target, k: 1, shouldStop: () => false, onProgress: () => {} }).then((res) => {
      expect(res.stopped).toBe(false);
      expect(res.results.length).toBeGreaterThan(0);
      for (const combo of res.results) {
        const total = combo.reduce((s, i) => s + NAMES_SORTED[i].weight, 0);
        expect(total).toBe(target);
      }
    });
  });

  it("ne renvoie aucun résultat pour une cible manifestement inatteignable", () => {
    return searchCombinations({ target: 999999999, k: 2, shouldStop: () => false, onProgress: () => {} }).then(
      (res) => {
        expect(res.results).toEqual([]);
      }
    );
  });

  it('honore shouldStop() en arrêtant la recherche', () => {
    return searchCombinations({ target: 5000, k: 4, shouldStop: () => true, onProgress: () => {} }).then((res) => {
      expect(res.stopped).toBe(true);
    });
  });
});
