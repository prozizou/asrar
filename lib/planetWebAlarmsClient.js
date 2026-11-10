'use client';
// lib/planetWebAlarmsClient.js — Accès client aux alarmes web d'heure
// planétaire (pages/api/planet-web-alarm.js). Passe par apiPost (lib/api.js),
// qui injecte le jeton Firebase et borne la requête dans le temps.
//
// Pendant web de lib/planetAlarmPrefsStore.js (natif, localStorage) : ici le
// réglage vit côté serveur (par compte), car c'est un cron serveur — pas
// l'appareil — qui déclenchera le push.

import { apiPost } from './api';

/**
 * Planètes actuellement cochées pour ce compte.
 * @returns {Promise<Record<string, {offsetMin:number, onceStartMs:number|null}>>} indexé par slug.
 */
export async function getWebAlarms() {
  const data = await apiPost('planet-web-alarm', { action: 'list' });
  return (data && data.alarms) || {};
}

/**
 * Coche (`enabled=true`) ou décoche une planète.
 * @param {string} planet nom français (CHALDEAN_ORDER)
 * @param {boolean} enabled
 * @param {number} [offsetMin] délai avant l'heure (ignoré si enabled=false)
 * @param {number|null} [startMs] début de l'heure précise visée (sélection
 *   unique) — null : chaque occurrence de la planète (ancien format).
 * @returns {Promise<void>}
 */
export async function setWebAlarm(planet, enabled, offsetMin = 0, startMs = null) {
  await apiPost('planet-web-alarm', { action: 'set', planet, enabled, offsetMin, startMs });
}

/**
 * Alarme NATIVE (Android) : la sonnerie reste locale à l'appareil, mais le
 * serveur la mémorise pour envoyer aussi la notification sur WhatsApp (compte
 * ASRAR PRO) si l'utilisateur l'a activé. Best-effort : un échec réseau ne
 * doit jamais empêcher l'alarme locale.
 * @param {string} planet
 * @param {boolean} enabled
 * @param {{offsetMin?: number, startMs?: number|null, lat?: number|null, lng?: number|null}} [opts]
 */
export function syncNativeAlarm(planet, enabled, opts = {}) {
  const { offsetMin = 0, startMs = null, lat = null, lng = null } = opts;
  if (enabled && (lat == null || lng == null)) return Promise.resolve();
  let timeZone = null;
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { /* ignoré */ }
  return apiPost('planet-web-alarm', { action: 'native-set', planet, enabled, offsetMin, startMs, lat, lng, timeZone })
    .then(() => {}, () => {});
}
