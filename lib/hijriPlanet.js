// lib/hijriPlanet.js — planète du jour et heure planétaire du moment, pour
// croiser la phase du mois hijri (lib/hijriPhases.js) avec le module Planète.
// `lat`/`lng` null → lever/coucher par défaut (06:30 / 18:00), voir
// lib/planete.js (sunOrDefault).
import { DAY_PLANETS, computePday, currentHour, planetaryHourState, CHALDEAN_EMOJIS } from './planete';

/**
 * @param {Date} now
 * @param {number|null} [lat]
 * @param {number|null} [lng]
 */
export function planetNow(now, lat = null, lng = null) {
  const pday = computePday(now, lat, lng, undefined);
  const hour = planetaryHourState(currentHour(now, pday), now);
  const dayPlanet = DAY_PLANETS.planetNames[pday.dayOfWeek];
  return {
    dayName: DAY_PLANETS.names[pday.dayOfWeek],
    dayPlanet,
    dayEmoji: CHALDEAN_EMOJIS[dayPlanet],
    hourPlanet: hour.planet,
    hourEmoji: CHALDEAN_EMOJIS[hour.planet],
    nature: hour.nature,
    until: hour.validUntil,
    isDay: hour.isDay,
    approximate: lat == null || lng == null,
  };
}
