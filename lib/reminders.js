// lib/reminders.js — Rappels programmés : logique PURE, partagée client (ESM,
// app/rappels/page.tsx) et serveur (require CommonJS, pages/api/reminders.js
// et pages/api/cron/reminders.js — la validation qui FAIT autorité), même
// interop que lib/zikrLogic.js / lib/reviews.js.
//
// Deux rappels distincts, tous deux livrés par la même infra push que l'heure
// planétaire (lib/push.js, VAPID) mais SANS exiger de position GPS (celle-ci
// n'est nécessaire qu'au calcul de l'heure planétaire — voir
// pages/api/push-subscribe.js, lat/lng désormais optionnels) :
//
//   1. Wird quotidien — l'utilisateur choisit une heure locale (HH:mm) ;
//      reminder_settings/{uid} = { wirdEnabled, wirdHour, wirdMinute, tz }.
//   2. Session Zikr collectif à venir — le créateur d'un zikr collectif fixe
//      un horaire optionnel (zikr_groups/{gid}.sessionAt, epoch ms — voir
//      lib/zikrLogic.js normalizeGroupInput) ; tous les membres approuvés
//      reçoivent un rappel avant l'heure dite.
//
// Le cron (pages/api/cron/reminders.js) peut être invoqué à une cadence
// irrégulière/inconnue (planificateur externe, cf. l'en-tête de
// pages/api/cron/planet-push.js) : les fonctions ci-dessous sont donc
// délibérément à BASE D'ÉTAT (dernier envoi mémorisé) plutôt qu'à fenêtre de
// temps stricte, pour rester correctes quelle que soit la fréquence réelle
// des appels.

export const WIRD_HOUR_MIN = 0;
export const WIRD_HOUR_MAX = 23;
export const WIRD_MINUTE_MIN = 0;
export const WIRD_MINUTE_MAX = 59;

// Fenêtre de rappel pour une session Zikr collectif : à partir de LEAD_MS
// avant l'heure fixée, jusqu'à GRACE_MS après (au cas où le cron ne repasse
// pas exactement à l'heure) — au-delà, on considère le rappel manqué plutôt
// que de prévenir en retard d'une session déjà bien entamée.
export const SESSION_LEAD_MS = 30 * 60 * 1000;  // 30 min avant
export const SESSION_GRACE_MS = 10 * 60 * 1000; // 10 min de rattrapage après

export function cleanHour(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= WIRD_HOUR_MIN && n <= WIRD_HOUR_MAX ? n : null;
}

export function cleanMinute(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= WIRD_MINUTE_MIN && n <= WIRD_MINUTE_MAX ? n : null;
}

// Pas de liste exhaustive de fuseaux IANA (change avec le temps) : juste une
// forme plausible ("Europe/Paris", "UTC", "Africa/Abidjan"…) — un fuseau
// invalide sera de toute façon ignoré par Intl.DateTimeFormat (repli 'UTC'
// dans localHHmm/localDateKey ci-dessous), donc jamais une source de plantage.
export function cleanTimeZone(v) {
  const s = String(v || '').trim();
  return s && s.length <= 60 && /^[A-Za-z0-9_+\-/]+$/.test(s) ? s : 'UTC';
}

/** Heure locale actuelle "HH:mm" dans le fuseau donné. `now` est injecté
 * (jamais Date.now() implicite) : pure, testable. Repli UTC si le fuseau
 * stocké n'est plus valide (Intl lève alors une RangeError). */
export function localHHmm(now, tz) {
  try {
    return new Intl.DateTimeFormat('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  } catch {
    return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  }
}

/** Date locale actuelle "YYYY-MM-DD" dans le fuseau donné — clé anti-doublon
 * (un seul rappel de wird envoyé par jour civil LOCAL de l'utilisateur). */
export function localDateKey(now, tz) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  }
}

/**
 * Faut-il envoyer le rappel de wird maintenant ? À BASE D'ÉTAT : dès que
 * l'heure locale programmée est atteinte ET qu'aucun envoi n'a eu lieu ce
 * jour civil local — peu importe depuis quand le cron n'est pas repassé.
 * Pure.
 * @param {{wirdEnabled?:boolean, wirdHour?:number, wirdMinute?:number, tz?:string, lastSentDate?:string}} settings
 * @param {Date} now
 */
export function shouldSendWird(settings, now) {
  if (!settings || settings.wirdEnabled !== true) return false;
  const hour = cleanHour(settings.wirdHour);
  const minute = cleanMinute(settings.wirdMinute);
  if (hour == null || minute == null) return false;
  const tz = cleanTimeZone(settings.tz);

  const today = localDateKey(now, tz);
  if (settings.lastSentDate === today) return false; // déjà envoyé aujourd'hui

  const [curH, curM] = localHHmm(now, tz).split(':').map(Number);
  const curMinutes = curH * 60 + curM;
  const targetMinutes = hour * 60 + minute;
  return curMinutes >= targetMinutes;
}

/**
 * Faut-il envoyer le rappel de session Zikr collectif à venir ? Fenêtre
 * [sessionAt - SESSION_LEAD_MS, sessionAt + SESSION_GRACE_MS], une seule
 * fois (déjàEnvoyé). Pure.
 * @param {number|null|undefined} sessionAt epoch ms
 * @param {boolean} alreadySent
 * @param {Date} now
 */
export function shouldSendSessionReminder(sessionAt, alreadySent, now) {
  if (!sessionAt || alreadySent) return false;
  const t = Number(sessionAt);
  if (!Number.isFinite(t) || t <= 0) return false;
  const delta = t - now.getTime();
  return delta <= SESSION_LEAD_MS && delta >= -SESSION_GRACE_MS;
}
