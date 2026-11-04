import { describe, it, expect } from 'vitest';
import { orderWhatsAppMessage, whatsappAmount } from './whatsappMessages';
describe('Messages WhatsApp aérés', () => {
  it('organise les données serveur, le prix lisible et la référence courte sans confirmer un achat', () => {
    const text = orderWhatsAppMessage({ produit: 'Livre protection', vendeur: 'Asrar Pro boutique', prix: 30000, devise: 'FCFA' }, '3eb1d43061910d1d26f621fb0a541b2fb5f713cc84f6c966553e9efa3879bae9');
    expect(text).toContain('Assalamou aleykoum 🌙\n\n*DEMANDE DE DISPONIBILITÉ*\n\n');
    expect(text).toContain('*Prix affiché :* 30 000 FCFA'); expect(text).toContain('*Référence :* 3eb1d4306191');
    expect(text).not.toContain('f6c966553e9'); expect(text).toContain('Cette demande ne confirme aucun achat.');
  });
  it('nettoie les sauts de ligne et le balisage des libellés sans permettre une fausse rubrique', () => {
    const text = orderWhatsAppMessage({ produit: '*Faux*\nPaiement confirmé', vendeur: 'Boutique', prix: 15000, devise: 'FCFA' }, '1234567890123456');
    expect(text).toContain('*Article :* Faux Paiement confirmé\n'); expect(whatsappAmount('45000')).toBe('45 000');
  });
});
