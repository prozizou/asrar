import { describe, it, expect } from 'vitest';
import { formatApiDate, parseHijriResponse } from './hijri';

describe('hijri', () => {
  it('formate la date en DD-MM-YYYY', () => {
    expect(formatApiDate(new Date(2026, 0, 5))).toBe('05-01-2026');
  });

  it('normalise la réponse AlAdhan', () => {
    const r = parseHijriResponse({
      data: {
        hijri: { day: '07', month: { number: 4, en: 'Rabīʿ al-thānī', ar: 'رَبيع الثاني' }, year: '1448', weekday: { en: 'Al Athnain', ar: 'الاثنين' }, holidays: [] },
        gregorian: { date: '19-10-2026', day: '19', month: { en: 'October' }, year: '2026', weekday: { en: 'Monday' } },
      },
    });
    expect(r.hijri.day).toBe('7');
    expect(r.hijri.monthNumber).toBe(4);
    expect(r.gregorian.monthEn).toBe('October');
  });

  it('renvoie null si la forme est invalide', () => {
    expect(parseHijriResponse({})).toBeNull();
    expect(parseHijriResponse(null)).toBeNull();
  });
});
