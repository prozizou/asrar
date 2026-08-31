'use client';
// Contact WhatsApp — port de js/whatsapp.js (portion « accès premium »).
// Le numéro reste côté serveur (/api/wa lit WHATSAPP_NUMBER et redirige).
import { auth } from './firebase';

const CONTACT = 'ASRAR PRO';
const ENDPOINT = '/api/wa';

const PLANS = {
  sub_3m: { label: 'Abonnement 3 Mois', price: '15 000' },
  sub_6m: { label: 'Abonnement 6 Mois', price: '25 000' },
  sub_1y: { label: 'Abonnement 1 An', price: '45 000' },
  boutique_1m: { label: 'Boutique 1 Mois', price: '10 000' },
  boutique_3m: { label: 'Boutique 3 Mois', price: '25 000' },
};

function currentEmail() {
  try {
    const u = auth.currentUser;
    if (u && u.email) return u.email;
  } catch {}
  return '';
}

function link(message) {
  return ENDPOINT + '?text=' + encodeURIComponent(message || '');
}

function accessMessage(opts = {}) {
  const p = opts.planId ? PLANS[opts.planId] : null;
  const L = ['Assalamou aleykoum 🌙', 'Je souhaite activer mon accès premium sur ' + CONTACT + '.', ''];
  if (opts.email) L.push('• Compte (e-mail) : ' + opts.email);
  if (p) L.push('• Formule souhaitée : ' + p.label + ' — ' + p.price + ' FCFA');
  if (opts.section) L.push('• Rubrique : ' + opts.section);
  L.push('');
  L.push("Merci de m'indiquer les modalités de paiement et d'activer mon accès. Barakallahou fikoum.");
  return L.join('\n');
}

export function openAccess(opts = {}) {
  if (!opts.email) opts.email = currentEmail();
  window.open(link(accessMessage(opts)), '_blank', 'noopener');
}

// Réservation de minutes de visioconférence — Formation mystique (paiement à
// la minute, indépendant de l'abonnement). L'admin accorde manuellement les
// minutes après paiement (admin-asrar-pro, formation_access/{formationKey}) —
// voir app/formation/page.tsx et lib/formation.js pour le calcul du prix.
function formationBookingMessage(opts = {}) {
  const L = ['Assalamou aleykoum 🌙', 'Je souhaite réserver une session de visioconférence sur ' + CONTACT + '.', ''];
  if (opts.email) L.push('• Compte (e-mail) : ' + opts.email);
  if (opts.formation) L.push('• Formation : ' + opts.formation);
  if (opts.minutes) L.push('• Minutes souhaitées : ' + opts.minutes + ' min');
  if (opts.price) L.push('• Total estimé : ' + opts.price + ' FCFA');
  L.push('');
  L.push("Merci de m'indiquer les modalités de paiement et de créditer mes minutes. Barakallahou fikoum.");
  return L.join('\n');
}

export function openFormationBooking(opts = {}) {
  if (!opts.email) opts.email = currentEmail();
  window.open(link(formationBookingMessage(opts)), '_blank', 'noopener');
}
