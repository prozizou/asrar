'use client';
// lib/notificationsClient.js — Client du centre de notifications
// (pages/api/notifications.js). Fine enveloppe autour de apiPost, comme
// lib/zikrCollectif.js autour de /api/zikr : aucune lecture RTDB directe
// côté navigateur.
import { apiPost } from './api';

export function listNotifications() {
  return apiPost('notifications', { action: 'list' });
}

export function markNotificationRead(notifId) {
  return apiPost('notifications', { action: 'markRead', notifId });
}

export function markAllNotificationsRead() {
  return apiPost('notifications', { action: 'markAllRead' });
}
