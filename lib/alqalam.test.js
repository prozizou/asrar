import { describe, it, expect, vi } from 'vitest';
vi.mock('./firebase', () => ({ db: {} }));
vi.mock('firebase/database', () => ({ ref: () => null, get: async () => null }));
import { countVerses, parseRepetitions, stepRepetitions, plural, buildIntercalatedText, config } from './alqalam';

describe('countVerses', () => {
  it('compte un verset par marqueur ﴾', () => {
    expect(countVerses('بسم ﴾١﴿ الحمد ﴾٢﴿ الرحمن ﴾٣﴿')).toBe(3);
  });
  it('accepte l’ancien format à parenthèses et le vide', () => {
    expect(countVerses('a (1) b (2)')).toBe(2);
    expect(countVerses('')).toBe(0);
    expect(countVerses(undefined)).toBe(0);
  });
  it('correspond aux insertions faites par l’intercalation', () => {
    const content = 'بسم ﴾١﴿ الحمد ﴾٢﴿';
    const out = buildIntercalatedText(content, 'X', 1);
    expect(out.split('X').length - 1).toBe(countVerses(content));
  });
});

describe('parseRepetitions', () => {
  it('accepte les entiers de 1 au maximum', () => {
    expect(parseRepetitions('1')).toBe(1);
    expect(parseRepetitions(' 250 ')).toBe(250);
    expect(parseRepetitions(String(config.MAX_TOTAL_REPEAT))).toBe(config.MAX_TOTAL_REPEAT);
  });
  it('refuse vide, zéro, négatif, décimal, texte et dépassement', () => {
    for (const v of ['', '0', '-3', '2.5', '1e3', 'abc', String(config.MAX_TOTAL_REPEAT + 1), null]) {
      expect(parseRepetitions(v)).toBeNull();
    }
  });
});

describe('stepRepetitions', () => {
  it('incrémente et décrémente dans les bornes', () => {
    expect(stepRepetitions('5', 1)).toBe(6);
    expect(stepRepetitions('1', -1)).toBe(1);
    expect(stepRepetitions(String(config.MAX_TOTAL_REPEAT), 1)).toBe(config.MAX_TOTAL_REPEAT);
    expect(stepRepetitions('', 1)).toBe(2);
  });
});

describe('plural', () => {
  it('accorde singulier et pluriel', () => {
    expect(plural(1, 'répétition')).toBe('1 répétition');
    expect(plural(0, 'verset')).toBe('0 verset');
    expect(plural(2, 'verset')).toBe('2 versets');
    expect(plural(30000, 'répétition').replace(/\s/g, ' ')).toBe('30 000 répétitions');
  });
});
