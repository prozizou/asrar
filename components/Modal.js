'use client';
import { useEffect, useRef } from 'react';

let locks = 0, previousOverflow = '';

// Le dialogue natif assure l'inertie de l'arrière-plan et la navigation Tab,
// y compris pour les fenêtres imbriquées. Le focus revient au déclencheur.
export default function Modal({ children, className = '', label = undefined, labelledBy = undefined, onClose = undefined, open = true, role = 'dialog' }) {
  const ref = useRef(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    if (!open || !ref.current) return undefined;
    const node = ref.current, previous = document.activeElement;
    if (!locks++) { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    node.showModal();
    return () => {
      if (node.open) node.close();
      if (!--locks) document.body.style.overflow = previousOverflow;
      const remaining = document.querySelector('dialog[open]');
      if (previous instanceof HTMLElement && previous.isConnected && (!remaining || remaining.contains(previous))) previous.focus();
    };
  }, [open]);
  if (!open) return null;
  return <dialog ref={ref} className={'app-dialog ' + className} role={role} aria-label={label} aria-labelledby={labelledBy}
    tabIndex={-1}
    onKeyDown={(event) => {
      if (event.key === 'Escape') event.stopPropagation();
      if (event.key !== 'Tab') return;
      const node = event.currentTarget;
      const focusable = [...node.querySelectorAll('a[href],button,input,select,textarea,iframe,[tabindex]')]
        .filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
      const first = focusable[0], last = focusable.at(-1);
      if (!first) { event.preventDefault(); node.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === node)) { event.preventDefault(); first.focus(); }
    }}
    onCancel={(event) => { event.preventDefault(); close.current?.(); }}
    onClick={(event) => { if (event.target === event.currentTarget) close.current?.(); }}>
    {children}
  </dialog>;
}
