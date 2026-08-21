import { describe, it, expect } from 'vitest';
import { computeNextStreak, badgeForStreak, STREAK_BADGES } from './dhikrStreak';

describe('computeNextStreak', () => {
  const day = (y, m, d) => new Date(y, m - 1, d);

  it("ne change rien si un objectif a déjà été atteint aujourd'hui", () => {
    const r = computeNextStreak({ current: 5, lastDateKey: '2026-01-10' }, day(2026, 1, 10));
    expect(r).toEqual({ current: 5, lastDateKey: '2026-01-10', changed: false });
  });

  it('incrémente la série si le dernier jour compté était hier', () => {
    const r = computeNextStreak({ current: 5, lastDateKey: '2026-01-10' }, day(2026, 1, 11));
    expect(r).toEqual({ current: 6, lastDateKey: '2026-01-11', changed: true });
  });

  it('réinitialise à 1 si un jour a été sauté', () => {
    const r = computeNextStreak({ current: 5, lastDateKey: '2026-01-08' }, day(2026, 1, 11));
    expect(r).toEqual({ current: 1, lastDateKey: '2026-01-11', changed: true });
  });

  it('première complétion (aucun historique) démarre la série à 1', () => {
    const r = computeNextStreak({ current: 0, lastDateKey: null }, day(2026, 1, 11));
    expect(r).toEqual({ current: 1, lastDateKey: '2026-01-11', changed: true });
  });

  it('gère le changement de mois pour "hier"', () => {
    const r = computeNextStreak({ current: 2, lastDateKey: '2026-01-31' }, day(2026, 2, 1));
    expect(r).toEqual({ current: 3, lastDateKey: '2026-02-01', changed: true });
  });
});

describe('badgeForStreak', () => {
  it('renvoie le badge exact au seuil franchi', () => {
    expect(badgeForStreak(3)).toEqual(STREAK_BADGES[0]);
    expect(badgeForStreak(7)).toEqual(STREAK_BADGES[1]);
  });

  it('renvoie null hors seuil (pas de badge à ce jour précis)', () => {
    expect(badgeForStreak(4)).toBeNull();
    expect(badgeForStreak(1)).toBeNull();
  });
});
