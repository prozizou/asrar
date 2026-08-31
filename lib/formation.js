// lib/formation.js — Tarification "Formation mystique" (visioconférence à la minute).
//
// Indépendant de l'abonnement (voir lib/plans.js SUB_PLANS/FREE_FOR_ALL, qui ne
// couvrent pas ce module — décision explicite : tout le monde, abonné ou non,
// paie ses minutes de visioconférence séparément). Le tarif est ADMIN-
// CONFIGURABLE par formation (champ "pricePerMinute", admin-asrar-pro
// openFormationCreator) — ce module ne fait que fournir la valeur par défaut
// et le calcul, pas de dépendance React/Firebase (importable client + serveur).

// Tarif par défaut si l'admin n'a pas renseigné pricePerMinute sur la formation
// (ex. donné par l'utilisateur : 250 FCFA/minute).
export const DEFAULT_PRICE_PER_MINUTE = 250;

export function pricePerMinuteOf(formation) {
  const v = Number(formation && formation.pricePerMinute);
  return v > 0 ? v : DEFAULT_PRICE_PER_MINUTE;
}

export function formationMinutesPrice(formation, minutes) {
  const m = Number(minutes) > 0 ? Number(minutes) : 0;
  return m * pricePerMinuteOf(formation);
}
