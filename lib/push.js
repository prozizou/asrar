'use client';
// lib/push.js — Abonnement aux notifications push d'heure planétaire.
// Demande la permission + la position GPS, s'abonne via l'API Push native du
// navigateur (chiffrement géré par le navigateur, clé publique VAPID), puis
// enregistre l'abonnement côté serveur (pages/api/push-subscribe.js) — c'est
// pages/api/cron/planet-push.js qui envoie réellement les notifications,
// périodiquement, indépendamment de toute page ouverte.
import { apiPost } from './api';

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

export async function subscribeToPush() {
  if (!pushSupported()) throw new Error('Notifications non prises en charge sur cet appareil.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Autorisation de notification refusée.');

  const { lat, lng } = await getPosition();

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  await apiPost('push-subscribe', { action: 'subscribe', subscription: sub.toJSON(), lat, lng });
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
