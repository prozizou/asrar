import { describe, it, expect, beforeEach } from 'vitest';
import { readGate, writeGate, clearGate, isAdFailure, resolveAttempt } from './zikrAdGate';

function fakeStorage() {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) };
}

describe('état persistant du verrou', () => {
  beforeEach(() => { globalThis.localStorage = fakeStorage(); });

  it('conserve le palier verrouillé par groupe et par compte', () => {
    expect(readGate('g1', 'u1')).toBe(0);
    writeGate('g1', 'u1', 300);
    expect(readGate('g1', 'u1')).toBe(300);
    expect(readGate('g1', 'u2')).toBe(0);
    expect(readGate('g2', 'u1')).toBe(0);
    clearGate('g1', 'u1');
    expect(readGate('g1', 'u1')).toBe(0);
  });

  it('ne plante pas quand le stockage est indisponible', () => {
    globalThis.localStorage = { getItem() { throw new Error('refusé'); }, setItem() { throw new Error('refusé'); }, removeItem() { throw new Error('refusé'); } };
    expect(readGate('g', 'u')).toBe(0);
    expect(() => writeGate('g', 'u', 100)).not.toThrow();
    expect(() => clearGate('g', 'u')).not.toThrow();
  });
});

describe('resolveAttempt', () => {
  it('lève le verrou quand la vidéo est confirmée', () => {
    expect(resolveAttempt({ ok: true }, 1)).toEqual({ unlock: true, failures: 0, message: '' });
  });

  it('lève le verrou quand la vidéo a été vue mais le crédit est en attente', () => {
    expect(resolveAttempt({ ok: false, reason: 'pending' }).unlock).toBe(true);
  });

  it('garde le verrou quand l’utilisateur interrompt la vidéo', () => {
    const outcome = resolveAttempt({ ok: false, reason: 'skipped' }, 1);
    expect(outcome.unlock).toBe(false);
    expect(outcome.failures).toBe(1);
    expect(outcome.message).toContain('jusqu’au bout');
  });

  it('garde le verrou sans message quand l’utilisateur annule avant la vidéo', () => {
    expect(resolveAttempt({ ok: false, reason: 'cancelled' }, 1)).toEqual({ unlock: false, failures: 1, message: '' });
  });

  it('garde le verrou quand aucune vidéo n’est disponible et invite à réessayer', () => {
    const outcome = resolveAttempt({ ok: false, reason: 'no_fill' }, 0);
    expect(outcome.unlock).toBe(false);
    expect(outcome.failures).toBe(1);
    expect(outcome.message).toContain('Aucune vidéo disponible');
    expect(outcome.message).toContain('Réessayez');
  });

  it('ne lève JAMAIS le verrou après des échecs répétés (mode avion, bloqueur de publicités)', () => {
    let failures = 0;
    for (let i = 0; i < 10; i++) {
      const outcome = resolveAttempt({ ok: false, reason: i % 2 ? 'error' : 'no_fill' }, failures);
      expect(outcome.unlock).toBe(false);
      failures = outcome.failures;
    }
    expect(failures).toBe(10);
  });

  it('signale une coupure réseau et une vidéo impossible sur l’appareil', () => {
    expect(resolveAttempt({ ok: false, reason: 'error' }).message).toContain('connexion');
    expect(resolveAttempt({ ok: false, reason: 'unavailable' }).message).toContain('cet appareil');
    expect(resolveAttempt({ ok: false, reason: 'inconnue' }).unlock).toBe(false);
  });
});

describe('isAdFailure', () => {
  it('reconnaît les pannes de publicité', () => {
    for (const reason of ['no_fill', 'error', 'unavailable', 'paused']) expect(isAdFailure(reason)).toBe(true);
    expect(isAdFailure('skipped')).toBe(false);
    expect(isAdFailure('pending')).toBe(false);
  });
});
