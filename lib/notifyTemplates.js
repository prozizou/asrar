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
  PRODUCT_REQUEST: 'product_request',
  SOCIAL: 'social',
  PLANET_ALARM: 'planet_alarm',
  DATE_DU_JOUR: 'date_du_jour',
  VISIO: 'visio',
  ASRAR_CHAT: 'asrar_chat',
  ASRAR_CHAT_ORDER: 'asrar_chat_order',
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

// Visioconférence Google Meet validée par l'administration
// (pages/api/visio.js handleApprove) — diffusée à tous les utilisateurs.
/** @type {(arg?: {title?: string, when?: string}) => {type: string, title: string, body: string}} */
export function visioNotification({ title, when } = {}) {
  const what = title ? `« ${truncate(title, 90)} »` : 'Une visioconférence';
  return {
    type: NOTIF_TYPES.VISIO,
    title: 'Nouvelle visioconférence',
    body: when ? `${what} — ${when}, sur Google Meet.` : `${what} est programmée sur Google Meet.`,
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
    title: 'Accès ASRAR PRO activé',
    body: 'Votre accès premium vient d\'être activé — bienvenue !',
  };
}

// CIBLÉE : prévient le seul propriétaire de la boutique qu'un client demande
// un produit (pages/api/product-requests.js action "create").
/** @type {(arg?: {requesterName?: string, preview?: string}) => {type: string, title: string, body: string}} */
export function productRequestNotification({ requesterName, preview } = {}) {
  const name = requesterName || 'Un client';
  return {
    type: NOTIF_TYPES.PRODUCT_REQUEST,
    title: `Nouvelle demande de produit de ${name}`,
    body: preview ? truncate(preview, 120) : 'Un client recherche un produit dans votre boutique.',
  };
}

// CIBLÉE : prévient l'auteur d'une demande que la boutique lui a répondu.
/** @type {(arg?: {shopName?: string, preview?: string}) => {type: string, title: string, body: string}} */
export function productRequestReplyNotification({ shopName, preview } = {}) {
  const name = shopName || 'La boutique';
  return {
    type: NOTIF_TYPES.PRODUCT_REQUEST,
    title: `${name} a répondu à votre demande`,
    body: preview ? truncate(preview, 120) : 'Consultez la réponse dans la boutique.',
  };
}

// CIBLÉE : un utilisateur aime un élément (produit, boutique, livre) — vers
// son propriétaire (boutique) ou l'administration (Bibliothèque).
/** @type {(arg?: {who?: string, itemLabel?: string}) => {type: string, title: string, body: string}} */
export function likeNotification({ who, itemLabel } = {}) {
  const name = who || 'Un utilisateur';
  const item = itemLabel ? truncate(itemLabel, 80) : 'votre publication';
  return {
    type: NOTIF_TYPES.SOCIAL,
    title: `${name} aime ${item}`,
    body: 'Nouveau « J’aime ».',
  };
}

// CIBLÉE : nouveau commentaire (ou avis étoilé) sur un élément.
/** @type {(arg?: {who?: string, itemLabel?: string, preview?: string, stars?: number|null}) => {type: string, title: string, body: string}} */
export function commentNotification({ who, itemLabel, preview, stars } = {}) {
  const name = who || 'Un utilisateur';
  const item = itemLabel ? truncate(itemLabel, 80) : 'votre publication';
  const rating = Number.isInteger(stars) && stars >= 1 && stars <= 5 ? `Note : ${stars}/5 — ` : '';
  return {
    type: NOTIF_TYPES.SOCIAL,
    title: rating ? `${name} a laissé un avis sur ${item}` : `${name} a commenté ${item}`,
    body: rating + (preview ? truncate(preview, 120) : ''),
  };
}

// CIBLÉE : alarme d'heure planétaire cochée (cloche de /planete).
/** @type {(arg?: {planet?: string, offsetMin?: number, interval?: string}) => {type: string, title: string, body: string}} */
export function planetAlarmNotification({ planet, offsetMin, interval } = {}) {
  const name = planet || 'votre planète';
  return {
    type: NOTIF_TYPES.PLANET_ALARM,
    title: offsetMin > 0 ? `Heure de ${name} dans ${offsetMin} min` : `C’est l’heure de ${name}`,
    body: interval ? `Heure planétaire de ${name} : ${interval}.` : `L’heure planétaire de ${name} commence.`,
  };
}

// DIFFUSÉE À TOUS : le 1er ou le 16 du mois (grégorien et/ou hégirien).
/** @type {(arg?: {gregorian?: string, hijri?: string, gDay?: number, hDay?: number}) => {type: string, title: string, body: string}} */
export function monthDayNotification({ gregorian, hijri, gDay, hDay } = {}) {
  const marks = [];
  if (hDay === 1) marks.push('début du mois hégirien');
  if (hDay === 16) marks.push('16 du mois hégirien');
  if (gDay === 1) marks.push('début du mois');
  if (gDay === 16) marks.push('16 du mois');
  return {
    type: NOTIF_TYPES.DATE_DU_JOUR,
    title: 'Date du jour' + (marks.length ? ' — ' + marks.join(', ') : ''),
    body: [gregorian, hijri].filter(Boolean).join(' · '),
  };
}
