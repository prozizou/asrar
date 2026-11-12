'use client';
// Toast léger piloté par l'état — remplace la fonction toast() de boutique.js
// (création/retrait de nœud DOM à la main). Retourne notify() et l'élément à
// rendre.
//
// notify(texte, type) — type : 'success' | 'error' | 'info' (défaut). L'icône
// (SVG) est choisie selon le type : plus de « ✅ » / « ❌ » dans les textes.
import { useCallback, useRef, useState } from 'react';
import { CircleCheck, CircleAlert, Info } from 'lucide-react';

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info };

export function useToast() {
  const [msg, setMsg] = useState('');
  const [kind, setKind] = useState('info');
  const [show, setShow] = useState(false);
  const timer = useRef(null);

  const notify = useCallback((text, type = 'info') => {
    setMsg(text);
    setKind(ICONS[type] ? type : 'info');
    setShow(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), 3200);
  }, []);

  const Icon = ICONS[kind];
  const node = (
    <div className={'toast toast-' + kind + (show ? ' show' : '')} role="status">
      {msg && <Icon size={18} strokeWidth={2.2} aria-hidden="true" className="toast-icon" />}
      {msg}
    </div>
  );

  return { notify, toast: node };
}
