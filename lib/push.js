'use client';
// Notifications push (FCM Web Push) — abonnement au topic "new-content"
// (nouveau secret, document ou produit ajouté). Nécessite un service worker
// déjà enregistré (voir components/PwaGate.js) et un navigateur supportant
// la Push API (pas de repli : on informe l'utilisateur si indisponible).
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app, VAPID_KEY } from './firebase';
import { apiPost } from './api';

const TOKEN_STORAGE_KEY = 'asrar_push_token';

let messagingPromise = null;
function getMessagingIfSupported() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!messagingPromise) {
    messagingPromise = isSupported()
      .then((ok) => (ok ? getMessaging(app) : null))
      .catch(() => null);
  }
  return messagingPromise;
}

// Demande la permission, récupère un jeton FCM et l'enregistre côté serveur
// (abonnement au topic "new-content" + mémorisation pour cet utilisateur).
export async function enablePush() {
  if (typeof Notification === 'undefined') throw new Error('Notifications non supportées sur ce navigateur.');
  const messaging = await getMessagingIfSupported();
  if (!messaging) throw new Error('Notifications non supportées sur ce navigateur.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permission refusée.');

  const reg = await navigator.serviceWorker.ready;
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
  if (!token) throw new Error("Impossible d'obtenir un jeton de notification.");

  await apiPost('push', { action: 'subscribe', token });
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {}
  return token;
}

export async function disablePush() {
  let token = null;
  try {
    token = localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {}
  if (token) {
    await apiPost('push', { action: 'unsubscribe', token }).catch(() => {});
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {}
  }
}

export function isPushEnabled() {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return false;
  let token = null;
  try {
    token = localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {}
  return Notification.permission === 'granted' && !!token;
}

// Messages reçus pendant que l'app est au premier plan (onglet actif) :
// onMessage() ne déclenche PAS l'affichage natif, contrairement à l'onglet
// en arrière-plan (géré par le service worker, voir public/sw.js).
export function listenForegroundMessages(onMsg) {
  let unsub = () => {};
  let cancelled = false;
  getMessagingIfSupported().then((messaging) => {
    if (!messaging || cancelled) return;
    unsub = onMessage(messaging, onMsg);
  });
  return () => {
    cancelled = true;
    unsub();
  };
}
