import { describe, it, expect, beforeEach } from 'vitest';
import { readGate, writeGate, clearGate, isAdFailure, resolveAttempt, FAILURES_BEFORE_RELEASE } from './zikrAdGate';

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

  it('autorise une nouvelle tentative après un premier échec', () => {
    const outcome = resolveAttempt({ ok: false, reason: 'no_fill' }, 0);
    expect(outcome.unlock).toBe(false);
    expect(outcome.failures).toBe(1);
  });

  it('lève le verrou après plusieurs échecs : jamais d’enfermement par notre faute', () => {
    let failures = 0;
    let outcome = { unlock: false, failures: 0, message: '' };
    for (let i = 0; i < FAILURES_BEFORE_RELEASE; i++) {
      outcome = resolveAttempt({ ok: false, reason: 'no_fill' }, failures);
      failures = outcome.failures;
    }
    expect(outcome.unlock).toBe(true);
    expect(outcome.message).toContain('vous pouvez continuer');
  });

  it('lève le verrou pour une raison inconnue plutôt que d’enfermer', () => {
    expect(resolveAttempt({ ok: false, reason: 'inconnue' }, 0).unlock).toBe(true);
  });
});

describe('isAdFailure', () => {
  it('reconnaît les pannes de publicité', () => {
    for (const reason of ['no_fill', 'error', 'unavailable', 'paused']) expect(isAdFailure(reason)).toBe(true);
    expect(isAdFailure('skipped')).toBe(false);
    expect(isAdFailure('pending')).toBe(false);
  });
});
