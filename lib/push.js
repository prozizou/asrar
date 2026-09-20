'use client';
// lib/push.js — Abonnement aux notifications push d'heure planétaire.
// Demande la permission + la position GPS, s'abonne via l'API Push native du
// navigateur (chiffrement géré par le navigateur, clé publique VAPID), puis
// enregistre l'abonnement côté serveur (pages/api/push-subscribe.js) — c'est
// pages/api/cron/planet-push.js qui envoie réellement les notifications,
// périodiquement, indépendamment de toute page ouverte.
//
// L'abonnement navigateur enregistré ici (push_subscriptions/{uid}/{endpoint})
// est le MÊME canal réutilisé par TOUTES les notifications de l'app (heure
// planétaire, rappels, ET le centre de notifications — server/notify.js) :
// un seul abonnement par appareil, quel que soit ce qui l'a créé.
import { apiPost } from './api';
import { nextPushAction } from './pushDecision';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// L'API Push attend la clé serveur en Uint8Array, pas en base64 texte.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// false si : navigateur trop ancien, OU VAPID pas configuré côté serveur
// (NEXT_PUBLIC_VAPID_PUBLIC_KEY absente au build → fonctionnalité masquée
// proprement plutôt que de planter au clic).
export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY;
}

// 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'
export async function getPushSubscriptionState() {
  if (!pushSupported()) return 'unsupported';
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'subscribed' : 'unsubscribed';
  } catch {
    return 'unsubscribed';
  }
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Géolocalisation non disponible sur cet appareil.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err && err.code === 1 ? 'Accès à la position refusé.' : 'Position GPS indisponible.')),
      { timeout: 10000, maximumAge: 300000 }
    );
  });
}

// Abonnement navigateur brut (SANS l'enregistrer côté serveur) — factorisé
// car partagé par subscribeToPush (heure planétaire) et
// subscribeToPushReminders (wird/session Zikr collectif) : un même endpoint
// sert de canal d'envoi pour toutes les notifications, quelle que soit celle
// qui a déclenché l'abonnement navigateur en premier.
async function ensureBrowserSubscription() {
  if (!pushSupported()) throw new Error('Notifications non prises en charge sur cet appareil.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Autorisation de notification refusée.');

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  return sub;
}

export async function subscribeToPush() {
  const sub = await ensureBrowserSubscription();
  const { lat, lng } = await getPosition();
  await apiPost('push-subscribe', { action: 'subscribe', subscription: sub.toJSON(), lat, lng });
  return sub;
}

// Abonnement pour les rappels programmés (lib/reminders.js, app/rappels) —
// AUCUNE géolocalisation requise (pages/api/push-subscribe.js : lat/lng sont
// optionnels, seule l'heure planétaire en a besoin). Permet d'activer les
// notifications sans le prompt de position, pour qui ne veut que les rappels.
export async function subscribeToPushReminders() {
  const sub = await ensureBrowserSubscription();
  await apiPost('push-subscribe', { action: 'subscribe', subscription: sub.toJSON() });
  return sub;
}

export async function unsubscribeFromPush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  await apiPost('push-subscribe', { action: 'unsubscribe', endpoint }).catch(() => {});
}

// Mémorise, PAR NAVIGATEUR, que l'invite d'autorisation automatique a déjà
// été présentée une fois — voir nextPushAction (lib/pushDecision.js) : on ne
// la ré-affiche jamais tout seul, l'utilisateur repasse par la bannière
// manuelle du centre de notifications (app/notifications/page.tsx).
const PROMPTED_KEY = 'asrar_push_prompted';

/**
 * Appelée AUTOMATIQUEMENT juste après la connexion (components/
 * AuthProvider.js) pour que l'appareil reçoive de VRAIS push système même
 * quand l'app est fermée — sans dépendre du sondage HTTPS, qui ne sert qu'à
 * synchroniser le centre de notifications app ouverte.
 *
 *   - autorisation déjà accordée → (ré)abonne EN SILENCE et réenregistre
 *     l'abonnement côté serveur (idempotent : couvre un nouvel appareil, un
 *     abonnement purgé, des données de site effacées) ;
 *   - jamais demandée → affiche l'invite UNE SEULE FOIS par navigateur ;
 *   - refusée / non supportée → ne fait rien.
 *
 * Best-effort : ne lève jamais (un échec d'abonnement ne doit pas perturber
 * la connexion) et ne montre aucune invite hors du cas prévu.
 * @returns {Promise<'subscribed'|'skipped'|'error'>}
 */
export async function ensurePushRegistration() {
  if (!pushSupported()) return 'skipped';
  let permission = 'default';
  try { permission = Notification.permission; } catch { return 'skipped'; }

  let promptedBefore = false;
  try { promptedBefore = localStorage.getItem(PROMPTED_KEY) === '1'; } catch {}

  const action = nextPushAction({ supported: true, permission, promptedBefore });
  if (action === 'skip') return 'skipped';

  // 'prompt' : on note l'invite AVANT de la présenter — même si l'utilisateur
  // refuse (ou ignore), on ne la relancera pas automatiquement.
  if (action === 'prompt') {
    try { localStorage.setItem(PROMPTED_KEY, '1'); } catch {}
  }

  // 'register' comme 'prompt' passent par subscribeToPushReminders() :
  // ensureBrowserSubscription() appelle requestPermission(), qui se résout
  // immédiatement (sans invite) quand l'autorisation est déjà accordée — donc
  // silencieux dans le cas 'register', invite native dans le cas 'prompt'.
  try {
    await subscribeToPushReminders();
    return 'subscribed';
  } catch {
    return 'error';
  }
}
