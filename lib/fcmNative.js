'use client';
// lib/fcmNative.js — Notifications push NATIVES (FCM via Capacitor, app
// Android installée) — canal DISTINCT du Web Push VAPID (lib/push.js),
// actif UNIQUEMENT quand l'app tourne dans la coquille Capacitor
// (capacitor.config.ts) : `Capacitor.isNativePlatform()` est false sur le
// site web normal, donc rien ici ne s'exécute jamais côté navigateur — les
// imports de @capacitor/core et @capacitor/push-notifications sont
// dynamiques pour ne rien ajouter au bundle web tant que ce code n'est pas
// exécuté.
//
// Ce que ce fichier fait : crée les canaux de notification Android (une
// fois par lancement — createChannel() est un no-op silencieux si le canal
// existe déjà avec le même id, et ignoré avant Android 8 où les canaux
// n'existent pas), demande la permission (obligatoire à partir d'Android
// 13 — POST_NOTIFICATIONS, voir AndroidManifest.xml), obtient le jeton FCM
// et l'enregistre
// via pages/api/push-fcm-register.js (déjà en place), et route un tap sur
// notification vers l'URL cible (même champ `url` que le payload Web Push
// existant — server/notify.js JSON.stringify({ title, body, url, tag }) —
// pour que l'éventuel branchement de l'envoi FCM côté serveur, plus tard,
// réutilise EXACTEMENT le même payload pour les deux canaux).
//
// Ce que ce fichier NE fait PAS (hors périmètre de cette tranche) :
// server/notify.js n'envoie encore aucune notification FCM — seul
// l'enregistrement de l'appareil est branché ici. Voir pages/api/
// push-fcm-register.js pour le détail de ce qui reste à faire.

import { apiPost } from './api';

// Canaux Android — mêmes 7 catégories/priorités que la revue produit du
// 2026-09-21. Les id reprennent, quand ils existent déjà, les valeurs de
// NOTIF_TYPES (lib/notifyTemplates.js) pour que le futur envoi FCM associe
// directement `type` → canal sans table de correspondance séparée.
// Importance Android : 3 = IMPORTANCE_DEFAULT (« Normale »),
// 4 = IMPORTANCE_HIGH (« Haute », alerte flottante + son immédiat).
const CHANNELS = [
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

// Résolution paresseuse : @capacitor/core n'est utile que dans la coquille
// native — un import statique serait sans risque ici (le paquet ne touche
// à aucune API navigateur au chargement), mais dynamique documente mieux
// l'intention et évite tout couplage accidentel avec le bundle web.
async function getCapacitor() {
  if (typeof window === 'undefined') return null;
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform() ? Capacitor : null;
  } catch {
    return null;
  }
}

let _channelsCreated = false;
async function ensureChannels(PushNotifications) {
  if (_channelsCreated) return;
  _channelsCreated = true;
  await Promise.all(CHANNELS.map((c) => PushNotifications.createChannel(c).catch(() => {})));
}

// Tap sur une notification système → navigation vers son URL cible, même
// convention que le SW Web Push (`data.url`, voir public/sw.js
// notificationclick). best-effort : jamais bloquant si la donnée est absente
// ou malformée.
function handleNotificationTap(action) {
  try {
    const url = action && action.notification && action.notification.data && action.notification.data.url;
    if (url && typeof window !== 'undefined') window.location.assign(url);
  } catch {}
}

/**
 * Appelée APRÈS la connexion (components/AuthProvider.js), en plus de
 * ensurePush() (Web Push) — jamais à sa place. No-op immédiat hors de la
 * coquille Capacitor. Best-effort : ne lève jamais.
 * @returns {Promise<'registered'|'skipped'|'error'>}
 */
export async function ensureNativePushRegistration() {
  const Capacitor = await getCapacitor();
  if (!Capacitor) return 'skipped';

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    await ensureChannels(PushNotifications);

    const perm = await PushNotifications.checkPermissions();
    let granted = perm.receive === 'granted';
    if (!granted && perm.receive !== 'denied') {
      const req = await PushNotifications.requestPermissions();
      granted = req.receive === 'granted';
    }
    if (!granted) return 'skipped';

    const registered = new Promise((resolve, reject) => {
      PushNotifications.addListener('registration', (token) => resolve(token.value));
      PushNotifications.addListener('registrationError', (err) => reject(new Error(err && err.error || 'Échec d’enregistrement FCM.')));
    });
    PushNotifications.addListener('pushNotificationActionPerformed', handleNotificationTap);

    await PushNotifications.register();
    const token = await registered;

    await apiPost('push-fcm-register', { action: 'register', platform: Capacitor.getPlatform(), token });
    return 'registered';
  } catch {
    return 'error';
  }
}
