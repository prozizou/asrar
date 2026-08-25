// lib/progressive.js — Logique PURE du rendu progressif des listes.
//
// Les pages qui affichent des données Firebase (Marché, Secrets, Bibliothèque,
// 99 Noms) recevaient toute leur liste d'un coup et en rendaient chaque carte
// dans la même frame : sur téléphone, l'affichage se figeait le temps de
// monter des dizaines de cartes (images, sous-composants, lecture
// localStorage…). On en rend désormais un premier lot, puis un lot de plus
// chaque fois que le bas de liste approche (components/useProgressiveList.js).
//
// Aucune dépendance React : la décision « combien en afficher ensuite » est
// isolée ici pour être testable seule (même intention que lib/plans.js).

/** Taille de lot par défaut — assez pour remplir un écran, assez peu pour que
 *  le premier rendu reste instantané. */
export const DEFAULT_BATCH = 12;

/**
 * Nombre d'éléments à afficher après un cran de plus. Pure.
 * @param {number} shown combien sont affichés actuellement
 * @param {number} batch taille d'un lot
 * @param {number} total taille de la liste complète
 * @returns {number} borné à [0, total] — ne recule jamais, ne dépasse jamais.
 */
export function nextCount(shown, batch, total) {
  const t = Math.max(0, Math.floor(Number(total)) || 0);
  const s = Math.max(0, Math.floor(Number(shown)) || 0);
  const b = Math.floor(Number(batch)) || 0;
  // Un lot nul ou négatif afficherait la liste par tranches de rien : on
  // retombe alors sur le comportement d'origine (tout afficher) plutôt que de
  // laisser des éléments inatteignables.
  if (b <= 0) return t;
  return Math.min(s + b, t);
}
