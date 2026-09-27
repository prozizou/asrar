import { describe, it, expect } from 'vitest';
import { hourIdOf, hourEntries, selectedHourIdFrom } from './planetHourSelection';
import { alarmIdFor } from './planetAlarms';

const H = 3600_000;
const t0 = Date.UTC(2026, 8, 27, 7, 0, 0);
const row = (planet, startMs) => ({ planet, start: new Date(startMs), end: new Date(startMs + H) });

// Jupiter apparaît deux fois : jour (rang 0) et nuit (rang 2).
const hours = {
  day: [row('Jupiter', t0), row('Mars', t0 + H), row('Soleil', t0 + 2 * H)],
  night: [row('Vénus', t0 + 12 * H), row('Mercure', t0 + 13 * H), row('Jupiter', t0 + 14 * H)],
};
const entries = hourEntries(hours);
const idJupiterJour = hourIdOf('day', 0, hours.day[0]);
const idJupiterNuit = hourIdOf('night', 2, hours.night[2]);

describe('hourIdOf / hourEntries', () => {
  it('donne un id distinct à chaque occurrence, même planète', () => {
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(idJupiterJour).not.toBe(idJupiterNuit);
  });

  it('est stable entre deux calculs (re-render)', () => {
    expect(hourEntries(hours).map((e) => e.id)).toEqual(entries.map((e) => e.id));
  });
});

describe('selectedHourIdFrom — web', () => {
  it("coche seulement l'occurrence choisie, jamais les deux Jupiter", () => {
    const webAlarms = { jupiter: { offsetMin: 0, onceStartMs: t0 + 14 * H } };
    expect(selectedHourIdFrom({ entries, mode: 'web', webAlarms, nowMs: t0 - H })).toBe(idJupiterNuit);
    const jour = { jupiter: { offsetMin: 0, onceStartMs: t0 } };
    expect(selectedHourIdFrom({ entries, mode: 'web', webAlarms: jour, nowMs: t0 - H })).toBe(idJupiterJour);
  });

  it("ancien format (répété) : seule la prochaine occurrence est cochée", () => {
    const webAlarms = { jupiter: { offsetMin: 0, onceStartMs: null } };
    expect(selectedHourIdFrom({ entries, mode: 'web', webAlarms, nowMs: t0 + 30 * 60000 })).toBe(idJupiterNuit);
  });

  it('plusieurs entrées : un seul id renvoyé', () => {
    const webAlarms = { jupiter: { onceStartMs: t0 + 14 * H }, mars: { onceStartMs: t0 + H } };
    expect(selectedHourIdFrom({ entries, mode: 'web', webAlarms, nowMs: t0 - H })).toBe(hourIdOf('day', 1, hours.day[1]));
  });

  it('rien de coché sans alarme', () => {
    expect(selectedHourIdFrom({ entries, mode: 'web', webAlarms: {}, nowMs: t0 })).toBeNull();
    expect(selectedHourIdFrom({ entries, mode: 'none', nowMs: t0 })).toBeNull();
  });
});

describe('selectedHourIdFrom — natif', () => {
  const prefs = { offsetMin: 0 };

  it("coche l'heure enregistrée (startMs) si son alarme est en attente", () => {
    const id = alarmIdFor('Jupiter', t0 + 14 * H);
    const records = { Jupiter: { prefs, scheduledIds: [id], startMs: t0 + 14 * H } };
    expect(selectedHourIdFrom({ entries, mode: 'native', records, pendingIds: new Set([id]), nowMs: t0 })).toBe(idJupiterNuit);
    expect(selectedHourIdFrom({ entries, mode: 'native', records, pendingIds: new Set(), nowMs: t0 })).toBeNull();
  });

  it("ancien enregistrement : l'heure dont l'id d'alarme est en attente", () => {
    const id = alarmIdFor('Jupiter', t0);
    const records = { Jupiter: { prefs, scheduledIds: [id], startMs: null } };
    expect(selectedHourIdFrom({ entries, mode: 'native', records, pendingIds: new Set([id]), nowMs: t0 - H })).toBe(idJupiterJour);
  });
});
