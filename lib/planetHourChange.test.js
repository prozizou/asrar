import { describe, it, expect } from 'vitest';
import { upcomingHourStarts, hourChangeIdFor, hourChangeNotification } from './planetHourChange';

// Matam (Sénégal) — lever/coucher réels toute l'année.
const LAT = 15.65587, LNG = -13.25544;

describe('upcomingHourStarts', () => {
  const from = Date.UTC(2026, 9, 19, 19, 38);
  const rows = upcomingHourStarts(from, 48, LAT, LNG, {}, 'Africa/Dakar');

  it('≈ 24 heures planétaires par jour, toutes dans la fenêtre, triées', () => {
    expect(rows.length).toBeGreaterThanOrEqual(46);
    expect(rows.length).toBeLessThanOrEqual(50);
    for (let i = 0; i < rows.length; i++) {
      const ms = rows[i].start.getTime();
      expect(ms).toBeGreaterThan(from);
      expect(ms).toBeLessThanOrEqual(from + 48 * 3600e3);
      if (i) expect(ms).toBeGreaterThan(rows[i - 1].start.getTime());
    }
  });

  it('heures contiguës : chaque fin est le début de la suivante', () => {
    for (let i = 1; i < rows.length; i++) {
      expect(Math.abs(rows[i - 1].end.getTime() - rows[i].start.getTime())).toBeLessThan(1000);
    }
  });
});

describe('hourChangeIdFor / hourChangeNotification', () => {
  it('id stable, int32, hors de la plage des rappels hijri', () => {
    const ms = Date.UTC(2026, 9, 19, 20, 32);
    expect(hourChangeIdFor(ms)).toBe(hourChangeIdFor(ms + 30e3));
    expect(hourChangeIdFor(ms)).toBeLessThan(900000000);
    expect(hourChangeIdFor(ms)).toBeGreaterThanOrEqual(700000000);
  });

  it('contenu : planète, nature et heure de fin', () => {
    const [row] = upcomingHourStarts(Date.UTC(2026, 9, 19, 12), 3, LAT, LNG, {}, 'Africa/Dakar');
    const n = hourChangeNotification(row, 'Africa/Dakar');
    expect(n.title).toContain(row.planet);
    expect(n.body).toMatch(/jusqu’à \d\d:\d\d/);
    expect(n.at).toEqual(row.start);
  });
});
