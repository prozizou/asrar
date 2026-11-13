// lib/supportPrompt.js — Quand proposer la fenêtre « Soutenir ASRAR PRO » ?
// Logique PURE (testée dans lib/supportPrompt.test.js), appliquée par
// components/SupportProvider.js. Choix du propriétaire (2026-11) :
//   • uniquement APRÈS une action réussie (export, texte généré, calcul,
//     objectif atteint) — jamais pendant une action ;
//   • au plus une fois par jour ;
//   • « Plus tard » → pas avant 3 jours ; « J'ai déjà contribué » → 30 jours ;
//   • pour TOUS les comptes, abonnés compris (contribution volontaire en plus
//     de l'abonnement — les actions des modules sont réservées aux abonnés).

export const DAY_MS = 86400000;
export const MIN_INTERVAL_MS = DAY_MS;
export const LATER_MS = 3 * DAY_MS;
export const CONTRIBUTED_MS = 30 * DAY_MS;
export const STORAGE_KEY = 'asrar_support_prompt';
// Menu (page la plus visitée) : une présentation par SESSION, bouton
// « Passer » actif après GATE_SECONDS. Seul « J'ai déjà contribué » l'écarte
// (30 jours) ; « Plus tard » ne vaut que pour la session en cours.
export const MENU_SESSION_KEY = 'asrar_support_menu_session';
export const GATE_SECONDS = 5;

/** État mémorisé sur l'appareil : { lastShownAt, snoozeUntil, contributedUntil } (epoch ms). */
export function parseState(raw) {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return {
      lastShownAt: Number.isFinite(v?.lastShownAt) ? v.lastShownAt : 0,
      snoozeUntil: Number.isFinite(v?.snoozeUntil) ? v.snoozeUntil : 0,
      contributedUntil: Number.isFinite(v?.contributedUntil) ? v.contributedUntil : 0,
    };
  } catch {
    return { lastShownAt: 0, snoozeUntil: 0, contributedUntil: 0 };
  }
}

/**
 * @param {{ now: number, state: {lastShownAt:number, snoozeUntil:number} }} arg
 */
export function shouldPrompt({ now, state }) {
  if (now < (state?.snoozeUntil || 0)) return false;
  if (now - (state?.lastShownAt || 0) < MIN_INTERVAL_MS) return false;
  return true;
}

/** État après affichage, puis selon la réponse : 'later' | 'contributed' | 'close'. */
export function afterShown(state, now) {
  return { ...parseState(state), lastShownAt: now };
}
export function afterAnswer(state, answer, now) {
  const s = parseState(state);
  if (answer === 'later') return { ...s, snoozeUntil: now + LATER_MS };
  if (answer === 'contributed') return { ...s, snoozeUntil: now + CONTRIBUTED_MS, contributedUntil: now + CONTRIBUTED_MS };
  return s;
}

/**
 * Présentation à l'ouverture du menu : une fois par session (`sessionShown`),
 * sauf pendant les 30 jours qui suivent « J'ai déjà contribué ».
 * @param {{ now: number, state: any, sessionShown: boolean }} arg
 */
export function shouldPromptMenu({ now, state, sessionShown }) {
  if (sessionShown) return false;
  return now >= (parseState(state).contributedUntil || 0);
}
