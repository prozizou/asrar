// lib/hijri.js — date du jour dans le calendrier islamique, via l'API
// publique AlAdhan (https://aladhan.com/islamic-calendar-api).
// Endpoint : GET /v1/gToH/{DD-MM-YYYY} (conversion grégorien → hijri).

const API = 'https://api.aladhan.com/v1/gToH';

// L'API attend DD-MM-YYYY, en date LOCALE de l'utilisateur.
export function formatApiDate(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${date.getFullYear()}`;
}

// Normalise la réponse brute ; renvoie null si elle n'a pas la forme attendue.
export function parseHijriResponse(json) {
  const d = json && json.data;
  const h = d && d.hijri;
  const g = d && d.gregorian;
  if (!h || !g || !h.month || !h.weekday) return null;
  return {
    hijri: {
      day: String(h.day).replace(/^0/, ''),
      monthNumber: h.month.number,
      monthEn: h.month.en,
      monthAr: h.month.ar,
      year: h.year,
      weekdayEn: h.weekday.en,
      weekdayAr: h.weekday.ar,
      holidays: Array.isArray(h.holidays) ? h.holidays : [],
    },
    gregorian: {
      date: g.date,
      day: String(g.day).replace(/^0/, ''),
      monthEn: g.month && g.month.en,
      year: g.year,
      weekdayEn: g.weekday && g.weekday.en,
    },
  };
}

export async function fetchHijriToday(date = new Date(), signal) {
  const res = await fetch(`${API}/${formatApiDate(date)}`, { signal });
  if (!res.ok) throw new Error(`AlAdhan ${res.status}`);
  const parsed = parseHijriResponse(await res.json());
  if (!parsed) throw new Error('Réponse AlAdhan inattendue');
  return parsed;
}
