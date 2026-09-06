'use client';
// components/EmojiPicker.js — Petit sélecteur d'emoji pour un champ de saisie
// (app/zikr/page.tsx, discussion de groupe) — demandé explicitement. Une
// palette RESTREINTE et fixe plutôt qu'un picker complet (des centaines
// d'emoji, catégories, recherche) : le clavier mobile a de toute façon déjà
// son propre picker complet (⌨️→😊) — celui-ci n'est qu'un raccourci pour les
// plus courants dans une discussion de dhikr, pas un remplacement.
import { useEffect, useRef, useState } from 'react';

const EMOJIS = [
  '🤲', '🙏', '❤️', '😊', '😢', '👍', '🌙', '✨', '🕌', '📿', '🔥', '💚',
  '😔', '🥹', '👏', '🤍',
];

export default function EmojiPicker({ onPick }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  // Ferme au clic extérieur — comme n'importe quel menu déroulant de l'app.
  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div className="zk-emoji-wrap" ref={rootRef}>
      <button
        type="button"
        className="zk-chat-tool"
        aria-label="Insérer un emoji"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        😊
      </button>
      {open && (
        <div className="zk-emoji-pop" role="menu">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              className="zk-emoji-btn"
              role="menuitem"
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
