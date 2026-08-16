'use client';
// Likes & commentaires en TEMPS RÉEL pour un secret — port de la partie
// loadRatingAndComments()/toggleSecretLike()/postComment() d'asrar.js.
// Version React : les écouteurs sont attachés/détachés proprement par useEffect
// (fini le nettoyage manuel des références commentsRef/likesRef).
import { useEffect, useState, useCallback } from 'react';
import { ref, onValue, push, set, remove, serverTimestamp } from 'firebase/database';
import { db, auth } from '@/lib/firebase';

export function useSecretRealtime(catId, key) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState([]);

  useEffect(() => {
    if (!catId || !key) return undefined;
    const uid = auth.currentUser?.uid;
    if (!uid) return undefined;

    // — Likes : présence de l'uid sous ratings/{cat}/{key} = 1 like —
    const likesRef = ref(db, `ratings/${catId}/${key}`);
    const unsubLikes = onValue(likesRef, (snap) => {
      const likes = snap.val() || {};
      setLiked(!!likes[uid]);
      setLikeCount(Object.keys(likes).length);
    });

    // — Commentaires : liste complète (ordre chronologique des push) —
    // Affiche l'email + la photo de profil de l'auteur (plus de pseudo
    // anonyme) ; repli sur l'ancien pseudo pour les commentaires déjà postés
    // avant ce changement (ils n'ont pas de champ email/photo).
    const commentsRef = ref(db, `comments/${catId}/${key}`);
    const unsubComments = onValue(commentsRef, (snap) => {
      const out = [];
      snap.forEach((child) => {
        const c = child.val() || {};
        out.push({ id: child.key, email: c.email || c.pseudo || 'Utilisateur', photo: c.photo || '', text: c.text });
      });
      setComments(out);
    });

    return () => {
      unsubLikes();
      unsubComments();
    };
  }, [catId, key]);

  const toggleLike = useCallback(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !catId || !key) return;
    const r = ref(db, `ratings/${catId}/${key}/${uid}`);
    if (liked) remove(r);
    else set(r, 1);
  }, [liked, catId, key]);

  const postComment = useCallback(
    (text) => {
      const t = (text || '').trim();
      const user = auth.currentUser;
      if (!t || !user || !catId || !key) return;
      push(ref(db, `comments/${catId}/${key}`), {
        uid: user.uid,
        email: user.email || '',
        photo: user.photoURL || '',
        text: t,
        timestamp: serverTimestamp(),
      });
    },
    [catId, key]
  );

  return { liked, likeCount, comments, toggleLike, postComment };
}
