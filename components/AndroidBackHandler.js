'use client';
// Bouton retour d'Android : MainActivity.java appelle window.__asrarBack()
// avant de toucher à l'historique de la WebView. La décision vient de
// lib/androidBack.js : fermer la fenêtre ou la fiche ouverte, sinon aller
// au menu depuis un module, au Marché depuis le menu — sans repasser par
// toutes les pages visitées. Retourne 'handled' (fait ici) ou 'exit'
// (Marché : l'application gère la sortie). Sans ce composant (ancienne
// version du site), MainActivity garde l'ancien retour par l'historique.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { decideBack } from '@/lib/androidBack';
import { hasOpenPanel } from './useHistoryClose';

export default function AndroidBackHandler() {
  const router = useRouter();
  useEffect(() => {
    window.__asrarBack = () => {
      const dialogs = document.querySelectorAll('dialog[open]');
      const decision = decideBack({ path: window.location.pathname, dialogOpen: dialogs.length > 0, panelOpen: hasOpenPanel() });
      switch (decision.action) {
        case 'close-dialog': {
          // Même effet qu'Échap : l'événement « cancel » déclenche onClose (components/Modal.js).
          const top = dialogs[dialogs.length - 1];
          top.dispatchEvent(new Event('cancel', { cancelable: true }));
          return 'handled';
        }
        case 'close-panel':
          window.history.back(); // dépile l'entrée de la fiche (useHistoryClose)
          return 'handled';
        case 'navigate':
          router.push(decision.to);
          return 'handled';
        default:
          return 'exit';
      }
    };
    return () => { delete window.__asrarBack; };
  }, [router]);
  return null;
}
