// lib/pushDevices.js — Logique PURE de validation/identification des
// appareils FCM (aucune dépendance React ni Firebase, seul `crypto` — Node
// natif, disponible côté serveur comme dans les tests Vitest — environment:
// 'node', voir vitest.config.mjs) : isolée pour être testable sans mock
// Firebase, et consommée par pages/api/push-fcm-register.js.
//
// Canal FCM natif (Capacitor Android, puis iOS) — DISTINCT de l'abonnement
// Web Push existant (lib/push.js, push_subscriptions/{uid}/{subId}) : un
// même utilisateur peut avoir les deux à la fois (navigateur ET app
// installée), voir fcm_devices/{uid}/{deviceId} en parallèle de
// push_subscriptions/{uid}/{subId}. server/notify.js enverra aux deux
// canaux une fois l'app Android branchée (pas encore le cas ici — cette
// première tranche ne fait qu'enregistrer les jetons, sans encore les
// utiliser à l'envoi).

import crypto from 'crypto';

// Plateformes reconnues — 'web' couvre un futur usage FCM navigateur
// (distinct du Web Push VAPID actuel), non utilisé pour l'instant mais sans
// coût à accepter dès maintenant plutôt que de re-modifier ce fichier plus
// tard pour un simple ajout d'enum.
export const PLATFORMS = ['android', 'ios', 'web'];

/**
 * Identifiant stable et court dérivé d'un jeton FCM — même raisonnement que
 * subId() dans pages/api/push-subscribe.js : un jeton FCM peut contenir des
 * caractères invalides comme clé Firebase (":", ".", etc.) et être long.
 * @param {string} token
 * @returns {string}
 */
export function deviceIdFromToken(token) {
  return crypto.createHash('sha1').update(String(token || '')).digest('hex');
}

/**
 * Valide les champs requis pour enregistrer un appareil — jamais lève,
 * renvoie toujours { valid, error? } pour que l'appelant réponde 400 avec un
 * message clair plutôt qu'un 500 générique.
 * @param {{platform?: string, token?: string}} input
 * @returns {{valid: boolean, error?: string}}
 */
export function validateDeviceInput({ platform, token } = {}) {
  if (!token || typeof token !== 'string' || token.trim().length < 10) {
    return { valid: false, error: 'Jeton FCM invalide.' };
  }
  if (!PLATFORMS.includes(platform)) {
    return { valid: false, error: 'Plateforme inconnue.' };
  }
  return { valid: true };
}
