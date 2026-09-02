import { describe, it, expect } from 'vitest';
import {
  natureOf,
  sunTimesFor,
  defaultSun,
  dateKey,
  sunOrDefault,
  computePday,
  currentHour,
  nextHour,
  phaseOf,
  CHALDEAN_ORDER,
} from './planete';

describe('dateKey', () => {
  it('formate en AAAA-MM-JJ avec zéro-padding', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('sunTimesFor (calcul NOAA hors-ligne)', () => {
  it('donne un lever avant le coucher, avec une durée du jour plausible, à Dakar (14.7°N)', () => {
    // Milieu d'année : ni solstice ni date suspecte, latitude non polaire.
    // On ne fige pas d'heure exacte (dépend du fuseau d'exécution et de la
    // longitude) : on vérifie la cohérence géométrique du résultat.
    const { sunrise, sunset } = sunTimesFor(new Date(2026, 5, 21), 14.7, -17.4);
    expect(sunrise.getTime()).toBeLessThan(sunset.getTime());
    const dayLengthH = (sunset.getTime() - sunrise.getTime()) / 3600000;
    expect(dayLengthH).toBeGreaterThan(10);
    expect(dayLengthH).toBeLessThan(14);
  });

  it('renvoie un jour polaire continu en été au cercle polaire', () => {
    const r = sunTimesFor(new Date(2026, 5, 21), 78, 15);
    expect(r.polar).toBe('jour');
  });

  it('renvoie une nuit polaire continue en hiver au cercle polaire', () => {
    const r = sunTimesFor(new Date(2026, 11, 21), 78, 15);
    expect(r.polar).toBe('nuit');
  });
});

describe('sunOrDefault', () => {
  it('utilise le cache API si présent (prioritaire sur le calcul NOAA)', () => {
    const date = new Date(2026, 5, 21);
    const cached = { sunrise: defaultSun(date, 6, 0), sunset: defaultSun(date, 19, 0) };
    const out = sunOrDefault(date, 14.7, -17.4, { [dateKey(date)]: cached });
    expect(out).toBe(cached);
  });

  it('retombe sur 06:30/18:00 sans position ni cache', () => {
    const date = new Date(2026, 5, 21);
    const out = sunOrDefault(date, null, null, null);
    expect(out.sunrise.getHours()).toBe(6);
    expect(out.sunrise.getMinutes()).toBe(30);
    expect(out.sunset.getHours()).toBe(18);
  });
});

describe('computePday (journée planétaire : lever → lever)', () => {
  const date = new Date(2026, 5, 21);
  const lat = 14.7, lng = -17.4;
  // Lever réel du jour (calculé, pas supposé) : sert à placer "avant"/"après".
  const { sunrise: realSunrise } = sunTimesFor(date, lat, lng);

  it('avant le lever du jour, reste rattaché à la journée de la veille', () => {
    const now = new Date(realSunrise.getTime() - 3600000); // 1h avant le lever réel
    const pday = computePday(now, lat, lng, null);
    // La journée en cours doit avoir commencé la veille.
    expect(pday.sunrise.getDate()).toBe(date.getDate() - 1);
  });

  it('après le lever, la journée planétaire est celle du jour même', () => {
    const now = new Date(realSunrise.getTime() + 3600000); // 1h après le lever réel
    const pday = computePday(now, lat, lng, null);
    expect(pday.sunrise.getDate()).toBe(date.getDate());
    expect(pday.sunrise.getTime()).toBeLessThan(now.getTime());
    expect(pday.nextSunrise.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe('currentHour', () => {
  it("identifie l'heure du lever comme diurne, index 0", () => {
    const pday = {
      sunrise: defaultSun(new Date(2026, 5, 21), 6, 0),
      sunset: defaultSun(new Date(2026, 5, 21), 18, 0),
      nextSunrise: defaultSun(new Date(2026, 5, 22), 6, 0),
      dayOfWeek: 0, // dimanche
    };
    const h = currentHour(pday.sunrise, pday);
    expect(h.isDay).toBe(true);
    expect(h.idx).toBe(0);
    // Dimanche, régent du jour = Soleil (1re heure diurne).
    expect(h.planet).toBe('Soleil');
    expect(CHALDEAN_ORDER).toContain(h.planet);
  });

  it('identifie la première heure nocturne juste après le coucher', () => {
    const pday = {
      sunrise: defaultSun(new Date(2026, 5, 21), 6, 0),
      sunset: defaultSun(new Date(2026, 5, 21), 18, 0),
      nextSunrise: defaultSun(new Date(2026, 5, 22), 6, 0),
      dayOfWeek: 0,
    };
    const h = currentHour(pday.sunset, pday);
    expect(h.isDay).toBe(false);
    expect(h.idx).toBe(0);
  });

  it("donne les bornes (start/end) de l'heure en cours — utilisées pour le temps restant du tableau de bord", () => {
    const pday = {
      sunrise: defaultSun(new Date(2026, 5, 21), 6, 0), // 12h de jour → 1h/heure
      sunset: defaultSun(new Date(2026, 5, 21), 18, 0),
      nextSunrise: defaultSun(new Date(2026, 5, 22), 6, 0),
      dayOfWeek: 0,
    };
    const now = defaultSun(new Date(2026, 5, 21), 6, 20); // 20 min dans la 1re heure (6h-7h)
    const h = currentHour(now, pday);
    expect(h.idx).toBe(0);
    expect(h.start.getTime()).toBe(pday.sunrise.getTime());
    expect(h.end.getTime()).toBe(defaultSun(new Date(2026, 5, 21), 7, 0).getTime());
  });
});

describe('nextHour', () => {
  const pday = {
    sunrise: defaultSun(new Date(2026, 5, 21), 6, 0),
    sunset: defaultSun(new Date(2026, 5, 21), 18, 0),
    nextSunrise: defaultSun(new Date(2026, 5, 22), 6, 0),
    dayOfWeek: 0, // dimanche
  };

  it('donne la 2e heure diurne juste après la 1re', () => {
    const cur = currentHour(pday.sunrise, pday);
    const next = nextHour(pday, cur);
    expect(next).not.toBeNull();
    expect(next.isDay).toBe(true);
    expect(next.idx).toBe(1);
    expect(next.start.getTime()).toBe(cur.end.getTime()); // contiguës, aucun trou
  });

  it('bascule jour→nuit à la fin de la 12e heure diurne', () => {
    const cur = currentHour(new Date(pday.sunset.getTime() - 1), pday); // juste avant le coucher
    expect(cur.isDay).toBe(true);
    expect(cur.idx).toBe(11);
    const next = nextHour(pday, cur);
    expect(next).not.toBeNull();
    expect(next.isDay).toBe(false);
    expect(next.idx).toBe(0);
    expect(next.start.getTime()).toBe(pday.sunset.getTime());
  });

  it('renvoie null après la toute dernière heure nocturne (jour suivant, hors périmètre)', () => {
    const cur = currentHour(new Date(pday.nextSunrise.getTime() - 1), pday); // juste avant le lever suivant
    expect(cur.isDay).toBe(false);
    expect(cur.idx).toBe(11);
    expect(nextHour(pday, cur)).toBeNull();
  });
});

describe('natureOf', () => {
  it('Vénus et Jupiter sont "Très favorable"', () => {
    expect(natureOf('Vénus').txt).toBe('Très favorable');
    expect(natureOf('Jupiter').txt).toBe('Très favorable');
  });

  it('Mars et Saturne sont "Défavorable"', () => {
    expect(natureOf('Mars').txt).toBe('Défavorable');
    expect(natureOf('Saturne').txt).toBe('Défavorable');
  });

  it('Mercure dépend de la fraction (1re moitié favorable, 2de défavorable)', () => {
    expect(natureOf('Mercure', 0.2).cls).toBe('nat-fav');
    expect(natureOf('Mercure', 0.8).cls).toBe('nat-def');
    expect(natureOf('Mercure', null).cls).toBe('nat-mix');
  });
});

describe('phaseOf', () => {
  it('reconnaît le plein jour entre lever+30min et coucher-30min', () => {
    const sunrise = defaultSun(new Date(2026, 5, 21), 6, 0);
    const sunset = defaultSun(new Date(2026, 5, 21), 18, 0);
    const midday = defaultSun(new Date(2026, 5, 21), 12, 0);
    expect(phaseOf(midday, sunrise, sunset).name).toBe('Jour sacré');
  });

  it('reconnaît la nuit bien après le coucher', () => {
    const sunrise = defaultSun(new Date(2026, 5, 21), 6, 0);
    const sunset = defaultSun(new Date(2026, 5, 21), 18, 0);
    const night = defaultSun(new Date(2026, 5, 21), 22, 0);
    expect(phaseOf(night, sunrise, sunset).name).toBe('Nuit des secrets');
  });
});
