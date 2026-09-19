'use client';
// lib/remindersClient.js — Client des préférences de rappel de wird
// quotidien ET de contenu quotidien (pages/api/reminders.js). Fine
// enveloppe autour de apiPost, comme lib/zikrCollectif.js autour de
// /api/zikr : aucune lecture RTDB/Firestore directe côté navigateur.
import { apiPost } from './api';

export function getReminderSettings() {
  return apiPost('reminders', { action: 'get' });
}

// Mise à jour PARTIELLE : un appelant (WirdReminderToggle, DailyContentCard)
// n'a besoin de passer QUE les champs qu'il modifie — voir pages/api/
// reminders.js, action="set", qui ne touche que les clés reçues. `tz` est
// systématiquement renvoyé par les deux appelants (Intl.DateTimeFormat
// locale), même quand seul l'autre réglage change : autant garder le fuseau
// stocké à jour à chaque interaction plutôt que de le figer au premier essai.
export function setReminderSettings({ wirdEnabled, wirdHour, wirdMinute, dailyContentEnabled, tz }) {
  return apiPost('reminders', { action: 'set', wirdEnabled, wirdHour, wirdMinute, dailyContentEnabled, tz });
}
