'use client';
// lib/hijriRemindersNative.js — programmation LOCALE (Capacitor
// LocalNotifications, coquille Android) des rappels de début de phase.
// No-op hors de la coquille native, comme lib/planetAlarmsNative.js. Les
// dates sont connues à l'avance (calendrier AlAdhan) : aucun envoi serveur.
import { fetchHijriCalendar } from './hijri';
import { upcomingPhaseStarts, reminderContent } from './hijriReminders';

const CHANNEL_ID = 'hijri-phases';
const STORE_KEY = 'asrar_hijri_reminders';

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

export async function hijriRemindersSupported() {
  return !!(await getLocalNotifications());
}

// Préférence + ids programmés, par appareil.
export function readReminderState() {
  try {
    const p = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return { enabled: !!p.enabled, ids: Array.isArray(p.ids) ? p.ids : [] };
  } catch {
    return { enabled: false, ids: [] };
  }
}
function writeReminderState(s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch {}
}

/**
 * (Re)programme les prochains débuts de phase (mois grégorien courant + suivant,
 * soit ~2 mois d'avance). Idempotent. À rappeler à chaque visite pour prolonger
 * l'horizon.
 * @returns {Promise<{ok:true, count:number}|{ok:false, error:string}>}
 */
export async function enableHijriReminders() {
  const LN = await getLocalNotifications();
  if (!LN) return { ok: false, error: 'unsupported' };
  try {
    let perm = await LN.checkPermissions();
    if (perm.display !== 'granted') perm = await LN.requestPermissions();
    if (perm.display !== 'granted') return { ok: false, error: 'permission' };

    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const [a, b] = await Promise.all([
      fetchHijriCalendar(now.getMonth() + 1, now.getFullYear()),
      fetchHijriCalendar(next.getMonth() + 1, next.getFullYear()),
    ]);
    const starts = upcomingPhaseStarts([...a, ...b], now);

    await LN.createChannel({
      id: CHANNEL_ID, name: 'Phases du mois hijri', description: 'Début de la période d’attraction ou de repoussement.',
      importance: 4, vibration: true,
    }).catch(() => {});

    const prev = readReminderState().ids;
    if (prev.length) await LN.cancel({ notifications: prev.map((id) => ({ id })) }).catch(() => {});
    if (starts.length) {
      await LN.schedule({
        notifications: starts.map((s) => ({
          id: s.id,
          ...reminderContent(s),
          channelId: CHANNEL_ID,
          extra: { url: '/hijri' },
          schedule: { at: s.triggerAt, allowWhileIdle: true },
        })),
      });
    }
    writeReminderState({ enabled: true, ids: starts.map((s) => s.id) });
    return { ok: true, count: starts.length };
  } catch (e) {
    return { ok: false, error: (e && e.message) || 'schedule' };
  }
}

export async function disableHijriReminders() {
  const LN = await getLocalNotifications();
  const { ids } = readReminderState();
  if (LN && ids.length) await LN.cancel({ notifications: ids.map((id) => ({ id })) }).catch(() => {});
  writeReminderState({ enabled: false, ids: [] });
}
