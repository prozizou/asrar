'use client';
// Toast léger piloté par l'état — remplace la fonction toast() de boutique.js
// (création/retrait de nœud DOM à la main). Retourne notify() et l'élément à
// rendre.
import { useCallback, useRef, useState } from 'react';

export function useToast() {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const timer = useRef(null);

  const notify = useCallback((text) => {
    setMsg(text);
    setShow(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), 3200);
  }, []);

  const node = (
    <div className={'bq-toast' + (show ? ' show' : '')} role="status">
      {msg}
    </div>
  );

  return { notify, toast: node };
}
