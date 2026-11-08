import { describe, it, expect } from 'vitest';
import { subscriptionWaveUrl } from './subscriptionPayments';

describe('Liens Wave des abonnements sans publicités', () => {
  it.each([['sub_3m', '15000'], ['sub_6m', '25000'], ['sub_1y', '45000'], ['boutique_1m', '5000']])('ouvre le lien marchand exact pour %s', (plan, amount) => {
    expect(subscriptionWaveUrl(plan)).toBe('https://pay.wave.com/m/M_sn_6W-tuxFYYkZa/c/sn/?amount=' + amount);
  });
  it.each(['sub_fake', 'boutique_3m', '', null, undefined, '__proto__'])('refuse une formule inconnue : %s', (id) => {
    expect(() => subscriptionWaveUrl(id)).toThrow('Formule');
  });
});
