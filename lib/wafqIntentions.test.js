import { describe, it, expect } from 'vitest';
import { WAFQ_INTENTIONS, DEFAULT_WAFQ_INTENTION_ID, findWafqIntention } from './wafqIntentions';

describe('WAFQ_INTENTIONS', () => {
  it('a des ids uniques, un texte arabe et des mots-clés pour chaque intention', () => {
    const ids = WAFQ_INTENTIONS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of WAFQ_INTENTIONS) {
      expect(i.arabic).toBeTruthy();
      expect(i.label).toBeTruthy();
      expect(i.benefit).toBeTruthy();
    }
  });
});

describe('findWafqIntention', () => {
  it('retrouve une intention par id', () => {
    expect(findWafqIntention('rizq').id).toBe('rizq');
  });

  it('replie sur la première intention si id inconnu ou absent', () => {
    expect(findWafqIntention('inconnue').id).toBe(DEFAULT_WAFQ_INTENTION_ID);
    expect(findWafqIntention(undefined).id).toBe(DEFAULT_WAFQ_INTENTION_ID);
  });
});
