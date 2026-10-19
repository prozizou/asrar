import { describe, it, expect } from 'vitest';
import { planetNow } from './hijriPlanet';

describe('planetNow', () => {
  it('lundi 10h sans position : jour de la Lune, heure de Mars', () => {
    // Lever/coucher par défaut 06:30/18:00 → heures de 57,5 min ; 10:00 = 4e heure.
    const r = planetNow(new Date(2026, 9, 19, 10, 0));
    expect(r.dayName).toBe('Lundi');
    expect(r.dayPlanet).toBe('Lune');
    expect(r.hourPlanet).toBe('Mars');
    expect(r.isDay).toBe(true);
    expect(r.approximate).toBe(true);
    expect(r.until.getTime()).toBeGreaterThan(new Date(2026, 9, 19, 10, 0).getTime());
  });

  it('la première heure du jour porte la planète du jour', () => {
    expect(planetNow(new Date(2026, 9, 19, 7, 0)).hourPlanet).toBe('Lune');
  });
});
