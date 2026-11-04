// Keep user-provided labels on one line, without injecting WhatsApp formatting.
export function whatsappField(value, limit = 180) {
  return String(value ?? '').replace(/[\r\n\u0000-\u001f*_~`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

export function whatsappAmount(value) {
  const amount = Number(String(value).replace(/\s/g, ''));
  return Number.isFinite(amount) ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(amount).replace(/[\u00a0\u202f]/g, ' ') : whatsappField(value);
}

export function orderWhatsAppMessage(order, id) {
  return [
    'Assalamou aleykoum 🌙', '', '*DEMANDE DE DISPONIBILITÉ*', '',
    `📦 *Article :* ${whatsappField(order.produit)}`,
    `🏪 *Boutique :* ${whatsappField(order.vendeur)}`,
    `💰 *Prix affiché :* ${whatsappAmount(order.prix)} ${whatsappField(order.devise, 12)}`, '',
    'Cet article est-il disponible ?',
    'Merci de m’indiquer les modalités de paiement et de livraison.', '',
    `🔖 *Référence :* ${id.slice(0, 12)}`, '',
    '_Cette demande ne confirme aucun achat._',
  ].join('\n');
}
