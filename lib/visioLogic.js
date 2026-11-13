// lib/visioLogic.js — Visioconférences Google Meet : validation PURE, partagée
// par le formulaire (app/visio/page.tsx) et l'API qui fait autorité
// (pages/api/visio.js). Aucun accès réseau ni RTDB.

export const TITLE_MAX = 80;
export const DESCRIPTION_MAX = 500;
export const DURATION_MIN = 15;
export const DURATION_MAX = 240;
export const DURATION_DEFAULT = 60;
// Une réunion se programme au plus 90 jours à l'avance.
export const HORIZON_MS = 90 * 24 * 3600 * 1000;
// Petite marge : un horaire « maintenant » saisi il y a une minute reste valide.
const PAST_TOLERANCE_MS = 10 * 60 * 1000;
// Une réunion terminée reste affichée une heure, puis disparaît de la liste.
export const ENDED_GRACE_MS = 60 * 60 * 1000;
// Le bouton « Rejoindre » est mis en avant 15 minutes avant le début.
export const JOIN_EARLY_MS = 15 * 60 * 1000;

const MEET_CODE = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

/**
 * Lien Google Meet normalisé (https://meet.google.com/abc-defg-hij), ou ''
 * s'il ne s'agit pas d'un lien de réunion Google Meet. Seul ce format est
 * accepté : aucun autre site ne peut être diffusé à tous les utilisateurs.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeMeetUrl(value) {
  let s = String(value || '').trim();
  if (!s || s.length > 200) return '';
  if (MEET_CODE.test(s.toLowerCase())) return 'https://meet.google.com/' + s.toLowerCase();
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let url;
  try { url = new URL(s); } catch { return ''; }
  if (url.hostname.toLowerCase() !== 'meet.google.com' || url.username || url.password || url.port) return '';
  const code = url.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  return MEET_CODE.test(code) ? 'https://meet.google.com/' + code : '';
}

function cleanLine(value, max) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanParagraph(value, max) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

/**
 * Valide et normalise une réunion saisie par un utilisateur.
 * @param {{title?: unknown, description?: unknown, meetUrl?: unknown, startAt?: unknown, durationMin?: unknown}} input
 * @param {number} now epoch ms
 * @returns {{error: 'title'|'meetUrl'|'startAt'|'past'|'horizon'|'duration'} | {error?: undefined, value: {title: string, description: string, meetUrl: string, startAt: number, durationMin: number}}}
 */
export function normalizeMeetingInput(input, now) {
  const title = cleanLine(input?.title, TITLE_MAX);
  if (!title) return { error: 'title' };
  const meetUrl = normalizeMeetUrl(input?.meetUrl);
  if (!meetUrl) return { error: 'meetUrl' };
  const startAt = Math.floor(Number(input?.startAt));
  if (!Number.isFinite(startAt) || startAt <= 0) return { error: 'startAt' };
  if (startAt < now - PAST_TOLERANCE_MS) return { error: 'past' };
  if (startAt > now + HORIZON_MS) return { error: 'horizon' };
  const durationMin = Math.floor(Number(input?.durationMin ?? DURATION_DEFAULT));
  if (!Number.isFinite(durationMin) || durationMin < DURATION_MIN || durationMin > DURATION_MAX) return { error: 'duration' };
  return { value: { title, description: cleanParagraph(input?.description, DESCRIPTION_MAX), meetUrl, startAt, durationMin } };
}

/** @type {Record<string, string>} */
export const MEETING_ERRORS = {
  title: 'Donnez un titre à la visioconférence.',
  meetUrl: 'Collez un lien Google Meet valide (ex. https://meet.google.com/abc-defg-hij).',
  startAt: 'Choisissez la date et l’heure de début.',
  past: 'La date de début est déjà passée.',
  horizon: 'La visioconférence doit avoir lieu dans les 90 prochains jours.',
  duration: `Durée invalide (entre ${DURATION_MIN} et ${DURATION_MAX} minutes).`,
};

/** Fin prévue (epoch ms). */
export function endOf(meeting) {
  return (Number(meeting?.startAt) || 0) + (Number(meeting?.durationMin) || DURATION_DEFAULT) * 60_000;
}

/**
 * Phase d'une réunion à l'instant `now`.
 * @returns {'upcoming'|'soon'|'live'|'ended'}
 */
export function meetingPhase(meeting, now) {
  const start = Number(meeting?.startAt) || 0;
  if (now >= endOf(meeting)) return 'ended';
  if (now >= start) return 'live';
  if (now >= start - JOIN_EARLY_MS) return 'soon';
  return 'upcoming';
}

/** Encore affichée : pas terminée depuis plus d'une heure. */
export function isListed(meeting, now) {
  return now < endOf(meeting) + ENDED_GRACE_MS;
}
