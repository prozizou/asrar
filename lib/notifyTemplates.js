// lib/notifyTemplates.js — Textes des notifications : logique PURE (aucun
// accès réseau/RTDB), partagée par server/notify.js (construction du
// titre/corps au moment de l'envoi) et testée ici sans mock. Un type =
// une fonction ; le titre reprend le format demandé (« Nouveau Secret reçu
// de X », « X vous a envoyé un document », « Nouveau message de X ») et sert
// À LA FOIS de titre de notification push ET de ligne affichée dans le
// centre de notifications — le corps (`body`) porte l'aperçu.

export const NOTIF_TYPES = {
  SECRET: 'secret',
  DOCUMENT: 'document',
  ZIKR_MESSAGE: 'zikr_message',
  ZIKR_COLLECTIF: 'zikr_collectif',
  PRODUCT: 'product',
  SHOP: 'shop',
  ACCESS: 'access',
};

// Coupe proprement sur un mot entier (jamais en plein milieu), avec « … » —
// aperçu court demandé (« lorsque cela est pertinent »), jamais le contenu
// complet (un Secret reste payant, son aperçu ne doit pas le dévoiler en
// entier dans une notification).
export function truncate(text, maxLen) {
  const s = String(text || '').trim();
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut).trim() + '…';
}

const FALLBACK_NAME = 'ASRAR PRO';

/** @type {(arg?: {senderName?: string, preview?: string}) => {type: string, title: string, body: string}} */
export function secretNotification({ senderName, preview } = {}) {
  const name = senderName || FALLBACK_NAME;
  return {
    type: NOTIF_TYPES.SECRET,
    title: `Nouveau Secret reçu de ${name}`,
    body: preview ? truncate(preview, 120) : 'Un nouveau Secret est disponible.',
  };
}

/** @type {(arg?: {senderName?: string, preview?: string}) => {type: string, title: string, body: string}} */
export function documentNotification({ senderName, preview } = {}) {
  const name = senderName || FALLBACK_NAME;
  return {
    type: NOTIF_TYPES.DOCUMENT,
    title: `${name} vous a envoyé un document`,
    body: preview ? truncate(preview, 120) : 'Un nouveau document est disponible.',
  };
}

/** @type {(arg?: {senderName?: string, preview?: string, hasMedia?: boolean}) => {type: string, title: string, body: string}} */
export function zikrMessageNotification({ senderName, preview, hasMedia } = {}) {
  const name = senderName || 'Un membre';
  return {
    type: NOTIF_TYPES.ZIKR_MESSAGE,
    title: `Nouveau message de ${name}`,
    body: preview ? truncate(preview, 120) : (hasMedia ? 'a envoyé une pièce jointe.' : 'a envoyé un message.'),
  };
}

// Diffusée à TOUS les utilisateurs (même non-participants) à la validation
// admin d'un nouveau Zikr collectif — jamais à sa simple création, voir
// pages/api/zikr.js handleApproveZikr.
/** @type {(arg?: {groupName?: string}) => {type: string, title: string, body: string}} */
export function zikrCollectifNotification({ groupName } = {}) {
  return {
    type: NOTIF_TYPES.ZIKR_COLLECTIF,
    title: 'Nouveau Zikr collectif',
    body: groupName ? `« ${truncate(groupName, 100)} » — rejoignez la récitation collective.` : 'Un nouveau Zikr collectif est ouvert à tous.',
  };
}

/** @type {(arg?: {vendorName?: string, productName?: string}) => {type: string, title: string, body: string}} */
export function newProductNotification({ vendorName, productName } = {}) {
  const vendor = vendorName || FALLBACK_NAME;
  return {
    type: NOTIF_TYPES.PRODUCT,
    title: 'Nouveau produit au Marché',
    body: productName ? `${vendor} — ${truncate(productName, 100)}` : `${vendor} a ajouté un nouveau produit.`,
  };
}

/** @type {(arg?: {shopName?: string}) => {type: string, title: string, body: string}} */
export function newShopNotification({ shopName } = {}) {
  const name = shopName || 'Une nouvelle boutique';
  return {
    type: NOTIF_TYPES.SHOP,
    title: 'Nouvelle boutique au Marché',
    body: `${name} est maintenant disponible.`,
  };
}

// CIBLÉE (un seul destinataire), pas de broadcast — voir pages/api/admin.js
// grant-access.
/** @type {() => {type: string, title: string, body: string}} */
export function accessGrantedNotification() {
  return {
    type: NOTIF_TYPES.ACCESS,
    title: '🔓 Accès ASRAR PRO activé',
    body: 'Votre accès premium vient d\'être activé — bienvenue !',
  };
}
