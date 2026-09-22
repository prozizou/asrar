'use client';
// lib/planetAlarmsNative.js — Pont natif pour les alarmes d'heure planétaire
// (@capacitor/local-notifications, coquille Capacitor Android) — no-op total
// hors de cette coquille (Capacitor.isNativePlatform() faux sur le site web),
// même schéma que lib/fcmNative.js : imports dynamiques, rien n'atteint le
// bundle web.
//
// DISTINCT de lib/fcmNative.js : une alarme d'heure planétaire est programmée
// EN LOCAL sur l'appareil (l'heure de déclenchement est déjà connue à
// l'avance — pas de dépendance à un envoi serveur/réseau au moment exact),
// alors que FCM reste le canal pour tout ce qui est décidé côté serveur
// (message Zikr, Secret, document, administration). Le plugin
// @capacitor/local-notifications gère lui-même la permission d'alarme exacte
// (Android 12+, SCHEDULE_EXACT_ALARM) au moment de schedule() — inutile de la
// demander séparément ici.
//
// La logique de calcul (id, contenu, canaux, « peut-on encore programmer ? »)
// est dans lib/planetAlarms.js (pure, testée) ; ce fichier ne fait que
// l'appliquer via l'API du plugin. Les identifiants d'alarme RENVOYÉS par
// scheduleHourAlarm()/scheduleRepeatingAlarms() sont la source de vérité pour
// une annulation ultérieure (cancelAlarms()) — jamais recalculés à partir des
// préférences courantes, qui peuvent avoir changé entre-temps (voir
// lib/planetAlarmPrefsStore.js, qui les persiste).

import { alarmIdFor, alarmTimeFor, isSchedulable, buildAlarmContent, alarmChannelId, planetAlarmChannels, SOUND_CHOICES } from './planetAlarms';
import { upcomingPlanetOccurrences } from './planete';

async function getLocalNotifications() {
  if (typeof window === 'undefined') return null;
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return null;
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    return LocalNotifications;
  } catch {
    return null;
  }
}

/**
 * À appeler au montage d'un composant qui affiche les cases à cocher —
 * détermine s'il faut les proposer du tout. Asynchrone (import dynamique),
 * d'où le résultat renvoyé plutôt qu'une fonction sync comme pushSupported()
 * (lib/push.js) : @capacitor/core ne doit être chargé que si nécessaire.
 * @returns {Promise<boolean>}
 */
export async function planetAlarmsSupported() {
  return !!(await getLocalNotifications());
}

let _channelsCreated = false;
async function ensureAlarmChannels(LocalNotifications) {
  if (_channelsCreated) return;
  _channelsCreated = true;
  // Idempotent (createChannel() est un no-op si l'id existe déjà) — les 6
  // combinaisons (3 sons × vibration on/off, voir planetAlarmChannels()) sont
  // créées une fois pour toutes, jamais recréées par préférence individuelle
  // (impossible : un canal Android existant est immuable côté app).
  await Promise.all(planetAlarmChannels().map((c) => LocalNotifications.createChannel(c).catch(() => {})));
}

/**
 * Jetons (ids) actuellement programmés — sert à initialiser l'état coché des
 * cases au chargement de la page (une alarme déjà programmée lors d'une
 * visite précédente doit réapparaître cochée).
 * @returns {Promise<Set<number>>} vide si non supporté ou en cas d'échec.
 */
export async function getPendingAlarmIds() {
  const LocalNotifications = await getLocalNotifications();
  if (!LocalNotifications) return new Set();
  try {
    const { notifications } = await LocalNotifications.getPending();
    return new Set(notifications.map((n) => n.id));
  } catch {
    return new Set();
  }
}

async function ensurePermission(LocalNotifications) {
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display === 'granted') return true;
  if (perm.display === 'denied') return false;
  const req = await LocalNotifications.requestPermissions();
  return req.display === 'granted';
}

function notificationFor(row, prefs) {
  const triggerMs = alarmTimeFor(row.start.getTime(), prefs.offsetMin);
  const sound = SOUND_CHOICES.find((s) => s.id === prefs.soundId);
  const { title, body } = buildAlarmContent({ planet: row.planet, emoji: row.emoji, natTxt: row.nat.txt, interval: row.interval, offsetMin: prefs.offsetMin });
  return {
    triggerMs,
    notification: {
      id: alarmIdFor(row.planet, triggerMs),
      title,
      body,
      channelId: alarmChannelId(prefs.soundId, prefs.vibration),
      ...(sound && sound.file ? { sound: sound.file } : {}),
      extra: { url: '/planete' },
      schedule: { at: new Date(triggerMs), allowWhileIdle: true },
      // isExactNotification est déjà true par défaut — le plugin ouvre
      // lui-même les réglages système si la permission d'alarme exacte
      // manque encore (Android 12+).
    },
  };
}

/**
 * Programme UNE alarme ponctuelle pour l'occurrence de `row`, décalée de
 * `prefs.offsetMin` minutes. Idempotent (même id si déjà programmée avec les
 * mêmes préférences).
 * @param {{planet:string, emoji:string, nat:{txt:string}, interval:string, start:Date}} row
 * @param {{offsetMin:number, soundId:string, vibration:boolean}} prefs
 * @returns {Promise<{ok:true, id:number, warning?:string}|{ok:false, error:string}>}
 */
export async function scheduleHourAlarm(row, prefs) {
  const LocalNotifications = await getLocalNotifications();
  if (!LocalNotifications) return { ok: false, error: 'unsupported' };

  const { triggerMs, notification } = notificationFor(row, prefs);
  if (!isSchedulable(triggerMs, Date.now())) return { ok: false, error: 'past' };

  try {
    if (!(await ensurePermission(LocalNotifications))) return { ok: false, error: 'permission' };
    await ensureAlarmChannels(LocalNotifications);
    const result = await LocalNotifications.schedule({ notifications: [notification] });
    return { ok: true, id: notification.id, warning: result.warning ? result.warning.message : undefined };
  } catch (e) {
    return { ok: false, error: (e && e.message) || 'schedule' };
  }
}

/**
 * Programme TOUTES les occurrences à venir de `planet` sur
 * REPEAT_HORIZON_DAYS jours (lib/planetAlarms.js) — utilisé quand
 * `prefs.repeat` est actif. `lat`/`lng`/`cache` : mêmes valeurs que celles
 * déjà utilisées par la page (position GPS résolue, cache lever/coucher).
 * @param {{planet:string, prefs:object, lat:number, lng:number, cache:object, fromDate?:Date}} args
 * @returns {Promise<{ok:true, ids:number[], warning?:string}|{ok:false, error:string}>}
 */
export async function scheduleRepeatingAlarms({ planet, prefs, lat, lng, cache, fromDate = new Date() }) {
  const LocalNotifications = await getLocalNotifications();
  if (!LocalNotifications) return { ok: false, error: 'unsupported' };
  if (lat == null || lng == null) return { ok: false, error: 'position' };

  try {
    if (!(await ensurePermission(LocalNotifications))) return { ok: false, error: 'permission' };
    await ensureAlarmChannels(LocalNotifications);

    const occurrences = upcomingPlanetOccurrences(planet, fromDate, 14, lat, lng, cache);
    if (!occurrences.length) return { ok: false, error: 'none' };

    const built = occurrences.map((row) => notificationFor(row, prefs));
    const result = await LocalNotifications.schedule({ notifications: built.map((b) => b.notification) });
    return { ok: true, ids: built.map((b) => b.notification.id), warning: result.warning ? result.warning.message : undefined };
  } catch (e) {
    return { ok: false, error: (e && e.message) || 'schedule' };
  }
}

/**
 * Annule les alarmes désignées par `ids` — utilisé aussi bien pour une
 * alarme ponctuelle (un seul id) que pour un jeu « répéter » (plusieurs).
 * Best-effort (ne lève jamais) — annuler un id déjà déclenché/inexistant
 * (état désynchronisé) ne doit pas faire échouer l'action.
 * @param {number[]} ids
 */
export async function cancelAlarms(ids) {
  if (!ids || !ids.length) return;
  const LocalNotifications = await getLocalNotifications();
  if (!LocalNotifications) return;
  try {
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  } catch {}
}
