// lib/planetWebAlarms.js — Logique PURE des alarmes d'heure planétaire côté
// WEB (aucun accès RTDB/réseau, testée sans mock). Pendant web du volet natif
// (lib/planetAlarms.js) : là où l'app Android programme une notification
// locale exacte à l'avance, le web NE PEUT PAS (aucune API navigateur fiable
// pour déclencher une notification à une heure précise app fermée — les
// « Notification Triggers » ont été abandonnés). On passe donc par un push
// serveur : l'utilisateur coche une planète, on l'enregistre, et un cron
// (pages/api/cron/planet-push.js) envoie le push au bon moment.
//
// CONSÉQUENCE D'OPÉRATION : ce cron doit être appelé FRÉQUEMMENT (≈ chaque
// minute) pour tomber dans la fenêtre WEB_ALARM_WINDOW_MS d'un déclenchement.
// Le cron Vercel Hobby ne tourne qu'une fois par jour — il faut un Vercel Pro
// (`* * * * *`) ou un pinger externe. Voir l'en-tête du cron.
//
// Contrairement au natif (réglage PAR APPAREIL en localStorage), l'alarme web
// est enregistrée PAR COMPTE dans RTDB (planet_web_alarms/{uid}/{slug}) et le
// push part vers TOUS les abonnements de l'utilisateur (push_subscriptions) —
// c'est le socle « tous mes appareils » de l'architecture multiplateforme.

import { CHALDEAN_ORDER } from './planete';

// Délai avant le début de l'heure, en minutes — 0 = à l'heure exacte. Le web
// n'expose ni son ni vibration personnalisés (le système/navigateur en garde
// le contrôle), d'où un réglage réduit au seul « quand ? ».
export const WEB_OFFSET_CHOICES = [0, 5, 10, 15];

// Clé RTDB par planète : slug ASCII sans accent (Vénus/Mercure) ni caractère
// réservé Firebase — les noms affichés restent les noms français de CHALDEAN_ORDER.
const SLUG_BY_PLANET = {
  Saturne: 'saturne',
  Jupiter: 'jupiter',
  Mars: 'mars',
  Soleil: 'soleil',
  Vénus: 'venus',
  Mercure: 'mercure',
  Lune: 'lune',
};
const PLANET_BY_SLUG = Object.fromEntries(
  Object.entries(SLUG_BY_PLANET).map(([planet, slug]) => [slug, planet]),
);

// Garde-fou : la table couvre exactement les 7 planètes de l'ordre chaldéen.
if (Object.keys(SLUG_BY_PLANET).length !== CHALDEAN_ORDER.length) {
  throw new Error('planetWebAlarms: SLUG_BY_PLANET désynchronisé de CHALDEAN_ORDER');
}

/** @param {string} planet @returns {string|null} */
export function planetSlug(planet) {
  return SLUG_BY_PLANET[planet] || null;
}

/** @param {string} slug @returns {string|null} */
export function planetFromSlug(slug) {
  return PLANET_BY_SLUG[slug] || null;
}

/**
 * Normalise un délai reçu (formulaire ou RTDB) vers un choix valide — 0 par
 * défaut si absent/hors liste.
 * @param {*} n
 * @returns {number}
 */
export function validateWebOffset(n) {
  const v = Number(n);
  return WEB_OFFSET_CHOICES.includes(v) ? v : 0;
}

// Fenêtre après l'instant de déclenchement pendant laquelle le push reste
// pertinent. Bornée volontairement : au-delà, l'heure planétaire est déjà bien
// entamée, mieux vaut ne rien envoyer qu'un rappel périmé. Le cron doit être
// appelé au moins une fois par fenêtre (≈ chaque minute) pour ne rien rater.
export const WEB_ALARM_WINDOW_MS = 6 * 60 * 1000;

/** @param {number} startMs @param {number} offsetMin @returns {number} */
export function webAlarmTriggerMs(startMs, offsetMin) {
  return startMs - offsetMin * 60000;
}

/**
 * Parmi les occurrences candidates (heures planétaires du jour), celles dont
 * l'instant de déclenchement (début − délai) est ATTEINT, encore DANS la
 * fenêtre, et pas DÉJÀ envoyé (triggerMs > lastSentTrigger). Une seule
 * occurrence due par planète (la plus récente si deux tombent dans la fenêtre).
 *
 * Pure : le cron fournit `rows` (via lib/planete.js) et l'état `enabled` (via
 * RTDB) ; cette fonction ne décide que du « quoi envoyer maintenant ».
 *
 * @param {object} args
 * @param {Array<{planet:string, start:Date}>} args.rows
 * @param {Record<string,{offsetMin?:number, lastSentTrigger?:number}>} args.enabled  indexé par slug
 * @param {number} args.nowMs
 * @param {number} [args.windowMs]
 * @returns {Array<{slug:string, planet:string, triggerMs:number}>}
 */
export function dueWebAlarms({ rows, enabled, nowMs, windowMs = WEB_ALARM_WINDOW_MS }) {
  /** @type {Map<string, {slug:string, planet:string, triggerMs:number}>} */
  const bySlug = new Map();
  for (const row of rows) {
    const slug = planetSlug(row.planet);
    const cfg = slug ? enabled[slug] : null;
    if (!cfg) continue;
    const triggerMs = webAlarmTriggerMs(row.start.getTime(), validateWebOffset(cfg.offsetMin));
    if (nowMs < triggerMs) continue; // pas encore l'heure
    if (nowMs - triggerMs >= windowMs) continue; // trop tard, occurrence ratée
    if (cfg.lastSentTrigger != null && triggerMs <= cfg.lastSentTrigger) continue; // déjà envoyé
    const prev = bySlug.get(slug);
    if (!prev || triggerMs > prev.triggerMs) bySlug.set(slug, { slug, planet: row.planet, triggerMs });
  }
  return [...bySlug.values()];
}
