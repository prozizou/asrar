import { describe, it, expect } from 'vitest';
import { upcomingPhaseStarts, reminderIdFor, reminderContent } from './hijriReminders';
import { parseHijriCalendar } from './hijri';

const d = (day, y, m, dd) => ({ day, monthEn: 'Rabi', date: new Date(y, m - 1, dd) });

describe('upcomingPhaseStarts', () => {
  const days = [d(14, 2026, 10, 1), d(16, 2026, 10, 3), d(30, 2026, 10, 17), d(1, 2026, 10, 18), d(2, 2026, 10, 19)];

  it('ne garde que les jours 1 et 16 à venir, triés', () => {
    const r = upcomingPhaseStarts(days, new Date(2026, 9, 1, 12));
    expect(r.map((s) => [s.day, s.phase])).toEqual([[16, 'repoussement'], [1, 'attraction']]);
    expect(r[0].triggerAt).toEqual(new Date(2026, 9, 3, 7, 0));
  });

  it('ignore un rappel dont l’heure est déjà passée', () => {
    const r = upcomingPhaseStarts(days, new Date(2026, 9, 3, 8, 0));
    expect(r.map((s) => s.day)).toEqual([1]);
  });

  it('id stable et int32', () => {
    const id = reminderIdFor(new Date(2026, 9, 3));
    expect(id).toBe(920261003);
    expect(id).toBeLessThan(2147483647);
  });

  it('contenu', () => {
    const [s] = upcomingPhaseStarts(days, new Date(2026, 9, 1, 12));
    expect(reminderContent(s).title).toContain('repoussement');
  });
});

describe('parseHijriCalendar', () => {
  it('analyse la réponse du calendrier', () => {
    const r = parseHijriCalendar({ data: [{ hijri: { day: '16', month: { en: 'Rabi' } }, gregorian: { date: '03-10-2026' } }] });
    expect(r).toEqual([{ day: 16, monthEn: 'Rabi', date: new Date(2026, 9, 3) }]);
  });
  it('null si invalide', () => {
    expect(parseHijriCalendar({})).toBeNull();
    expect(parseHijriCalendar({ data: [{}] })).toBeNull();
  });
});
