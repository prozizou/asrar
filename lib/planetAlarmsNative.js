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
// demander séparément ici, voir buildScheduleWarning().
//
// La logique de calcul (id, contenu, « peut-on encore programmer ? ») est
// dans lib/planetAlarms.js (pure, testée) ; ce fichier ne fait que l'appliquer
// via l'API du plugin.

import { alarmIdFor, isSchedulable, buildAlarmContent } from './planetAlarms';
import { channelById } from './pushChannels';

const CHANNEL_ID = 'heure_planetaire';

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

let _channelCreated = false;
async function ensureChannel(LocalNotifications) {
  if (_channelCreated) return;
  _channelCreated = true;
  // Idempotent et sans effet si déjà créé par lib/fcmNative.js (canaux
  // Android partagés entre tous les plugins d'une même app) — recréé ici
  // aussi pour rester autonome si cette page est visitée avant toute
  // connexion (ensureNativePushRegistration ne s'exécute qu'après login).
  await LocalNotifications.createChannel(channelById(CHANNEL_ID)).catch(() => {});
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

/**
 * Programme une alarme pour l'occurrence du jour de `row` (planète + heure
 * de début EXACTE — pas de délai avant, pas de répétition, voir lib/
 * planetAlarms.js). Idempotent (même id si déjà programmée).
 * @param {{planet:string, emoji:string, nat:{txt:string}, interval:string, start:Date}} row
 * @returns {Promise<{ok:true, warning?:string}|{ok:false, error:string}>}
 */
export async function scheduleHourAlarm(row) {
  const LocalNotifications = await getLocalNotifications();
  if (!LocalNotifications) return { ok: false, error: 'unsupported' };

  const startMs = row.start.getTime();
  if (!isSchedulable(startMs, Date.now())) return { ok: false, error: 'past' };

  try {
    const perm = await LocalNotifications.checkPermissions();
    let granted = perm.display === 'granted';
    if (!granted && perm.display !== 'denied') {
      const req = await LocalNotifications.requestPermissions();
      granted = req.display === 'granted';
    }
    if (!granted) return { ok: false, error: 'permission' };

    await ensureChannel(LocalNotifications);

    const { title, body } = buildAlarmContent({ planet: row.planet, emoji: row.emoji, natTxt: row.nat.txt, interval: row.interval });
    const result = await LocalNotifications.schedule({
      notifications: [
        {
          id: alarmIdFor(row.planet, startMs),
          title,
          body,
          channelId: CHANNEL_ID,
          extra: { url: '/planete' },
          schedule: { at: row.start, allowWhileIdle: true },
          // isExactNotification est déjà true par défaut (voir en-tête) — le
          // plugin ouvre lui-même les réglages système si la permission
          // d'alarme exacte manque encore (Android 12+).
        },
      ],
    });
    return { ok: true, warning: result.warning ? result.warning.message : undefined };
  } catch (e) {
    return { ok: false, error: (e && e.message) || 'schedule' };
  }
}

/**
 * Annule l'alarme programmée pour `row`, si elle existe. Best-effort (ne
 * lève jamais) — décocher une case qui n'avait pas d'alarme derrière (état
 * désynchronisé) ne doit pas faire échouer l'action.
 * @param {{planet:string, start:Date}} row
 */
export async function cancelHourAlarm(row) {
  const LocalNotifications = await getLocalNotifications();
  if (!LocalNotifications) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: alarmIdFor(row.planet, row.start.getTime()) }] });
  } catch {}
}
