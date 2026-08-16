'use client';
// Petit spinner réutilisable pour les attentes ponctuelles (une ligne de
// texte, un bouton, une valeur en cours de calcul) — complète le gros
// `.loader` déjà utilisé pour les chargements de page entière (asrar,
// bibliothèque…). Même animation (@keyframes spin, css/globals.css),
// juste une taille adaptée au contexte inline.
export default function Spinner({ size = 14, label = 'Chargement', className = '', style }) {
  return (
    <span
      className={'mini-spinner ' + className}
      style={{ width: size, height: size, ...style }}
      role="status"
      aria-label={label}
    />
  );
}
