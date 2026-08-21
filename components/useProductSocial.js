'use client';
// Likes & commentaires d'un produit (Marché) — voir lib/socialClient.js pour
// l'implémentation partagée avec useSecretRealtime.js (même nœuds RTDB
// ratings/comments, "product" comme catégorie) et l'historique du passage à
// /api/social (HTTPS) au lieu du SDK client RTDB.
import { useSocial } from '@/lib/socialClient';

export function useProductSocial(productKey) {
  return useSocial('product', productKey);
}
