import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, __resetRateLimitForTests } from './rateLimit';

describe('rateLimit', () => {
  beforeEach(() => __resetRateLimitForTests());

  it('autorise jusqu\'à `limit` requêtes dans la fenêtre, puis bloque', () => {
    const now = 1_000_000;
    expect(rateLimit('k', 3, 1000, now)).toBe(true);
    expect(rateLimit('k', 3, 1000, now + 10)).toBe(true);
    expect(rateLimit('k', 3, 1000, now + 20)).toBe(true);
    expect(rateLimit('k', 3, 1000, now + 30)).toBe(false); // 4e requête, fenêtre pleine
  });

  it('les clés sont indépendantes (pas de contamination entre uid)', () => {
    const now = 2_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit('a', 3, 1000, now + i)).toBe(true);
    expect(rateLimit('a', 3, 1000, now + 3)).toBe(false);
    expect(rateLimit('b', 3, 1000, now + 3)).toBe(true); // clé différente, non affectée
  });

  it('la fenêtre glisse : une requête ancienne sort du compte', () => {
    const now = 3_000_000;
    expect(rateLimit('k', 2, 1000, now)).toBe(true);
    expect(rateLimit('k', 2, 1000, now + 100)).toBe(true);
    expect(rateLimit('k', 2, 1000, now + 200)).toBe(false); // fenêtre pleine
    expect(rateLimit('k', 2, 1000, now + 1001)).toBe(true); // la 1re requête (now) est sortie de la fenêtre
  });
});
