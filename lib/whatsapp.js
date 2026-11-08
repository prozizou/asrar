'use client';
// Contact WhatsApp — port de js/whatsapp.js (portion « accès premium »).
// Le numéro reste côté serveur (/api/wa lit WHATSAPP_NUMBER et redirige).
import { auth } from './firebase';
import { isNativeApp, openExternalInApp } from './externalWindow';
import { whatsappField } from './whatsappMessages';

const CONTACT = 'ASRAR PRO';
const ENDPOINT = '/api/wa';

const PLANS = {
  sub_3m: { label: 'Abonnement 3 Mois', price: '15 000' },
  sub_6m: { label: 'Abonnement 6 Mois', price: '25 000' },
  sub_1y: { label: 'Abonnement 1 An', price: '45 000' },
  boutique_1m: { label: 'Boutique 1 Mois', price: '5 000' },
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
  const L = ['Assalamou aleykoum 🌙', '', '*ABONNEMENT ' + CONTACT + '*',
    opts.noAds ? 'Je souhaite utiliser ASRAR PRO sans publicité.' : 'Je souhaite activer mon abonnement.', ''];
  if (p) L.push('*Formule :* ' + p.label, '*Montant :* ' + p.price + ' FCFA');
  if (opts.section) L.push('*Rubrique :* ' + whatsappField(opts.section));
  if (opts.email) L.push('', '*Compte ASRAR :*', whatsappField(opts.email, 254));
  const paymentMethod = opts.paidVia === 'wave' ? 'Wave' : opts.paidVia === 'pispi' ? 'PI-SPI' : null;
  if (paymentMethod) L.push('', '*Paiement à vérifier : ' + paymentMethod + '*', 'Je joins mon justificatif à ce message.');
  L.push('');
  L.push(paymentMethod
    ? 'Merci de vérifier le paiement reçu, puis d’activer la formule choisie pour ce compte.'
    : 'Merci de m’indiquer les modalités de paiement pour cette formule.');
  L.push('', 'Barakallahou fikoum.');
  return L.join('\n');
}

// Site : nouvel onglet. Application Android : la WebView n'ouvre pas de
// nouvelle fenêtre — le lien est confié à Android (lib/externalWindow.js).
function openWhatsApp(href) {
  if (!isNativeApp()) { window.open(href, '_blank', 'noopener'); return; }
  openExternalInApp(href).catch(() => { window.location.href = href; });
}

export function openAccess(opts = {}) {
  if (!opts.email) opts.email = currentEmail();
  openWhatsApp(link(accessMessage(opts)));
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
  openWhatsApp(link(formationBookingMessage(opts)));
}
