'use client';
// Likes & commentaires d'un secret — voir lib/socialClient.js pour
// l'implémentation partagée avec useProductSocial.js (mêmes nœuds RTDB
// ratings/comments) et l'historique du passage à /api/social (HTTPS) au lieu
// du SDK client RTDB.
import { useSocial } from '@/lib/socialClient';

export function useSecretRealtime(catId, key) {
  return useSocial(catId, key);
}
