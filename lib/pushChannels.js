// lib/pushChannels.js — Source UNIQUE des canaux de notification Android
// (FCM) : logique PURE (aucun accès réseau/RTDB/Capacitor), consommée à la
// fois par lib/fcmNative.js (création des canaux côté appareil) et
// server/notify.js (choix du canal au moment de l'envoi) — un seul endroit
// à modifier pour ajouter/ajuster un canal, jamais deux listes qui peuvent
// diverger.
//
// Mêmes 7 catégories/priorités que la revue produit du 2026-09-21.
// Importance Android : 3 = IMPORTANCE_DEFAULT (« Normale »),
// 4 = IMPORTANCE_HIGH (« Haute », alerte flottante + son immédiat).
export const PUSH_CHANNELS = [
  { id: 'zikr_message', name: 'Messages & Zikr', description: 'Nouveau message dans un Zikr collectif.', importance: 4, sound: 'asrar_notification.mp3' },
  { id: 'zikr_session', name: 'Zikr collectif', description: 'Session, rappel, objectif atteint.', importance: 4, sound: 'asrar_notification.mp3' },
  { id: 'heure_planetaire', name: 'Heure planétaire', description: 'Changement d’heure favorable.', importance: 4, sound: 'asrar_notification.mp3' },
  // « Normale/Haute » dans la revue produit — Normale retenue par défaut :
  // une expiration prochaine n'est pas aussi sensible au temps qu'un
  // message de chat, une alerte flottante systématique serait intrusive.
  { id: 'abonnement', name: 'Abonnement', description: 'Expiration prochaine de votre accès.', importance: 3, sound: 'asrar_notification.mp3' },
  { id: 'secrets_documents', name: 'Secrets & Documents', description: 'Nouvelle publication de l’administration.', importance: 3, sound: 'asrar_notification.mp3' },
  { id: 'rappel_quotidien', name: 'Rappel quotidien', description: 'Verset ou rappel du jour.', importance: 3, sound: 'asrar_notification.mp3' },
  { id: 'administration', name: 'Administration', description: 'Message important de l’administration.', importance: 4, sound: 'asrar_notification.mp3' },
];

const DEFAULT_CHANNEL_ID = 'administration';

// Correspondance type de notification (lib/notifyTemplates.js NOTIF_TYPES)
// → canal Android. Tout type inconnu (aucun aujourd'hui, mais server/
// notify.js reste appelable avec un `type` arbitraire) retombe sur le canal
// « Administration » plutôt que de faire échouer l'envoi FCM.
const TYPE_TO_CHANNEL = {
  secret: 'secrets_documents',
  document: 'secrets_documents',
  zikr_message: 'zikr_message',
};

/**
 * @param {string} type valeur de NOTIF_TYPES (lib/notifyTemplates.js)
 * @returns {string} id de canal — toujours une entrée valide de PUSH_CHANNELS
 */
export function channelIdForNotifType(type) {
  return TYPE_TO_CHANNEL[type] || DEFAULT_CHANNEL_ID;
}

/**
 * @param {string} channelId
 * @returns {{id: string, importance: number}} le canal, ou un repli
 *   « Normale » si channelId ne correspond à aucune entrée connue.
 */
export function channelById(channelId) {
  return PUSH_CHANNELS.find((c) => c.id === channelId) || { id: DEFAULT_CHANNEL_ID, importance: 3 };
}
