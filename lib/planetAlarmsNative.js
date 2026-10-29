'use client';
// Native Android alarm clock; the web never imports or schedules a native alarm.
// New APKs use PlanetAlarm (AlarmManager + looping foreground audio).
// Older Android APKs can list/cancel legacy notifications but require an update
// to schedule a real alarm. Other Capacitor platforms retain local notifications.
// Persist the returned IDs; preferences may change before cancellation.

import { alarmIdFor, alarmTimeFor, isSchedulable, buildAlarmContent, alarmChannelId, planetAlarmChannels, SOUND_CHOICES } from './planetAlarms';
import { upcomingPlanetOccurrences, planetaryNotification } from './planete';
import { createAlarmClockAdapter } from './planetAlarmClock';

async function getLocalNotifications() {
  if (typeof window === 'undefined') return null;
  try {
    const { Capacitor, registerPlugin } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return null;
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    if (Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('PlanetAlarm')) {
      return createAlarmClockAdapter(registerPlugin('PlanetAlarm'), LocalNotifications);
    }
    // Older APKs still list/cancel their reminders, but cannot promise a real alarm.
    if (Capacitor.getPlatform() === 'android') {
      return { ...LocalNotifications, schedule: async () => { throw new Error('native-update'); },
        checkPermissions: () => LocalNotifications.checkPermissions(),
        requestPermissions: () => LocalNotifications.requestPermissions(),
        createChannel: (channel) => LocalNotifications.createChannel(channel),
        getPending: () => LocalNotifications.getPending(),
        cancel: (options) => LocalNotifications.cancel(options) };
    }
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
  const content = planetaryNotification(row, row.start);
  const { title } = buildAlarmContent({ planet: row.planet, emoji: row.emoji, natTxt: content.state.nature.txt, interval: row.interval, offsetMin: prefs.offsetMin });
  const body = `${content.body} · ${row.interval}`;
  return {
    triggerMs,
    notification: {
      id: alarmIdFor(row.planet, triggerMs),
      title,
      body,
      channelId: alarmChannelId(prefs.soundId, prefs.vibration),
      ...(sound && sound.file ? { sound: sound.file } : {}),
      extra: { url: '/planete', soundId: prefs.soundId, vibration: prefs.vibration },
      schedule: { at: new Date(triggerMs), allowWhileIdle: true },
    },
  };
}

/**
 * Programme UNE alarme ponctuelle pour l'occurrence de `row`, décalée de
 * `prefs.offsetMin` minutes. Idempotent (même id si déjà programmée avec les
 * mêmes préférences).
 * @param {{planet:string, emoji:string, nat:{txt:string}, interval:string, start:Date, end:Date}} row
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
    return { ok: false, error: (e && (e.message || e.code)) || 'schedule' };
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

    const built = occurrences.map((row) => notificationFor(row, prefs)).filter((b) => isSchedulable(b.triggerMs, Date.now()));
    if (!built.length) return { ok: false, error: 'none' };
    const result = await LocalNotifications.schedule({ notifications: built.map((b) => b.notification) });
    return { ok: true, ids: built.map((b) => b.notification.id), warning: result.warning ? result.warning.message : undefined };
  } catch (e) {
    return { ok: false, error: (e && (e.message || e.code)) || 'schedule' };
  }
}

/**
 * Annule les alarmes désignées par `ids` — utilisé aussi bien pour une
 * alarme ponctuelle (un seul id) que pour un jeu « répéter » (plusieurs).
 * An absent ID is harmless; a native cancellation failure must reach the UI.
 * @param {number[]} ids
 */
export async function cancelAlarms(ids) {
  if (!ids || !ids.length) return;
  const LocalNotifications = await getLocalNotifications();
  if (!LocalNotifications) return;
  await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
}

async function diagnosticClock() {
  const { Capacitor, registerPlugin } = await import('@capacitor/core');
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('PlanetAlarm')) throw new Error('native-update');
  return registerPlugin('PlanetAlarm');
}

export async function getPlanetAlarmStatus() {
  try { return await (await diagnosticClock()).getStatus(); }
  catch (error) {
    if (error?.code === 'UNIMPLEMENTED' || /not implemented|not available/i.test(error?.message || '')) throw new Error('native-update');
    throw error;
  }
}

export async function testPlanetAlarm(prefs = { soundId: 'asrar', vibration: true }) {
  const { buildPlanetAlarmTest } = await import('./planetAlarmDiagnostics');
  const alarm = buildPlanetAlarmTest(prefs, Date.now());
  await (await diagnosticClock()).schedule({ alarms: [alarm] });
  return alarm.at;
}
