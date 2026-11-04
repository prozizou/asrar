import { SUB_PLANS } from './plans';

const WAVE_MERCHANT = 'https://pay.wave.com/m/M_sn_6W-tuxFYYkZa/c/sn/';

export function subscriptionWaveUrl(planId) {
  const plan = SUB_PLANS.find((item) => item.id === planId);
  if (!plan) throw new Error('Formule d’abonnement inconnue.');
  const url = new URL(WAVE_MERCHANT);
  url.searchParams.set('amount', String(plan.level));
  return url.href;
}
