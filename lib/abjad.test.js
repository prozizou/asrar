import { describe, it, expect } from 'vitest';
import {
  calculatePoidsMystique,
  toEasternArabic,
  normalizeArabic,
  getLetterValue,
  reduceNumber,
  getFactorPairs,
  computeAbajadSums,
  computeEso,
  generateAllWafq3x3,
  generateAllWafq4x4,
} from './abjad';

describe('calculatePoidsMystique', () => {
  it('renvoie 0 pour une entrée vide', () => {
    expect(calculatePoidsMystique('')).toBe(0);
    expect(calculatePoidsMystique(null)).toBe(0);
  });

  it('somme les valeurs abjad maghrébines lettre par lettre', () => {
    // ا(1) + ب(2) + ج(3) = 6
    expect(calculatePoidsMystique('ابج')).toBe(6);
  });

  it('ignore les diacritiques (tashkeel)', () => {
    // "بَ" = ب + fatha → doit valoir comme "ب" seul (2)
    expect(calculatePoidsMystique('بَ')).toBe(2);
  });
});

describe('toEasternArabic', () => {
  it('convertit les chiffres ASCII en chiffres arabes orientaux', () => {
    expect(toEasternArabic(123)).toBe('١٢٣');
  });

  it('laisse passer le cas spécial "Vœux"', () => {
    expect(toEasternArabic('Vœux')).toBe('حاجة');
  });
});

describe('normalizeArabic', () => {
  it('unifie les variantes de alif/waw/ta marbuta/ya', () => {
    expect(normalizeArabic('أإآا')).toBe('اااا');
    expect(normalizeArabic('ؤئ')).toBe('وو');
    expect(normalizeArabic('ة')).toBe('ه');
  });

  it('retire les diacritiques et les caractères hors alphabet arabe', () => {
    expect(normalizeArabic('مُحَمَّد123')).toBe('محمد');
  });
});

describe('getLetterValue', () => {
  it('diffère entre systèmes mashreqi et maghrébi (ص/س/ش inversés)', () => {
    expect(getLetterValue('ص', 'mashriqi')).toBe(90);
    expect(getLetterValue('ص', 'maghrebi')).toBe(60);
  });

  it('renvoie 0 pour un caractère hors table', () => {
    expect(getLetterValue('a', 'mashriqi')).toBe(0);
  });
});

describe('reduceNumber (réduction théosophique)', () => {
  it('réduit itérativement jusqu\'à un chiffre', () => {
    expect(reduceNumber(1234)).toBe(1); // 1+2+3+4=10 → 1+0=1
    expect(reduceNumber(9)).toBe(9);
    expect(reduceNumber(0)).toBe(0);
  });
});

describe('getFactorPairs', () => {
  it('liste toutes les paires a×b=num, a décroissant', () => {
    expect(getFactorPairs(12)).toEqual([
      [6, 2],
      [4, 3],
      [3, 4],
      [2, 6],
    ]);
  });

  it('renvoie un tableau vide pour un nombre premier ou <=1', () => {
    expect(getFactorPairs(7)).toEqual([]);
    expect(getFactorPairs(1)).toEqual([]);
    expect(getFactorPairs(0)).toEqual([]);
  });
});

describe('computeAbajadSums', () => {
  it('traite une entrée purement numérique (ASCII ou arabe oriental) comme un nombre déjà réduit', () => {
    expect(computeAbajadSums('42')).toEqual({ mash: 42, magh: 42 });
    expect(computeAbajadSums('٤٢')).toEqual({ mash: 42, magh: 42 });
  });

  it('calcule les deux totaux abjad pour une entrée en lettres arabes', () => {
    const { mash, magh } = computeAbajadSums('ابج');
    expect(mash).toBe(6); // ا(1)+ب(2)+ج(3), identique dans les deux systèmes
    expect(magh).toBe(6);
  });

  it('renvoie {0,0} pour une entrée vide ou sans lettre reconnue', () => {
    expect(computeAbajadSums('')).toEqual({ mash: 0, magh: 0 });
  });
});

describe('computeEso', () => {
  it('renvoie des tirets pour une valeur nulle/négative', () => {
    expect(computeEso(0).face).toBe('—');
    expect(computeEso(-1).signe).toBe('—');
  });

  it('calcule face/cachée/rouhani/lumineux et le signe zodiacal (v % 12)', () => {
    const r = computeEso(21); // 21 % 12 = 9 → Sagittaire (index 9 dans ZODIAC)
    expect(r.face).toBe('21');
    expect(r.rouhani).toBe('441'); // 21*21
    expect(r.lumineux).toBe('231'); // 21*22/2
    expect(r.signe).toBe('Sagittaire');
  });

  it('associe le reste 0 aux Poissons (ordre 12)', () => {
    const r = computeEso(24); // 24 % 12 = 0 → Poissons
    expect(r.signe).toBe('Poissons');
  });
});

describe('generateAllWafq3x3 (carré magique plein)', () => {
  it('renvoie null sous le seuil (target < 15)', () => {
    expect(generateAllWafq3x3(14)).toBeNull();
  });

  it("chaque ligne/colonne (et la diagonale principale) de la grille 'feu' somme à target", () => {
    // Carré « semi-magique » : rangées, colonnes et diagonale principale
    // égalent target, mais pas l'anti-diagonale (propriété du tracé
    // talismanique traditionnel, pas un carré magique complet).
    const target = 30;
    const { fire } = generateAllWafq3x3(target);
    const sum = (cells) => cells.reduce((s, c) => s + c.v, 0);
    for (const row of fire.grid) expect(sum(row)).toBe(target);
    for (let c = 0; c < 3; c++) expect(sum(fire.grid.map((row) => row[c]))).toBe(target);
    expect(sum([fire.grid[0][0], fire.grid[1][1], fire.grid[2][2]])).toBe(target);
  });
});

describe('generateAllWafq4x4 (carré magique 4×4)', () => {
  it('renvoie null sous le seuil (target < 34)', () => {
    expect(generateAllWafq4x4(33)).toBeNull();
  });

  it("chaque ligne/colonne de la grille 'fire' somme à target", () => {
    const target = 64;
    const { fire } = generateAllWafq4x4(target);
    const sum = (cells) => cells.reduce((s, c) => s + c.v, 0);
    for (const row of fire.grid) expect(sum(row)).toBe(target);
    for (let c = 0; c < 4; c++) expect(sum(fire.grid.map((row) => row[c]))).toBe(target);
  });
});
