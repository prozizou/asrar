'use client';
// components/StarRating.js — Affichage (lecture) et saisie (formulaire d'avis)
// d'une note en étoiles (1-5). Partagé entre boutiques (Marché) et formations
// — voir lib/reviews.js pour la logique pure, components/ReviewsSection.js
// pour l'assemblage complet (liste + formulaire). Styles : app/globals.css,
// section « Avis » (préfixe .sr-).

export function StarRatingDisplay({ value, count = 0, size = '1rem', compact = false }) {
  const rounded = Math.round(Number(value) || 0);
  const stars = (
    <span className="sr-stars" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={'sr-star' + (i < rounded ? ' on' : '')}>★</span>
      ))}
    </span>
  );
  const label = `${(Number(value) || 0).toFixed(1)} sur 5${compact ? '' : `, ${count} avis`}`;
  if (compact) {
    return (
      <span className="sr-display sr-display-compact" style={{ fontSize: size }} aria-label={label}>
        {stars}
      </span>
    );
  }
  return (
    <span className="sr-display" style={{ fontSize: size }} aria-label={label}>
      {stars}
      {count > 0 ? (
        <span className="sr-count">{(Number(value) || 0).toFixed(1)} ({count} avis)</span>
      ) : (
        <span className="sr-count sr-count-empty">Aucun avis pour l’instant</span>
      )}
    </span>
  );
}

export function StarRatingInput({ value, onChange }) {
  return (
    <span className="sr-input" role="radiogroup" aria-label="Votre note">
      {Array.from({ length: 5 }, (_, i) => {
        const n = i + 1;
        return (
          <button
            key={n}
            type="button"
            className={'sr-star-btn' + (n <= value ? ' on' : '')}
            aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
            aria-pressed={n <= value}
            onClick={() => onChange(n)}
          >
            ★
          </button>
        );
      })}
    </span>
  );
}
