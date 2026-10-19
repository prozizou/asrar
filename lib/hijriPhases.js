// lib/hijriPhases.js — phase du mois hijri pour le choix des travaux.
//   jours 1 à 15            → « attraction » (jalb) : on attire le bien
//   jour 16 à la fin (29/30) → « repoussement » (daf') : on éloigne le mal
// Les textes de suggestion sont NEUTRES (à remplacer par le contenu voulu).

export const PHASE_ATTRACTION = 'attraction';
export const PHASE_REPOUSSEMENT = 'repoussement';

export const PHASES = {
  [PHASE_ATTRACTION]: {
    id: PHASE_ATTRACTION,
    title: "Période d'attraction",
    arabic: 'جلب',
    icon: '🌒',
    range: 'Du 1er au 15 du mois',
    tagline: 'Temps favorable pour attirer le bien.',
    summary: 'Du 1er au 15 du mois : temps favorable pour attirer le bien.',
    suggestions: [
      { label: 'Attirer le bien, la subsistance et l’ouverture', href: '/rouwhania', cta: 'Rouwhanes' },
      { label: 'Dhikr régulier pour accompagner l’intention', href: '/zikr', cta: 'Zikr collectif' },
      { label: 'Calculer les noms et correspondances', href: '/combinaisons', cta: 'Combinaisons' },
    ],
  },
  [PHASE_REPOUSSEMENT]: {
    id: PHASE_REPOUSSEMENT,
    title: 'Période de repoussement',
    arabic: 'دفع',
    icon: '🌘',
    range: 'Du 16 à la fin du mois (29 ou 30)',
    tagline: 'Temps favorable pour éloigner le mal.',
    summary: 'Du 16 à la fin du mois (29 ou 30) : temps favorable pour éloigner le mal.',
    suggestions: [
      { label: 'Protection et éloignement des nuisances', href: '/rouwhania', cta: 'Rouwhanes' },
      { label: 'Dhikr de protection', href: '/zikr', cta: 'Zikr collectif' },
      { label: 'Tirage pour y voir clair', href: '/geomancie', cta: 'Géomancie' },
    ],
  },
};

/**
 * @param {number|string} day jour hijri (1..30)
 * @param {number|null} [monthDays] 29, 30 ou null si inconnu
 */
export function phaseOfDay(day, monthDays = null) {
  const d = Number(day);
  if (!Number.isInteger(d) || d < 1 || d > 30) return null;
  const phase = d <= 15 ? PHASES[PHASE_ATTRACTION] : PHASES[PHASE_REPOUSSEMENT];
  const start = d <= 15 ? 1 : 16;
  const end = d <= 15 ? 15 : (monthDays || null);
  const total = end ? end - start + 1 : null;
  return {
    ...phase,
    dayInPhase: d - start + 1,
    totalDays: total,
    // Jours restants AVANT le changement de phase (0 = dernier jour). Null si
    // la longueur du mois est inconnue en seconde phase.
    daysLeft: end ? Math.max(0, end - d) : null,
    // Part des jours de la période déjà ÉCOULÉS (hors jour en cours), en %.
    elapsedPct: total ? Math.round(((d - start) / total) * 100) : null,
  };
}
