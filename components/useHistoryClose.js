'use client';
// Ferme un panneau ouvert en state React (sans changement d'URL — ex. le
// détail d'un secret, la fiche d'un vendeur) sur un retour arrière : pousse
// une entrée d'historique quand le panneau s'ouvre, écoute popstate pour le
// refermer. Permet au backpress Android (et au bouton précédent du
// navigateur) de fonctionner pour ces panneaux, comme pour une vraie page.
import { useCallback, useEffect, useRef } from 'react';

export function useHistoryClose(active, onClose) {
  const pushedRef = useRef(false);

  useEffect(() => {
    if (active && !pushedRef.current) {
      window.history.pushState({ panelOpen: true }, '');
      pushedRef.current = true;
    } else if (!active) {
      pushedRef.current = false;
    }
  }, [active]);

  useEffect(() => {
    const onPopState = () => {
      if (pushedRef.current) {
        pushedRef.current = false;
        onClose();
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [onClose]);

  // À utiliser par le bouton « Retour » visible (desktop) : dépile l'entrée
  // d'historique poussée à l'ouverture, pour rester cohérent avec le backpress.
  return useCallback(() => {
    if (pushedRef.current) {
      window.history.back();
    } else {
      onClose();
    }
  }, [onClose]);
}
