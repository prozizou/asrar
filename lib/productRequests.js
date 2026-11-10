// lib/productRequests.js — « Demander un produit » dans une boutique du
// Marché : logique PURE (aucun accès réseau/RTDB), partagée par
// pages/api/product-requests.js et testée sans mock.
//
// Une demande vit dans product_requests/{vendorId}/{id} (écriture réservée
// au serveur). Seul le PROPRIÉTAIRE de la boutique voit toutes les demandes,
// y répond et peut les supprimer ; l'auteur ne voit que les siennes (et la
// réponse éventuelle), et peut retirer sa propre demande.
import { emailVendorKey } from './market';

export const REQUEST_TEXT_MAX = 500;
export const REPLY_TEXT_MAX = 500;
// Demandes en attente qu'un même utilisateur peut laisser dans UNE boutique :
// borne le spam sans bloquer un client sérieux.
export const MAX_OPEN_PER_USER = 5;

// Nettoie un texte libre : espaces superflus retirés, caractères de contrôle
// supprimés (retours à la ligne conservés), longueur bornée.
export function cleanRequestText(value, max = REQUEST_TEXT_MAX) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
    .trim();
}

// Vrai si l'utilisateur est le propriétaire de la boutique `vendorId` —
// même règle que la reconnaissance de « sa » boutique côté Marché
// (app/page.tsx isOwnVendor) : clé dérivée de l'e-mail vérifié, ou uid pour
// les anciennes boutiques sans e-mail.
export function isShopOwner(user, vendorId) {
  if (!user || !vendorId) return false;
  if (user.email && vendorId === emailVendorKey(user.email)) return true;
  return !!user.uid && vendorId === user.uid;
}

// Vue renvoyée au client. Le propriétaire voit l'auteur (nom + e-mail, pour
// pouvoir le recontacter) ; l'auteur, lui, ne reçoit que sa demande.
export function publicRequest(id, value, forOwner) {
  const v = value || {};
  const out = {
    id,
    text: typeof v.text === 'string' ? v.text : '',
    at: Number(v.at) || 0,
    reply: v.reply && typeof v.reply.text === 'string' ? { text: v.reply.text, at: Number(v.reply.at) || 0 } : null,
  };
  if (forOwner) {
    out.name = typeof v.name === 'string' ? v.name : '';
    out.email = typeof v.email === 'string' ? v.email : '';
  }
  return out;
}

// Plus récentes d'abord.
export function sortRequests(items) {
  return items.slice().sort((a, b) => (b.at || 0) - (a.at || 0));
}
