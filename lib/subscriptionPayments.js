import { BOUTIQUE_PLAN, SUB_PLANS } from './plans';

// Formules payables par Wave : abonnements et boutique du Marché.
const PAYABLE_PLANS = [...SUB_PLANS, BOUTIQUE_PLAN];

const WAVE_MERCHANT = 'https://pay.wave.com/m/M_sn_6W-tuxFYYkZa/c/sn/';
// Adresse de réception réelle fournie par l’éditeur. La copie ne valide aucun paiement.
export const PISPI_ALIAS = '2b26c0d5-7673-46fa-82c8-7c124cc6d33d';

export function subscriptionWaveUrl(planId) {
  const plan = PAYABLE_PLANS.find((item) => item.id === planId);
  if (!plan) throw new Error('Formule d’abonnement inconnue.');
  const url = new URL(WAVE_MERCHANT);
  url.searchParams.set('amount', String(plan.level));
  return url.href;
}

// Contribution libre (fenêtre « Soutenir ASRAR PRO ») : même bénéficiaire Wave,
// sans montant imposé — l'utilisateur le saisit dans Wave.
export function supportWaveUrl() {
  return WAVE_MERCHANT;
}
