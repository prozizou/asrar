// lib/planetHourSelection.js — Sélection UNIQUE d'une heure planétaire sur
// /planete (horloge d'alarme cochée). Logique PURE, testée sans mock.
//
// Bug corrigé : la coche était calculée par NOM de planète
// (webAlarms[slug] / records[planet]) — cocher « Jupiter 18:45–19:45 »
// cochait aussi « Jupiter 01:43–02:43 ». Chaque heure a désormais un
// identifiant propre (hourIdOf) et une seule heure au plus est sélectionnée
// (selectedHourIdFrom renvoie UN id ou null), quel que soit le nombre
// d'occurrences d'une même planète dans la journée.

import { matchesOnce, planetSlug } from './planetWebAlarms';
import { alarmIdFor, alarmTimeFor } from './planetAlarms';

/**
 * Identifiant unique et stable d'une heure : période + rang + début + fin.
 * Stable d'un rendu à l'autre (dépend uniquement des données calculées), ne
 * dépend jamais du seul nom de planète.
 * @param {'day'|'night'} period
 * @param {number} index rang 0..11 dans la période
 * @param {{start:Date, end:Date}} row
 */
export function hourIdOf(period, index, row) {
  return `${period}-${index}-${row.start.getTime()}-${row.end.getTime()}`;
}

/**
 * Toutes les heures (jour puis nuit, donc chronologiques) avec leur id.
 * @param {{day:any[], night:any[]}} hours
 * @returns {Array<{id:string, row:any}>}
 */
export function hourEntries(hours) {
  return [
    ...hours.day.map((row, i) => ({ id: hourIdOf('day', i, row), row })),
    ...hours.night.map((row, i) => ({ id: hourIdOf('night', i, row), row })),
  ];
}

/**
 * L'heure actuellement sélectionnée (alarme programmée), ou null.
 *
 *   - web    : entrée RTDB liée à une heure précise (onceStartMs) → cette
 *              heure-là. Ancien format (alarme répétée, sans onceStartMs) →
 *              uniquement la PROCHAINE occurrence de la planète.
 *   - native : enregistrement avec startMs dont une alarme est encore en
 *              attente → cette heure. Ancien format → première heure dont
 *              l'id d'alarme est en attente.
 *
 * Toujours AU PLUS un id : la première correspondance dans l'ordre
 * chronologique l'emporte.
 *
 * @param {object} args
 * @param {Array<{id:string, row:any}>} args.entries
 * @param {'none'|'native'|'web'} args.mode
 * @param {Record<string,{offsetMin?:number, onceStartMs?:number|null}>} [args.webAlarms]
 * @param {Record<string,{prefs:{offsetMin:number}, scheduledIds:number[], startMs?:number|null}>} [args.records]
 * @param {Set<number>} [args.pendingIds]
 * @param {number} args.nowMs
 * @returns {string|null}
 */
export function selectedHourIdFrom({ entries, mode, webAlarms = {}, records = {}, pendingIds = new Set(), nowMs }) {
  if (mode === 'web') {
    for (const { id, row } of entries) {
      const cfg = webAlarms[planetSlug(row.planet) || ''];
      if (cfg && cfg.onceStartMs != null && matchesOnce(cfg, row)) return id;
    }
    for (const { id, row } of entries) {
      const cfg = webAlarms[planetSlug(row.planet) || ''];
      if (cfg && cfg.onceStartMs == null && row.start.getTime() > nowMs) return id;
    }
    return null;
  }
  if (mode === 'native') {
    for (const { id, row } of entries) {
      const rec = records[row.planet];
      if (!rec || !rec.scheduledIds.some((sid) => pendingIds.has(sid))) continue;
      if (rec.startMs != null) {
        if (matchesOnce({ onceStartMs: rec.startMs }, row)) return id;
      } else if (pendingIds.has(alarmIdFor(row.planet, alarmTimeFor(row.start.getTime(), rec.prefs.offsetMin)))) {
        return id;
      }
    }
  }
  return null;
}
