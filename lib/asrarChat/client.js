'use client';
// Client Asrar-chat : une seule enveloppe autour de /api/asrar-chat (apiPost,
// lib/api.js : jeton, délai, AbortController). Aucune écriture directe en
// base, sauf l'indicateur « en train d'écrire » (lib/asrarChat/live.js).
import { apiPost } from '../api';

export function ac(action, body = {}) {
  return apiPost('asrar-chat', { action, ...body });
}
