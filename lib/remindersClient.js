'use client';
// lib/remindersClient.js — Client des préférences de rappel de wird quotidien
// (pages/api/reminders.js). Fine enveloppe autour de apiPost, comme
// lib/zikrCollectif.js autour de /api/zikr : aucune lecture RTDB directe
// côté navigateur.
import { apiPost } from './api';

export function getReminderSettings() {
  return apiPost('reminders', { action: 'get' });
}

export function setReminderSettings({ wirdEnabled, wirdHour, wirdMinute, tz }) {
  return apiPost('reminders', { action: 'set', wirdEnabled, wirdHour, wirdMinute, tz });
}
