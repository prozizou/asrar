'use client';
// lib/planetAlarmPrefsStore.js — Persistance locale (PAR APPAREIL, pas par
// compte) des préférences d'alarme d'heure planétaire, une entrée par
// planète : { [planet]: { prefs, scheduledIds } }. localStorage plutôt que
// RTDB — un réglage d'alarme n'a de sens que sur CET appareil (revue produit
// du 2026-09-22 : « le réglage est par appareil, pas par compte »).
//
// `scheduledIds` (ids Capacitor LocalNotifications déjà programmés pour
// cette planète, voir lib/planetAlarmsNative.js) est la source de vérité
// pour une annulation ultérieure — jamais recalculée à partir de `prefs`,
// qui a pu changer depuis la dernière planification.

import { validateAlarmPrefs } from './planetAlarms';

const KEY = 'asrar_planet_alarms';

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}

/**
 * @param {string} planet
 * @returns {{prefs: object, scheduledIds: number[]}} jamais `undefined` —
 *   des préférences par défaut et une liste vide si rien n'est enregistré.
 */
export function getPlanetAlarmRecord(planet) {
  const rec = readAll()[planet];
  return {
    prefs: validateAlarmPrefs(rec && rec.prefs),
    scheduledIds: rec && Array.isArray(rec.scheduledIds) ? rec.scheduledIds : [],
  };
}

/**
 * @returns {Record<string, {prefs: object, scheduledIds: number[]}>} toutes
 *   les planètes ayant un enregistrement (même vide en scheduledIds).
 */
export function getAllPlanetAlarmRecords() {
  const all = readAll();
  /** @type {Record<string, {prefs: object, scheduledIds: number[]}>} */
  const result = {};
  for (const planet of Object.keys(all)) result[planet] = getPlanetAlarmRecord(planet);
  return result;
}

export function savePlanetAlarmRecord(planet, { prefs, scheduledIds }) {
  const all = readAll();
  all[planet] = { prefs: validateAlarmPrefs(prefs), scheduledIds: Array.isArray(scheduledIds) ? scheduledIds : [] };
  writeAll(all);
}

export function clearPlanetAlarmRecord(planet) {
  const all = readAll();
  delete all[planet];
  writeAll(all);
}
