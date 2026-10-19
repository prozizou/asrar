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
      // Longueur du mois si l'API la fournit (29 ou 30), sinon null.
      monthDays: Number(h.month.days) || null,
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
      ...frenchGregorian(g.date),
    },
  };
}

const FR_DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const FR_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// « Lundi » / « 19 octobre 2026 » à partir du DD-MM-YYYY de l'API.
function frenchGregorian(ddmmyyyy) {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(ddmmyyyy || '');
  if (!m) return { weekdayFr: '', dateFr: ddmmyyyy || '' };
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return { weekdayFr: FR_DAYS[d.getDay()], dateFr: `${Number(m[1])} ${FR_MONTHS[Number(m[2]) - 1]} ${m[3]}` };
}

export async function fetchHijriToday(date = new Date(), signal) {
  const res = await fetch(`${API}/${formatApiDate(date)}`, { signal });
  if (!res.ok) throw new Error(`AlAdhan ${res.status}`);
  const parsed = parseHijriResponse(await res.json());
  if (!parsed) throw new Error('Réponse AlAdhan inattendue');
  return parsed;
}

// Calendrier d'un mois GRÉGORIEN avec la date hijri de chaque jour
// (GET /v1/gToHCalendar/{mois}/{année}). Renvoie [{ day, monthEn, date }] où
// `date` est un Date local (minuit) et `day` le jour hijri (nombre).
export function parseHijriCalendar(json) {
  if (!json || !Array.isArray(json.data)) return null;
  const out = [];
  for (const e of json.data) {
    const g = e && e.gregorian && /^(\d{2})-(\d{2})-(\d{4})$/.exec(e.gregorian.date || '');
    const day = Number(e && e.hijri && e.hijri.day);
    if (!g || !day) return null;
    out.push({
      day,
      monthEn: e.hijri.month && e.hijri.month.en,
      date: new Date(Number(g[3]), Number(g[2]) - 1, Number(g[1])),
    });
  }
  return out;
}

export async function fetchHijriCalendar(month, year, signal) {
  const res = await fetch(`https://api.aladhan.com/v1/gToHCalendar/${month}/${year}`, { signal });
  if (!res.ok) throw new Error(`AlAdhan ${res.status}`);
  const parsed = parseHijriCalendar(await res.json());
  if (!parsed) throw new Error('Réponse AlAdhan inattendue');
  return parsed;
}
