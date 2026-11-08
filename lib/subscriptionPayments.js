import { SUB_PLANS } from './plans';

const WAVE_MERCHANT = 'https://pay.wave.com/m/M_sn_6W-tuxFYYkZa/c/sn/';
// Adresse de réception réelle fournie par l’éditeur. La copie ne valide aucun paiement.
export const PISPI_ALIAS = '2b26c0d5-7673-46fa-82c8-7c124cc6d33d';

export function subscriptionWaveUrl(planId) {
  const plan = SUB_PLANS.find((item) => item.id === planId);
  if (!plan) throw new Error('Formule d’abonnement inconnue.');
  const url = new URL(WAVE_MERCHANT);
  url.searchParams.set('amount', String(plan.level));
  return url.href;
}
