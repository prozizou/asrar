'use client';
// lib/planetHourChangeNative.js — programmation LOCALE (Capacitor, app
// Android) des alertes à chaque changement d'heure planétaire. No-op hors de
// la coquille native. Les 48 h suivantes sont programmées d'un coup (alarmes
// exactes, reçues application fermée) et renouvelées à chaque visite.
import { upcomingHourStarts, hourChangeNotification, HOUR_CHANGE_HORIZON_H } from './planetHourChange';

const CHANNEL_ID = 'planet-hour-change';
const STORE_KEY = 'asrar_planet_hour_change';

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

export async function hourChangeSupported() {
  return !!(await getLocalNotifications());
}

export function readHourChangeState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return { enabled: !!s.enabled, ids: Array.isArray(s.ids) ? s.ids : [] };
  } catch {
    return { enabled: false, ids: [] };
  }
}
function writeState(s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch {}
}

/**
 * (Re)programme les débuts d'heure des 48 h suivantes. Idempotent.
 * @returns {Promise<{ok:true, count:number}|{ok:false, error:string}>}
 */
export async function enableHourChangeAlerts({ lat, lng, cache, timeZone }) {
  const LN = await getLocalNotifications();
  if (!LN) return { ok: false, error: 'unsupported' };
  if (lat == null || lng == null) return { ok: false, error: 'position' };
  try {
    let perm = await LN.checkPermissions();
    if (perm.display !== 'granted') perm = await LN.requestPermissions();
    if (perm.display !== 'granted') return { ok: false, error: 'permission' };

    await LN.createChannel({
      id: CHANNEL_ID, name: 'Changement d’heure planétaire',
      description: 'Une notification au début de chaque heure planétaire.',
      importance: 3, vibration: true,
    }).catch(() => {});

    const rows = upcomingHourStarts(Date.now(), HOUR_CHANGE_HORIZON_H, lat, lng, cache, timeZone || undefined);
    const notes = rows.map((r) => hourChangeNotification(r, timeZone || undefined));

    const prev = readHourChangeState().ids;
    if (prev.length) await LN.cancel({ notifications: prev.map((id) => ({ id })) }).catch(() => {});
    if (notes.length) {
      await LN.schedule({
        notifications: notes.map((n) => ({
          id: n.id, title: n.title, body: n.body, channelId: CHANNEL_ID,
          extra: { url: '/planete' },
          schedule: { at: n.at, allowWhileIdle: true },
        })),
      });
    }
    writeState({ enabled: true, ids: notes.map((n) => n.id) });
    return { ok: true, count: notes.length };
  } catch (e) {
    return { ok: false, error: (e && e.message) || 'schedule' };
  }
}

export async function disableHourChangeAlerts() {
  const LN = await getLocalNotifications();
  const { ids } = readHourChangeState();
  if (LN && ids.length) await LN.cancel({ notifications: ids.map((id) => ({ id })) }).catch(() => {});
  writeState({ enabled: false, ids: [] });
}
