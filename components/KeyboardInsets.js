'use client';
// Clavier virtuel (IME) — complément web de la gestion native.
//
// APK : le plugin SystemBars de Capacitor 8 (enregistré d'office par le
// bridge) redimensionne déjà la WebView à l'ouverture du clavier et remet
// --safe-area-inset-bottom à 0 tant qu'il est visible. Navigateur/PWA :
// viewport `interactive-widget=resizes-content` (app/layout.js) donne le même
// comportement. Dans les deux cas, la page rétrécit au-dessus du clavier.
//
// Reste à gérer ici :
//   1. `html.kb-open` pendant la saisie — les barres fixées en bas (navigation
//      Zikr, bouton Menu du marché, barres d'actions des secrets) se masquent
//      au lieu de grignoter la petite zone restante (voir globals.css) ;
//   2. le champ actif est ramené dans la zone visible si le redimensionnement
//      l'a laissé sous le clavier (fiches/feuilles en position fixe surtout).
import { useEffect } from 'react';

const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'file', 'color', 'image', 'hidden']);
// Hauteur perdue au-delà de laquelle on considère le clavier ouvert (une barre
// d'adresse qui se replie ne dépasse pas ~100 px).
const KEYBOARD_MIN_PX = 150;

function isEditable(el) {
  if (!el) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && !NON_TEXT_INPUTS.has(el.type);
}

export default function KeyboardInsets() {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    // Hauteur de référence sans clavier, par largeur (portrait ≠ paysage).
    const baseline = new Map();
    let open = false;

    const viewportHeight = () => (vv ? vv.height : window.innerHeight);

    const update = () => {
      const w = window.innerWidth;
      const h = viewportHeight();
      const editing = isEditable(document.activeElement);
      if (!editing || !baseline.has(w)) baseline.set(w, Math.max(baseline.get(w) || 0, h));
      const next = editing && baseline.get(w) - h > KEYBOARD_MIN_PX;
      if (next !== open) {
        open = next;
        root.classList.toggle('kb-open', open);
      }
      if (open) {
        const el = document.activeElement;
        const r = el.getBoundingClientRect();
        const top = vv ? vv.offsetTop : 0;
        if (r.bottom > top + h || r.top < top) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    };

    // focusout : le focus peut passer d'un champ à l'autre — on relit l'état
    // une fois le nouveau focus posé.
    const onFocusOut = () => setTimeout(update, 50);
    const target = vv || window;
    target.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', onFocusOut);
    update();
    return () => {
      target.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', onFocusOut);
      root.classList.remove('kb-open');
    };
  }, []);

  return null;
}
