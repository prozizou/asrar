'use client';
// Likes & commentaires temps réel d'un produit — port de loadProductSocial()
// /toggleProductLike()/postProductComment() de marche.js. Réutilise les nœuds
// partagés ratings/product/{key} (like = présence de l'uid, valeur 5) et
// comments/product/{key} (pseudo « @Client_XXXX »).
import { useCallback, useEffect, useState } from 'react';
import { ref, onValue, get, set, remove, push, serverTimestamp } from 'firebase/database';
import { db, auth } from '@/lib/firebase';

export function useProductSocial(productKey) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState([]);

  useEffect(() => {
    if (!productKey) return undefined;
    const uid = auth.currentUser?.uid;

    const likesRef = ref(db, `ratings/product/${productKey}`);
    const unsubLikes = onValue(likesRef, (snap) => {
      const likes = snap.val() || {};
      setLikeCount(Object.keys(likes).length);
      setLiked(!!(uid && likes[uid]));
    });

    const commentsRef = ref(db, `comments/product/${productKey}`);
    const unsubComments = onValue(commentsRef, (snap) => {
      const out = [];
      snap.forEach((child) => {
        const c = child.val() || {};
        out.push({ id: child.key, pseudo: c.pseudo || '@Client', text: c.text || '' });
      });
      setComments(out);
    });

    return () => {
      unsubLikes();
      unsubComments();
    };
  }, [productKey]);

  const toggleLike = useCallback(() => {
    const uid = auth.currentUser?.uid;
    if (!productKey || !uid) return;
    const r = ref(db, `ratings/product/${productKey}/${uid}`);
    get(r).then((snap) => {
      if (snap.exists()) remove(r);
      else set(r, 5); // valeur 5 : compatible règle de notation 1–5
    });
  }, [productKey]);

  const postComment = useCallback(
    (text) => {
      const t = (text || '').trim();
      const uid = auth.currentUser?.uid;
      if (!productKey || !t || !uid) return;
      const pseudo = '@Client_' + uid.substring(0, 4).toUpperCase();
      push(ref(db, `comments/product/${productKey}`), {
        uid,
        pseudo,
        text: t,
        timestamp: serverTimestamp(),
      });
    },
    [productKey]
  );

  return { liked, likeCount, comments, toggleLike, postComment };
}
