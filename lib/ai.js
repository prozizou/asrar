'use client';
// Client de l'assistant IA (Gemini) — traduit un prompt en langage naturel en
// une action JSON typée, pilotant les champs déjà existants d'Al-Qalam ou de
// Géomancie (voir pages/api/ai.js). Ne génère aucun contenu affiché tel quel :
// chaque action est appliquée par la page appelante sur son propre état.
import { apiPost } from './api';

export async function askAI(module, prompt, context) {
  const data = await apiPost('ai', { module, prompt, context });
  return data.action;
}
