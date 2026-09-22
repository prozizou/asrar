import { describe, it, expect } from 'vitest';
import {
  WEB_OFFSET_CHOICES,
  WEB_ALARM_WINDOW_MS,
  planetSlug,
  planetFromSlug,
  validateWebOffset,
  webAlarmTriggerMs,
  dueWebAlarms,
} from './planetWebAlarms';
import { CHALDEAN_ORDER } from './planete';

describe('planetSlug / planetFromSlug', () => {
  it('mappe chaque planète chaldéenne vers un slug ASCII et retour', () => {
    for (const planet of CHALDEAN_ORDER) {
      const slug = planetSlug(planet);
      expect(slug).toBeTruthy();
      expect(slug).toMatch(/^[a-z]+$/); // pas d'accent ni de caractère réservé Firebase
      expect(planetFromSlug(slug)).toBe(planet);
    }
  });

  it('renvoie null pour une planète ou un slug inconnu', () => {
    expect(planetSlug('Pluton')).toBeNull();
    expect(planetFromSlug('pluton')).toBeNull();
  });
});

describe('validateWebOffset', () => {
  it('accepte les choix valides', () => {
    for (const o of WEB_OFFSET_CHOICES) expect(validateWebOffset(o)).toBe(o);
  });
  it('replie tout le reste sur 0', () => {
    expect(validateWebOffset(7)).toBe(0);
    expect(validateWebOffset(-5)).toBe(0);
    expect(validateWebOffset('10')).toBe(10); // coercition numérique
    expect(validateWebOffset('abc')).toBe(0);
    expect(validateWebOffset(undefined)).toBe(0);
    expect(validateWebOffset(null)).toBe(0);
  });
});

describe('webAlarmTriggerMs', () => {
  it('soustrait le délai en minutes', () => {
    const start = 1_000_000;
    expect(webAlarmTriggerMs(start, 0)).toBe(start);
    expect(webAlarmTriggerMs(start, 5)).toBe(start - 5 * 60000);
    expect(webAlarmTriggerMs(start, 15)).toBe(start - 15 * 60000);
  });
});

describe('dueWebAlarms', () => {
  const row = (planet, startMs) => ({ planet, start: new Date(startMs) });

  it('renvoie une occurrence dont le déclenchement vient de passer, dans la fenêtre', () => {
    const now = 10_000_000;
    const rows = [row('Jupiter', now)]; // offset 0 → trigger = now
    const due = dueWebAlarms({ rows, enabled: { jupiter: { offsetMin: 0 } }, nowMs: now });
    expect(due).toEqual([{ slug: 'jupiter', planet: 'Jupiter', triggerMs: now }]);
  });

  it('respecte le délai avant l\'heure', () => {
    const start = 10_000_000;
    const offsetMin = 10;
    const trigger = start - offsetMin * 60000;
    // now juste après le trigger (mais avant le début réel de l'heure)
    const due = dueWebAlarms({ rows: [row('Mars', start)], enabled: { mars: { offsetMin } }, nowMs: trigger + 1000 });
    expect(due).toEqual([{ slug: 'mars', planet: 'Mars', triggerMs: trigger }]);
  });

  it('ne renvoie rien si le déclenchement n\'est pas encore atteint', () => {
    const now = 10_000_000;
    const rows = [row('Jupiter', now + 60_000)]; // commence dans 1 min, offset 0
    expect(dueWebAlarms({ rows, enabled: { jupiter: { offsetMin: 0 } }, nowMs: now })).toEqual([]);
  });

  it('ne renvoie rien si la fenêtre est dépassée (occurrence ratée)', () => {
    const now = 10_000_000;
    const rows = [row('Jupiter', now - WEB_ALARM_WINDOW_MS - 1000)];
    expect(dueWebAlarms({ rows, enabled: { jupiter: { offsetMin: 0 } }, nowMs: now })).toEqual([]);
  });

  it('ne renvoie rien pour une planète non cochée', () => {
    const now = 10_000_000;
    const rows = [row('Saturne', now)];
    expect(dueWebAlarms({ rows, enabled: { jupiter: { offsetMin: 0 } }, nowMs: now })).toEqual([]);
  });

  it('déduplique via lastSentTrigger (ne renvoie pas une occurrence déjà envoyée)', () => {
    const now = 10_000_000;
    const rows = [row('Jupiter', now)];
    const enabled = { jupiter: { offsetMin: 0, lastSentTrigger: now } };
    expect(dueWebAlarms({ rows, enabled, nowMs: now })).toEqual([]);
  });

  it('renvoie une occurrence plus récente que lastSentTrigger', () => {
    const now = 10_000_000;
    const rows = [row('Jupiter', now)];
    const enabled = { jupiter: { offsetMin: 0, lastSentTrigger: now - 3_600_000 } };
    expect(dueWebAlarms({ rows, enabled, nowMs: now })).toEqual([
      { slug: 'jupiter', planet: 'Jupiter', triggerMs: now },
    ]);
  });

  it('garde une seule occurrence par planète (la plus récente dans la fenêtre)', () => {
    const now = 10_000_000;
    const older = now - 2 * 60000;
    const rows = [row('Jupiter', older), row('Jupiter', now)];
    const due = dueWebAlarms({ rows, enabled: { jupiter: { offsetMin: 0 } }, nowMs: now });
    expect(due).toEqual([{ slug: 'jupiter', planet: 'Jupiter', triggerMs: now }]);
  });

  it('gère plusieurs planètes cochées simultanément', () => {
    const now = 10_000_000;
    const rows = [row('Jupiter', now), row('Lune', now)];
    const due = dueWebAlarms({ rows, enabled: { jupiter: { offsetMin: 0 }, lune: { offsetMin: 0 } }, nowMs: now });
    expect(due).toHaveLength(2);
    expect(due.map((d) => d.slug).sort()).toEqual(['jupiter', 'lune']);
  });
});
