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
  it('« Plus tard » : 3 jours', () => {
    const later = afterAnswer(afterShown(fresh, T), 'later', T);
    expect(shouldPrompt({ now: T + 3 * DAY_MS - 1, state: later })).toBe(false);
    expect(shouldPrompt({ now: T + 3 * DAY_MS, state: later })).toBe(true);
  });
  it('fermer sans répondre garde seulement la limite d’un jour', () => {
    const closed = afterAnswer(afterShown(fresh, T), 'close', T);
    expect(closed.snoozeUntil).toBe(0);
    expect(shouldPrompt({ now: T + DAY_MS, state: closed })).toBe(true);
  });
  it('résiste à un état stocké corrompu', () => {
    expect(parseState('{pas du json')).toEqual({ lastShownAt: 0, snoozeUntil: 0 });
    expect(parseState(JSON.stringify({ lastShownAt: 'x', snoozeUntil: 5 }))).toEqual({ lastShownAt: 0, snoozeUntil: 5 });
  });
});

describe('Présentation à l’ouverture du menu', () => {
  it('une fois par session, pour tous les comptes', () => {
    expect(shouldPromptMenu({ sessionShown: false })).toBe(true);
    expect(shouldPromptMenu({ sessionShown: true })).toBe(false);
  });
});
