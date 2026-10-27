'use client';

// Réserver pendant le geste utilisateur, puis charger le lien après l'appel
// API. Le retour de window.open(..., 'noopener') ne permet pas de détecter
// un blocage ; on détache l'opener de la fenêtre vide immédiatement.
export function reserveExternalWindow() {
  const popup = window.open('about:blank', '_blank');
  if (!popup) return null;
  popup.opener = null;
  return {
    navigate(value) {
      const url = new URL(value, window.location.origin);
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Lien externe invalide.');
      if (popup.closed) throw new Error('La fenêtre a été fermée. Réessayez.');
      popup.location.replace(url.href);
    },
    close() { popup.close(); },
  };
}
