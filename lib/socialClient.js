'use client';
// useSocial(cat, key) — likes & commentaires (secrets ET produits Marché),
// via /api/social (HTTPS, Admin SDK) — PAS le SDK client Firebase Realtime
// Database. Remplace les anciens useProductSocial()/useSecretRealtime(), qui
// ouvraient chacun un onValue() (WebSocket RTDB direct depuis le navigateur) :
// sur certains réseaux, ce canal reste bloqué en silence — les likes/
// commentaires n'apparaissaient alors jamais, même quand le reste de la page
// (chemin HTTPS séparé) s'affichait normalement. Voir pages/api/social.js.
//
// Contrepartie assumée : ce n'est plus du "temps réel" pur — un like/
// commentaire d'un AUTRE visiteur n'apparaît qu'au prochain rafraîchissement
// (chargement + toutes les REFRESH_MS pendant que le composant reste monté),
// pas instantanément. Cohérent avec le reste de l'app (tout passe par
// HTTP à la demande), plutôt que de garder un canal RTDB direct fragile pour
// ce seul gain.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { auth } from './firebase';
import { apiPost } from './api';
import { avgStars } from './reviews';

const REFRESH_MS = 20000; // ravive les commentaires/likes d'autrui sans revenir au temps réel RTDB

export function useSocial(cat, key) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState([]);
  const mounted = useRef(true);

  // Un AVIS (boutique/formation) est un commentaire qui porte `stars` (1-5) —
  // voir lib/reviews.js. Dérivé de `comments`, jamais stocké séparément.
  const { avg: avgRating, count: reviewCount } = useMemo(() => avgStars(comments), [comments]);

  const load = useCallback(async () => {
    if (!cat || !key || !auth.currentUser) return;
    try {
      const data = await apiPost('social', { cat, key, action: 'get' });
      if (!mounted.current) return;
      setLiked(!!data.liked);
      setLikeCount(Number(data.likeCount) || 0);
      setComments(Array.isArray(data.comments) ? data.comments : []);
    } catch {
      // Silencieux : un rafraîchissement raté n'efface pas ce qui est déjà
      // affiché (contrairement au paywall, rien de bloquant ici).
    }
  }, [cat, key]);

  useEffect(() => {
    mounted.current = true;
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      mounted.current = false;
      clearInterval(t);
    };
  }, [load]);

  const toggleLike = useCallback(async () => {
    if (!cat || !key || !auth.currentUser) return;
    try {
      const data = await apiPost('social', { cat, key, action: 'toggle-like' });
      if (!mounted.current) return;
      setLiked(!!data.liked);
      setLikeCount(Number(data.likeCount) || 0);
    } catch {
      // best-effort — l'utilisateur peut retenter le clic
    }
  }, [cat, key]);

  // `stars` (1-5, optionnel) : fait de ce commentaire un AVIS — voir
  // lib/reviews.js. Omis (ou invalide) → commentaire ordinaire, comme avant.
  const postComment = useCallback(
    async (text, stars) => {
      const t = (text || '').trim();
      if (!cat || !key || !t || !auth.currentUser) return;
      try {
        const data = await apiPost('social', { cat, key, action: 'comment', text: t, stars });
        if (!mounted.current || !data.comment) return;
        setComments((prev) => [...prev, data.comment]);
      } catch {
        // best-effort — pas d'état d'erreur dédié (cf. historique de ce hook)
      }
    },
    [cat, key]
  );

  return { liked, likeCount, comments, avgRating, reviewCount, toggleLike, postComment };
}
