// lib/pushDecision.js — Décision PURE « faut-il (ré)abonner l'appareil aux
// notifications push, et faut-il demander l'autorisation ? ». Isolée ici
// (aucun import, aucune API navigateur) pour être testable sans mock, et
// consommée par lib/push.js (ensurePushRegistration) au moment de la
// connexion (components/AuthProvider.js).
//
// Trois issues :
//   'register' — l'autorisation est DÉJÀ accordée : (ré)abonner en silence,
//                sans aucune invite. Refait à CHAQUE ouverture/connexion, car
//                idempotent et indispensable pour couvrir un nouvel appareil,
//                un abonnement purgé côté serveur (server/notify.js) ou des
//                données de site effacées.
//   'prompt'   — l'autorisation n'a jamais été demandée ('default') ET on ne
//                l'a pas encore demandée automatiquement sur ce navigateur :
//                afficher l'invite une seule fois (voir promptedBefore).
//   'skip'     — rien à faire : push non supporté, autorisation refusée, ou
//                invite déjà présentée une fois (l'utilisateur pourra toujours
//                activer manuellement depuis le centre de notifications).
//
// Le « une seule fois » de l'invite automatique évite de harceler à chaque
// connexion — Firefox/Safari bloquent d'ailleurs durablement une invite
// répétée sans geste utilisateur ; la bannière manuelle (tap) du centre de
// notifications reste le chemin fiable là où l'invite auto ne s'affiche pas.

/**
 * @param {{supported:boolean, permission:'default'|'granted'|'denied', promptedBefore:boolean}} state
 * @returns {'register'|'prompt'|'skip'}
 */
export function nextPushAction({ supported, permission, promptedBefore }) {
  if (!supported) return 'skip';
  if (permission === 'granted') return 'register';
  if (permission === 'denied') return 'skip';
  // permission === 'default' (jamais demandée)
  return promptedBefore ? 'skip' : 'prompt';
}
