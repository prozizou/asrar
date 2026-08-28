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
export function createGroup({ name, presetId, arabic, target }) {
  return apiPost('zikr', { action: 'create', name, presetId, arabic, target });
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
// Avancement ABSOLU du membre (pas un incrément), plus son rythme instantané
// (grains/minute) : le client envoie sa valeur `fait` courante, l'appel est
// donc idempotent et sûr à répéter (débattu côté page : un envoi ~1,5 s après
// la dernière frappe).
export function saveProgress(groupId, fait, rythme) {
  return apiPost('zikr', { action: 'progress', groupId, fait, rythme });
}
// Avertissement privé à un clic (créateur → participant) et son effacement
// par le participant concerné une fois lu.
export function warnMember(groupId, uid) {
  return apiPost('zikr', { action: 'warn', groupId, uid });
}
export function dismissWarning(groupId) {
  return apiPost('zikr', { action: 'dismissWarning', groupId });
}
// Exclusion par le créateur (jamais sur lui-même — voir pages/api/zikr.js).
export function excludeMember(groupId, uid) {
  return apiPost('zikr', { action: 'exclude', groupId, uid });
}
export function leaveGroup(groupId) {
  return apiPost('zikr', { action: 'leave', groupId });
}
export function deleteGroup(groupId) {
  return apiPost('zikr', { action: 'delete', groupId });
}

// Aligne le compteur LOCAL (cet appareil) sur ce qui est déjà enregistré sur
// le compte, s'il est en retard — à appeler avant d'ouvrir le compteur d'un
// Zikr collectif. Sans ça, le même compte ouvert pour la première fois sur
// un second appareil repartirait de zéro localement, et le garde-fou
// anti-régression côté serveur (jamais un `fait` qui redescend, cf.
// pages/api/zikr.js handleProgress) empêcherait alors toute nouvelle frappe
// de compter tant que le compteur local n'a pas rattrapé le retard. Pure
// lecture/écriture localStorage (pas d'appel réseau), silencieuse en cas
// d'échec (navigation privée, quota) — jamais bloquante.
export function restoreLocalCount(groupId, uid, fait) {
  const key = `tasbih_asma_collectif_${groupId}_${uid}`;
  try {
    const current = parseInt(localStorage.getItem(key) || '', 10) || 0;
    if (fait > current) localStorage.setItem(key, String(fait));
  } catch {
    // Stockage indisponible — silencieux, best effort.
  }
}
