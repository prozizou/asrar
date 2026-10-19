// lib/planetHourChange.js — alertes « à chaque changement d'heure planétaire »
// (logique PURE, testée). Sert l'app Android : sans push web dans la WebView,
// les débuts d'heure sont programmés À L'AVANCE en notifications locales
// (lib/planetHourChangeNative.js), donc reçus même application fermée.
import { computePday, buildHourList, planetaryNotification } from './planete';

export const HOUR_CHANGE_HORIZON_H = 48; // fenêtre programmée, renouvelée à chaque visite

/**
 * Débuts d'heure planétaire à venir dans ]fromMs, fromMs + hoursAhead h],
 * jour ET nuit, triés et sans doublon. Les journées planétaires (lever →
 * lever) sont parcourues toutes les 12 h : chacune est donc vue au moins une fois.
 */
/**
 * @param {number} fromMs
 * @param {number} hoursAhead
 * @param {number} lat
 * @param {number} lng
 * @param {object} cache
 * @param {string} [timeZone]
 */
export function upcomingHourStarts(fromMs, hoursAhead, lat, lng, cache, timeZone = undefined) {
  const endMs = fromMs + hoursAhead * 3600e3;
  const noMatch = { isDay: null, idx: -1 };
  const seen = new Map();
  for (let t = fromMs - 24 * 3600e3; t <= endMs + 24 * 3600e3; t += 12 * 3600e3) {
    const pday = computePday(new Date(t), lat, lng, cache, timeZone);
    for (const isDay of [true, false]) {
      for (const row of buildHourList(pday, noMatch, isDay, timeZone)) {
        const ms = row.start.getTime();
        if (ms > fromMs && ms <= endMs && !seen.has(ms)) seen.set(ms, row);
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}

// Identifiant int32 stable par instant de début (à la minute) : 700 000 000 +
// minutes depuis 1970 (≈ 29,8 M en 2026) — plage distincte des rappels hijri
// (9xx xxx xxx) ; reprogrammer la même heure redonne le même id.
export function hourChangeIdFor(startMs) {
  return 700000000 + (Math.floor(startMs / 60000) % 100000000);
}

/**
 * @param {any} row
 * @param {string} [timeZone]
 */
export function hourChangeNotification(row, timeZone = undefined) {
  const { title, body } = planetaryNotification(row, row.start, timeZone);
  return { id: hourChangeIdFor(row.start.getTime()), title, body, at: row.start };
}
