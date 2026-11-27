import { describe, it, expect } from 'vitest';
import { inFeedAdAfter, displaySurface, IN_FEED_EVERY } from './inFeedAds';

describe('encarts dans les listes', () => {
  it('place un encart toutes les 6 cartes', () => {
    expect(IN_FEED_EVERY).toBe(6);
    const after = Array.from({ length: 20 }, (_, i) => i).filter((i) => inFeedAdAfter(i, 20));
    expect(after).toEqual([5, 11, 17]);
  });
  it('jamais en fin de liste ni dans une liste courte', () => {
    expect(inFeedAdAfter(5, 6)).toBe(false);
    expect(Array.from({ length: 5 }, (_, i) => inFeedAdAfter(i, 5)).some(Boolean)).toBe(false);
    expect(inFeedAdAfter(5, 7)).toBe(true);
  });
});

describe('bannière native par écran', () => {
  it('associe chaque écran à sa surface', () => {
    expect(displaySurface('/')).toBe('home');
    expect(displaySurface('/menu')).toBe('menu');
    expect(displaySurface('/asrar')).toBe('secrets');
    expect(displaySurface('/bibliotheque')).toBe('library');
    expect(displaySurface('/zikr')).toBe('');
    expect(displaySurface('/menu/ressources')).toBe('');
  });
});
