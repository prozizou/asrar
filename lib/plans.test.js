import { describe, it, expect } from 'vitest';
import { parseAllowed, SUB_PLANS, PREMIUM_LEVEL, SUPER_ADMIN_EMAIL } from './plans';

// parseAllowed() est la logique du paywall pour allowedUsers/{clé} — elle est
// évaluée à l'identique côté client (lib/access.js) et côté serveur
// (server/access.js, la vraie barrière). Toute régression ici casserait soit
// l'affichage, soit l'accès réel : couverture prioritaire.
describe('parseAllowed', () => {
  const NOW = 1_700_000_000_000;

  it('refuse un accès absent', () => {
    expect(parseAllowed(null, NOW)).toEqual({ active: false, level: 0 });
    expect(parseAllowed(undefined, NOW)).toEqual({ active: false, level: 0 });
  });

  it('accepte la valeur héritée true (accès à vie, palier inconnu)', () => {
    expect(parseAllowed(true, NOW)).toEqual({ active: true, level: 0 });
  });

  it('traite un timestamp brut hérité comme une expiration sans palier', () => {
    expect(parseAllowed(NOW + 1000, NOW)).toEqual({ active: true, level: 0 });
    expect(parseAllowed(NOW - 1000, NOW)).toEqual({ active: false, level: 0 });
  });

  it('lit { until, level } avec until=true (à vie) ou null (à vie, legacy)', () => {
    expect(parseAllowed({ until: true, level: 45000 }, NOW)).toEqual({ active: true, level: 45000 });
    expect(parseAllowed({ until: null, level: 15000 }, NOW)).toEqual({ active: true, level: 15000 });
  });

  it('lit { until: <timestamp>, level } avant/après expiration', () => {
    expect(parseAllowed({ until: NOW + 1, level: 25000 }, NOW)).toEqual({ active: true, level: 25000 });
    expect(parseAllowed({ until: NOW - 1, level: 25000 }, NOW)).toEqual({ active: false, level: 25000 });
  });

  it('ramène un level non numérique à 0', () => {
    expect(parseAllowed({ until: true, level: 'x' }, NOW)).toEqual({ active: true, level: 0 });
    expect(parseAllowed({ until: true, level: undefined }, NOW)).toEqual({ active: true, level: 0 });
  });

  it('rejette un type inattendu (chaîne, tableau…)', () => {
    expect(parseAllowed('nope', NOW)).toEqual({ active: false, level: 0 });
  });
});

describe('configuration des paliers', () => {
  it('PREMIUM_LEVEL correspond au palier le plus élevé de SUB_PLANS', () => {
    const max = Math.max(...SUB_PLANS.map((p) => p.level));
    expect(PREMIUM_LEVEL).toBe(max);
  });

  it("SUPER_ADMIN_EMAIL est une adresse e-mail plausible", () => {
    expect(SUPER_ADMIN_EMAIL).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });
});
