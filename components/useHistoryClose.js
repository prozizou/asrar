'use client';
// Ferme un panneau ouvert en state React (sans changement d'URL — ex. le
// détail d'un secret, la fiche d'un vendeur, la fiche produit) sur un retour
// arrière : pousse une entrée d'historique quand le panneau s'ouvre, et le
// referme sur popstate. Permet au backpress Android (MainActivity.java : retour
// = historique de la WebView) et au bouton précédent du navigateur de
// fonctionner pour ces panneaux, comme pour une vraie page.
//
// Panneaux superposés (fiche produit au-dessus d'une boutique) : une PILE
// partagée et un seul écouteur popstate — un retour ne ferme que le panneau
// du dessus (avec un écouteur par panneau, un retour les fermait tous).
import { useCallback, useEffect, useRef } from 'react';

const stack = []; // { close: () => void } du plus ancien au plus récent
let listening = false;

function ensureListener() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('popstate', () => {
    const top = stack.pop();
    if (top) top.close();
  });
}

export function useHistoryClose(active, onClose) {
  const entryRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    ensureListener();
    if (active && !entryRef.current) {
      const entry = { close: () => { entryRef.current = null; onCloseRef.current(); } };
      entryRef.current = entry;
      stack.push(entry);
      window.history.pushState({ panelOpen: true }, '');
    } else if (!active && entryRef.current) {
      // Fermé autrement que par le retour : son entrée d'historique reste
      // (un retour de plus) — préférer la fonction renvoyée pour fermer.
      const i = stack.indexOf(entryRef.current);
      if (i !== -1) stack.splice(i, 1);
      entryRef.current = null;
    }
  }, [active]);

  // Démontage pendant qu'il est ouvert (changement de page) : on le retire de
  // la pile sans toucher à l'historique (la navigation a déjà eu lieu).
  useEffect(() => () => {
    const i = stack.indexOf(entryRef.current);
    if (i !== -1) stack.splice(i, 1);
    entryRef.current = null;
  }, []);

  // À utiliser par les boutons visibles « Retour » / « Fermer » : dépile
  // l'entrée d'historique poussée à l'ouverture (cohérent avec le backpress).
  return useCallback(() => {
    if (entryRef.current && stack[stack.length - 1] === entryRef.current) {
      window.history.back();
    } else {
      onCloseRef.current();
    }
  }, []);
}
