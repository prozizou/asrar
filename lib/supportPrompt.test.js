import { describe, it, expect } from 'vitest';
import { shouldPrompt, shouldPromptMenu, afterShown, afterAnswer, parseState, DAY_MS } from './supportPrompt';

const T = Date.UTC(2026, 10, 12, 10);
const fresh = parseState(null);

describe('Fenêtre « Soutenir ASRAR PRO »', () => {
  it('s’affiche pour un compte jamais sollicité, abonné ou non', () => {
    expect(shouldPrompt({ now: T, state: fresh })).toBe(true);
  });
  it('au plus une fois par jour', () => {
    const s = afterShown(fresh, T);
    expect(shouldPrompt({ now: T + DAY_MS - 1, state: s })).toBe(false);
    expect(shouldPrompt({ now: T + DAY_MS, state: s })).toBe(true);
  });
  it('« Plus tard » : 3 jours ; « J’ai déjà contribué » : 30 jours', () => {
    const later = afterAnswer(afterShown(fresh, T), 'later', T);
    expect(shouldPrompt({ now: T + 3 * DAY_MS - 1, state: later })).toBe(false);
    expect(shouldPrompt({ now: T + 3 * DAY_MS, state: later })).toBe(true);
    const done = afterAnswer(afterShown(fresh, T), 'contributed', T);
    expect(shouldPrompt({ now: T + 29 * DAY_MS, state: done })).toBe(false);
    expect(shouldPrompt({ now: T + 30 * DAY_MS, state: done })).toBe(true);
  });
  it('fermer sans répondre garde seulement la limite d’un jour', () => {
    const closed = afterAnswer(afterShown(fresh, T), 'close', T);
    expect(closed.snoozeUntil).toBe(0);
    expect(shouldPrompt({ now: T + DAY_MS, state: closed })).toBe(true);
  });
  it('résiste à un état stocké corrompu', () => {
    expect(parseState('{pas du json')).toEqual({ lastShownAt: 0, snoozeUntil: 0, contributedUntil: 0 });
    expect(parseState(JSON.stringify({ lastShownAt: 'x', snoozeUntil: 5 }))).toEqual({ lastShownAt: 0, snoozeUntil: 5, contributedUntil: 0 });
  });
});

describe('Présentation à l’ouverture du menu', () => {
  const now = 100 * DAY_MS;
  it('une fois par session', () => {
    expect(shouldPromptMenu({ now, state: parseState(null), sessionShown: false })).toBe(true);
    expect(shouldPromptMenu({ now, state: parseState(null), sessionShown: true })).toBe(false);
  });
  it('« Plus tard » et l’affichage du jour ne l’empêchent pas à la session suivante', () => {
    const state = afterAnswer(afterShown(parseState(null), now), 'later', now);
    expect(shouldPrompt({ now: now + 1000, state })).toBe(false);
    expect(shouldPromptMenu({ now: now + 1000, state, sessionShown: false })).toBe(true);
  });
  it('« J’ai déjà contribué » l’écarte 30 jours', () => {
    const state = afterAnswer(parseState(null), 'contributed', now);
    expect(shouldPromptMenu({ now: now + 29 * DAY_MS, state, sessionShown: false })).toBe(false);
    expect(shouldPromptMenu({ now: now + 31 * DAY_MS, state, sessionShown: false })).toBe(true);
  });
});
