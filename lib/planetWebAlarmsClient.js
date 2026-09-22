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
 * @returns {Promise<Record<string, {offsetMin:number}>>} indexé par slug.
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
 * @returns {Promise<void>}
 */
export async function setWebAlarm(planet, enabled, offsetMin = 0) {
  await apiPost('planet-web-alarm', { action: 'set', planet, enabled, offsetMin });
}
