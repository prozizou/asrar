'use client';
// components/MoreMenu.js — Bouton « ⋮ » générique regroupant des actions
// secondaires (app/zikr/page.tsx : Modifier / Administration / Supprimer) —
// demandé explicitement (revue design : « Liste des zikr + Modifier +
// Discussion + Partager » sur une seule ligne, trop chargée). Même structure
// que components/AttachMenu.js (popover + fermeture au clic extérieur),
// mais un contenu libre (children) plutôt que deux actions fixes.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';

export default function MoreMenu({ children, label }) {
  const [open, setOpen] = useState(false);
  // Ouverture vers le haut quand le menu dépasserait le bas de l'écran (dernière
  // ligne d'une liste, barre de navigation fixe du Zikr par-dessus).
  const [up, setUp] = useState(false);
  const rootRef = useRef(null);
  const popRef = useRef(null);

  useLayoutEffect(() => {
    if (!open) { setUp(false); return; }
    const pop = popRef.current, root = rootRef.current;
    if (!pop || !root) return;
    const nav = document.querySelector('.zk-bottom-nav');
    const navTop = nav ? nav.getBoundingClientRect().top : window.innerHeight;
    const limit = Math.min(window.innerHeight, navTop) - 8;
    const below = pop.getBoundingClientRect().bottom;
    const spaceAbove = root.getBoundingClientRect().top;
    setUp(below > limit && spaceAbove > pop.offsetHeight + 8);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div className="zk-more-wrap" ref={rootRef}>
      <button
        type="button"
        className="zk-icon-btn"
        aria-label={label || 'Plus d’actions'}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical size={18} strokeWidth={2.5} aria-hidden="true" />
      </button>
      {/* Un clic sur N'IMPORTE QUEL item referme le menu (bubbling) — chaque
          item n'a donc pas besoin de gérer sa propre fermeture. */}
      {open && (
        <div ref={popRef} className={'zk-emoji-pop zk-more-pop' + (up ? ' up' : '')} role="menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}
