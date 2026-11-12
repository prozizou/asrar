// lib/androidBack.js — Que fait le bouton retour d'Android ? Logique PURE
// (testée dans lib/androidBack.test.js), appliquée par
// components/AndroidBackHandler.js et appelée par MainActivity.java.
//
// Règle demandée : le retour ne repasse plus par toutes les pages visitées.
//   1. une fenêtre (dialog) ouverte → la fermer ;
//   2. une fiche ouverte (panneau useHistoryClose : produit, boutique,
//      secret…) → la fermer ;
//   3. page d'un module, même une sous-page (/wafq/carre/7, /menu/outils…)
//      → directement au menu ;
//   4. menu → Marché (accueil) ;
//   5. Marché → laisser l'application gérer la sortie (double appui).

/**
 * @param {{ path: string, dialogOpen?: boolean, panelOpen?: boolean }} state
 * @returns {{ action: 'close-dialog' } | { action: 'close-panel' } | { action: 'navigate', to: string } | { action: 'exit' }}
 */
export function decideBack({ path, dialogOpen = false, panelOpen = false }) {
  if (dialogOpen) return { action: 'close-dialog' };
  if (panelOpen) return { action: 'close-panel' };
  const p = String(path || '/').replace(/\/+$/, '') || '/';
  if (p === '/') return { action: 'exit' };
  if (p === '/menu') return { action: 'navigate', to: '/' };
  return { action: 'navigate', to: '/menu' };
}
