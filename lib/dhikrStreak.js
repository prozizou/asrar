// lib/dhikrStreak.js — Série de jours consécutifs de dhikr + badges de série.
//
// Portée GLOBALE (pas par nom) : ce qui compte pour la série, c'est d'avoir
// terminé AU MOINS UN objectif de dhikr dans la journée, quel que soit le nom
// récité — useTasbih.js reste par nom (compteur/objectif/séries propres à
// chaque nom), cette série est un système séparé, au-dessus.
//
// Logique de calcul de série SÉPARÉE de la persistance (localStorage) : la
// première partie est pure et testée (lib/dhikrStreak.test.js), la seconde
// (getStreak/recordCompletion) ne peut pas l'être facilement sans DOM.

const KEY_LAST_DATE = 'dhikr_streak_last_date'; // AAAA-MM-JJ (fuseau local)
const KEY_CURRENT = 'dhikr_streak_current';
const KEY_BEST = 'dhikr_streak_best';

// Seuils (en jours de série) qui débloquent un badge. Vérifié une fois par
// franchissement — un badge reste acquis même si la série casse ensuite.
export const STREAK_BADGES = [
  { days: 3, icon: '🔥', label: '3 jours' },
  { days: 7, icon: '🕯️', label: '1 semaine' },
  { days: 30, icon: '🌙', label: '1 mois' },
  { days: 100, icon: '⭐', label: '100 jours' },
];

function dateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/**
 * Décide le nouvel état de série à partir de l'état précédent — pure,
 * `now` injectable (tests). Ne fait aucune I/O.
 * @param {{current:number, lastDateKey:string|null}} state
 * @param {Date} [now]
 * @returns {{current:number, lastDateKey:string, changed:boolean}} changed=false
 *   si un objectif avait déjà été atteint aujourd'hui (rien à recompter).
 */
export function computeNextStreak({ current, lastDateKey }, now = new Date()) {
  const today = dateKey(now);
  if (lastDateKey === today) return { current, lastDateKey, changed: false };

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isConsecutive = lastDateKey === dateKey(yesterday);

  return { current: isConsecutive ? current + 1 : 1, lastDateKey: today, changed: true };
}

/** Badge tout juste franchi pour une série de `days` jours, ou null. */
export function badgeForStreak(days) {
  return STREAK_BADGES.find((b) => b.days === days) || null;
}

function readInt(key) {
  try {
    return parseInt(localStorage.getItem(key), 10) || 0;
  } catch {
    return 0;
  }
}
function readStr(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

/** État courant, pour affichage (composant Tasbih/en-tête de page). */
export function getStreak() {
  return { current: readInt(KEY_CURRENT), best: readInt(KEY_BEST), lastDate: readStr(KEY_LAST_DATE) };
}

/**
 * À appeler quand un objectif de dhikr est ATTEINT (pas à chaque grain —
 * voir useTasbih.js, branche `goalDone`).
 * @param {Date} [now] horloge injectable (tests)
 * @returns {{days:number, icon:string, label:string}|null} le badge
 *   fraîchement débloqué par cet appel, ou null (série déjà comptée
 *   aujourd'hui, ou aucun seuil franchi).
 */
export function recordCompletion(now = new Date()) {
  const state = getStreak();
  const result = computeNextStreak({ current: state.current, lastDateKey: state.lastDate }, now);
  if (!result.changed) return null;

  write(KEY_CURRENT, result.current);
  write(KEY_BEST, Math.max(state.best, result.current));
  write(KEY_LAST_DATE, result.lastDateKey);

  return badgeForStreak(result.current);
}
