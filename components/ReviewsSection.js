'use client';
// components/ReviewsSection.js — Bloc "Avis" complet (moyenne + liste +
// formulaire), réutilisable partout où un avis a du sens (boutiques du
// Marché, formations) — un avis EST un commentaire qui porte `stars`
// (lib/reviews.js, lib/socialClient.js useSocial), pas un système séparé.
//
// `canReview` (déf. true) masque le formulaire : sert à empêcher un
// propriétaire (boutique, formation) de noter sa propre fiche — la lecture
// des avis existants reste toujours visible.
import { useState } from 'react';
import { useSocial } from '@/lib/socialClient';
import { StarRatingDisplay, StarRatingInput } from './StarRating';

export default function ReviewsSection({ cat, itemKey, canReview = true, title = 'Avis' }) {
  const { comments, avgRating, reviewCount, postComment } = useSocial(cat, itemKey);
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const reviews = comments.filter((c) => typeof c.stars === 'number');

  const submit = async () => {
    if (!stars || !text.trim() || busy) return;
    setBusy(true);
    try {
      await postComment(text.trim(), stars);
      setText('');
      setStars(0);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sr-section">
      <div className="sr-section-head">
        <h3>{title}</h3>
        <StarRatingDisplay value={avgRating} count={reviewCount} />
      </div>

      {canReview && (
        <div className="sr-form">
          <StarRatingInput value={stars} onChange={setStars} />
          <textarea
            maxLength={500}
            rows={2}
            placeholder="Partagez votre expérience…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="button" className="sr-submit" onClick={submit} disabled={busy || !stars || !text.trim()}>
            {busy ? 'Envoi…' : 'Publier mon avis'}
          </button>
        </div>
      )}

      {reviews.length > 0 && (
        <div className="sr-list">
          {reviews.slice().reverse().map((r) => (
            <div key={r.id} className="sr-item">
              <div className="sr-item-head">
                <StarRatingDisplay value={r.stars} compact />
                <span className="sr-item-email">{r.email}</span>
              </div>
              <p className="sr-item-text">{r.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
