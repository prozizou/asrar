'use client';
// useProgressiveList — rend une longue liste par lots au lieu d'un bloc.
//
// Pourquoi : les pages Firebase (Marché, Secrets, Bibliothèque, 99 Noms)
// rendaient TOUTES leurs cartes dans la même frame dès l'arrivée des données.
// Sur téléphone, monter des dizaines de cartes d'un coup (images, boutons,
// sous-composants, lectures localStorage) fige l'affichage — le chargement
// paraît saccadé alors que les données, elles, sont déjà là.
//
// Ici, on affiche un premier lot immédiatement, puis un lot de plus chaque
// fois que le bas de la liste approche (IntersectionObserver, avec 400 px
// d'avance pour que le lot suivant soit prêt avant d'être atteint). Le rendu
// initial reste léger et le reste arrive au fil du défilement.
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_BATCH, nextCount } from '@/lib/progressive';

/**
 * @param {Array} items liste complète (référence stable : useMemo/état — une
 *   nouvelle référence à chaque rendu relancerait le comptage à zéro).
 * @param {number} [batch] taille d'un lot
 * @returns {{visible:Array, sentinelRef:object, hasMore:boolean}}
 *   `sentinelRef` est à poser sur un élément placé APRÈS la liste : c'est son
 *   approche qui déclenche le lot suivant.
 */
export function useProgressiveList(items, batch = DEFAULT_BATCH) {
  const list = Array.isArray(items) ? items : [];
  const total = list.length;
  const [count, setCount] = useState(batch);
  const sentinelRef = useRef(null);

  // Repart du premier lot quand la source change (recherche, catégorie,
  // tri…) : sans cela, une nouvelle liste hériterait du compteur de
  // l'ancienne et s'afficherait déjà « déroulée ».
  useEffect(() => {
    setCount(batch);
  }, [items, batch]);

  useEffect(() => {
    if (count >= total) return undefined;
    const el = sentinelRef.current;
    if (!el) return undefined;

    // Repli si IntersectionObserver manque (navigateur ancien) : on affiche
    // tout, plutôt que de laisser des éléments inatteignables.
    if (typeof IntersectionObserver === 'undefined') {
      setCount(total);
      return undefined;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setCount((c) => nextCount(c, batch, total));
        }
      },
      { rootMargin: '400px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [count, total, batch]);

  return { visible: count >= total ? list : list.slice(0, count), sentinelRef, hasMore: count < total };
}
