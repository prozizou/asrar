'use client';
// components/AttachMenu.js — Bouton « + » unique regroupant les pièces
// jointes (photo / caméra) de la discussion d'un zikr collectif
// (app/zikr/page.tsx) — remplace les gros cercles séparés d'avant (revue
// design : « les deux cercles entre 😊 et le champ sont presque
// invisibles »). Le micro reste un bouton à part (voir page.tsx) : un vocal
// est une action assez fréquente pour mériter son propre raccourci, pas
// caché dans un menu.
import { useEffect, useRef, useState } from 'react';
import { Plus, Image as ImageIcon, Camera } from 'lucide-react';

export default function AttachMenu({ onPickPhoto, onPickCamera, disabled }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div className="zk-attach-wrap" ref={rootRef}>
      <button
        type="button"
        className="zk-chat-tool zk-chat-plus"
        aria-label="Joindre un fichier"
        aria-haspopup="true"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
      </button>
      {open && (
        <div className="zk-emoji-pop zk-attach-pop" role="menu">
          <button type="button" className="zk-attach-item" role="menuitem"
            onClick={() => { setOpen(false); onPickPhoto(); }}>
            <ImageIcon size={16} strokeWidth={2.5} aria-hidden="true" /> Photo
          </button>
          <button type="button" className="zk-attach-item" role="menuitem"
            onClick={() => { setOpen(false); onPickCamera(); }}>
            <Camera size={16} strokeWidth={2.5} aria-hidden="true" /> Caméra
          </button>
        </div>
      )}
    </div>
  );
}
