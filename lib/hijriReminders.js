// lib/hijriReminders.js — rappels de début de phase (jour hijri 1 et 16).
// Logique pure ; la programmation native est dans lib/hijriRemindersNative.js.
import { PHASE_ATTRACTION, PHASE_REPOUSSEMENT, PHASES } from './hijriPhases';

export const REMINDER_HOUR = 7; // heure locale du rappel, le jour même

// Identifiant int32 stable par date (même jour → même id : idempotent).
export function reminderIdFor(date) {
  const ymd = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  return 900000000 + (ymd % 100000000); // < 2^31-1 pour toute année < 3000
}

/**
 * @param {{day:number, monthEn?:string, date:Date}[]} days jours issus de parseHijriCalendar
 * @param {Date} now
 * @returns début de phase à venir : [{ id, phase, triggerAt, monthEn, day }]
 */
export function upcomingPhaseStarts(days, now) {
  const seen = new Set();
  const out = [];
  for (const d of days) {
    if (d.day !== 1 && d.day !== 16) continue;
    const triggerAt = new Date(d.date.getFullYear(), d.date.getMonth(), d.date.getDate(), REMINDER_HOUR, 0, 0);
    if (triggerAt.getTime() <= now.getTime()) continue;
    const id = reminderIdFor(d.date);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      phase: d.day === 1 ? PHASE_ATTRACTION : PHASE_REPOUSSEMENT,
      triggerAt,
      monthEn: d.monthEn || '',
      day: d.day,
    });
  }
  return out.sort((a, b) => a.triggerAt.getTime() - b.triggerAt.getTime());
}

export function reminderContent(start) {
  const p = PHASES[start.phase];
  const when = `${start.day === 1 ? '1er' : start.day} ${start.monthEn}`.trim();
  return { title: `${p.icon} ${p.title}`, body: `Début de la période — ${when}. ${p.summary}` };
}
