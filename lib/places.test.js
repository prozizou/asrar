import { describe, it, expect } from 'vitest';
import { parsePlaces } from './places';

describe('parsePlaces', () => {
  it('normalise les résultats Open-Meteo', () => {
    const r = parsePlaces({
      results: [
        { name: 'Matam', latitude: 15.65587, longitude: -13.25544, country: 'Sénégal', admin1: 'Matam', timezone: 'Africa/Dakar' },
        { name: 'Matam', latitude: 31.48, longitude: 74.14, country: 'Pakistan', admin1: 'Pendjab', timezone: 'Asia/Karachi' },
      ],
    });
    expect(r[0]).toEqual({ name: 'Matam', detail: 'Sénégal', lat: 15.65587, lng: -13.25544, timeZone: 'Africa/Dakar' });
    expect(r[1].detail).toBe('Pendjab, Pakistan');
  });

  it('ignore les entrées incomplètes et les réponses vides', () => {
    expect(parsePlaces({ results: [{ name: 'X' }, { latitude: 1, longitude: 2 }] })).toEqual([]);
    expect(parsePlaces({})).toEqual([]);
    expect(parsePlaces(null)).toEqual([]);
  });
});
