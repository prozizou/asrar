export const ORDER_LABELS = {
  whatsapp_request: 'Demande WhatsApp', confirmed: 'Confirmée', paid: 'Payée — déclaration manuelle',
  delivered: 'Livrée', cancelled: 'Annulée', legacy_request: 'Ancienne demande non vérifiée',
};
export const ORDER_TRANSITIONS = {
  whatsapp_request: ['confirmed', 'cancelled'], confirmed: ['paid', 'cancelled'], paid: ['delivered'], delivered: [], cancelled: [],
};

export function formatOrderPrice(amount, currency = 'FCFA') {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return 'Prix non vérifié';
  if (amount === 0) return 'Gratuit';
  return amount.toLocaleString('fr-FR', { maximumFractionDigits: 2 }).replace(/[\u202f\u00a0]/g, ' ') + ' ' + currency;
}
