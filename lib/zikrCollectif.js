'use client';
// Client du Zikr collectif — fines enveloppes autour de /api/zikr (apiPost,
// lib/api.js : déjà robuste, délai + AbortController). Aucune lecture RTDB
// directe côté navigateur (cf. l'historique /api/check-access, /api/social).
// La logique de validation/progression PURE vit dans lib/zikrLogic.js (partagée
// avec le serveur) ; ici, uniquement les appels réseau.
import { apiPost } from './api';

export function listGroups() {
  return apiPost('zikr', { action: 'list' });
}
export function createGroup({ name, phrase, target }) {
  return apiPost('zikr', { action: 'create', name, phrase, target });
}
export function getGroup(groupId) {
  return apiPost('zikr', { action: 'get', groupId });
}
export function joinGroup(groupId) {
  return apiPost('zikr', { action: 'join', groupId });
}
export function approveMember(groupId, uid) {
  return apiPost('zikr', { action: 'approve', groupId, uid });
}
export function rejectMember(groupId, uid) {
  return apiPost('zikr', { action: 'reject', groupId, uid });
}
export function contribute(groupId, amount) {
  return apiPost('zikr', { action: 'contribute', groupId, amount });
}
export function leaveGroup(groupId) {
  return apiPost('zikr', { action: 'leave', groupId });
}
export function deleteGroup(groupId) {
  return apiPost('zikr', { action: 'delete', groupId });
}
