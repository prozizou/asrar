import { describe, it, expect } from 'vitest';
import {
  getBZDHValue,
  addLignes,
  addFigures,
  figToKey,
  keyToFig,
  generateAllHouses,
  checkJudgeParity,
  restingFigures,
  figureToJsonIndex,
} from './geomancie';

describe('addLignes (addition géomantique)', () => {
  it('1+1=2 (pair), 1+2=1 (impair), 2+2=2 (pair)', () => {
    expect(addLignes(1, 1)).toBe(2);
    expect(addLignes(1, 2)).toBe(1);
    expect(addLignes(2, 2)).toBe(2);
  });
});

describe('addFigures / figToKey / keyToFig', () => {
  it('additionne deux figures ligne à ligne', () => {
    expect(addFigures([1, 1, 1, 1], [1, 1, 1, 1])).toEqual([2, 2, 2, 2]);
  });

  it('figToKey / keyToFig sont des opérations inverses', () => {
    const fig = [1, 2, 1, 2];
    expect(keyToFig(figToKey(fig))).toEqual(fig);
  });
});

describe('getBZDHValue', () => {
  it('somme 2/7/4/8 pour chaque ligne valant 1 (point simple)', () => {
    expect(getBZDHValue([1, 1, 1, 1])).toBe(2 + 7 + 4 + 8);
    expect(getBZDHValue([2, 2, 2, 2])).toBe(0);
    expect(getBZDHValue([1, 2, 1, 2])).toBe(2 + 4);
  });
});

describe('generateAllHouses', () => {
  // Les 4 Mères sont figées (16 combinaisons possibles, cf. restingFigures) :
  // on prend une figure connue et on vérifie la construction structurelle,
  // pas les valeurs exactes des 16 maisons (dépendantes de la table Firebase).
  const mothers = restingFigures.slice(0, 4).map((k) => keyToFig(k));

  it('renvoie 16 maisons', () => {
    expect(generateAllHouses(mothers)).toHaveLength(16);
  });

  it('les 4 premières maisons sont les Mères elles-mêmes (copie, pas la même référence)', () => {
    const houses = generateAllHouses(mothers);
    for (let i = 0; i < 4; i++) {
      expect(houses[i]).toEqual(mothers[i]);
      expect(houses[i]).not.toBe(mothers[i]);
    }
  });

  it('la maison 15 (Juge, index 14) est la somme des Témoins (12,13)', () => {
    const houses = generateAllHouses(mothers);
    expect(houses[14]).toEqual(addFigures(houses[12], houses[13]));
  });

  it('la maison 16 (Sentence, index 15) est la somme du Juge et de la 1re Mère', () => {
    const houses = generateAllHouses(mothers);
    expect(houses[15]).toEqual(addFigures(houses[14], houses[0]));
  });
});

describe('checkJudgeParity', () => {
  it('détecte un total pair/impair sur la maison du Juge (index 14)', () => {
    const houses = new Array(15).fill([1, 1, 1, 1]);
    houses[14] = [1, 1, 1, 1]; // total = 4 → pair
    expect(checkJudgeParity(houses)).toEqual({ even: true, total: 4 });
    houses[14] = [1, 1, 1, 2]; // total = 5 → impair
    expect(checkJudgeParity(houses)).toEqual({ even: false, total: 5 });
  });
});

describe('figureToJsonIndex', () => {
  it('couvre les 16 figures de restingFigures avec des index 1..16 uniques', () => {
    const indices = restingFigures.map((k) => figureToJsonIndex[k]);
    expect(new Set(indices).size).toBe(16);
    expect(Math.min(...indices)).toBe(1);
    expect(Math.max(...indices)).toBe(16);
  });
});
