'use client';
// Carte d'un nom — port de hydrateCard(). Deux états : verrouillé (nom seul +
// « Abonnement requis ») ou complet (poids abjad, carrés magiques, sens,
// bienfait, actions et compteur de dhikr).
import { useState } from 'react';
import { calculatePoidsMystique } from '@/lib/abjad';
import { implore } from '@/lib/benefits';
import { playAudio } from '@/lib/audio';
import { useTasbih } from '@/components/useTasbih';
import WafqSquares from './WafqSquares';
import Tasbih from './Tasbih';

// Surligne les occurrences du terme recherché (texte déjà sûr en JSX).
function highlight(text, term) {
  const s = String(text ?? '');
  if (!term) return s;
  const norm = (x) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const nt = norm(term);
  if (!nt) return s;
  const out = [];
  let i = 0;
  const ns = norm(s);
  let from = 0;
  while ((i = ns.indexOf(nt, from)) !== -1) {
    if (i > from) out.push(s.slice(from, i));
    out.push(
      <mark key={i} className="search-highlight">
        {s.slice(i, i + term.length)}
      </mark>
    );
    from = i + term.length;
  }
  if (from < s.length) out.push(s.slice(from));
  return out.length ? out : s;
}

export default function NameCard({ item, accessGranted, isFav, searchTerm, onToggleFav, onOpenModal, onOpenGate }) {
  const [tasbihOpen, setTasbihOpen] = useState(false);
  const poids = calculatePoidsMystique(item.name);
  const autoTarget = poids > 0 ? poids * 7 : '';
  const t = useTasbih(item.id, autoTarget);

  const numLabel =
    item.number && item.number < 999 ? (
      <span className="stat-pill" style={{ fontSize: '0.72rem' }}>
        <i className="fas fa-hashtag" />
        <span>{item.number}</span>
      </span>
    ) : null;

  // — Sans abonnement : nom seul + verrou —
  if (!accessGranted) {
    return (
      <div className="glass-card is-locked" onClick={onOpenGate}>
        {numLabel && <div style={{ marginBottom: '0.4rem' }}>{numLabel}</div>}
        <div className="arabic-name">{highlight(implore(item.name), searchTerm)}</div>
        <div className="translit-name">{highlight(item.translit, searchTerm)}</div>
        <div
          className="locked-hint"
          style={{ marginTop: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.82rem', opacity: 0.75 }}
        >
          <i className="fas fa-lock" /> Abonnement requis
        </div>
      </div>
    );
  }

  // — Abonné : carte complète —
  return (
    <div className={'glass-card' + (t.flash ? ' goal-reached' : '')} onClick={() => onOpenModal(item)}>
      {numLabel && <div style={{ marginBottom: '0.4rem' }}>{numLabel}</div>}
      <div className="arabic-name">{highlight(implore(item.name), searchTerm)}</div>
      <div className="translit-name">{highlight(item.translit, searchTerm)}</div>

      {poids > 0 && (
        <div className="poids-badge" title="Poids abjad × 7 = objectif recommandé">
          <i className="fas fa-scale-balanced" />
          Poids <strong>{poids}</strong>
          <span style={{ opacity: 0.5, margin: '0 2px' }}>·</span>
          Obj. <strong>{t.numericTarget || '—'}</strong>
        </div>
      )}

      <div onClick={(e) => e.stopPropagation()}>
        <WafqSquares meaning={item.meaning} benefit={item.benefit} numericTarget={t.numericTarget} />
      </div>

      <div className="meaning">
        <i className="fas fa-gem" />
        <span>{highlight(item.meaning, searchTerm)}</span>
      </div>
      {item.benefit && (
        <div className="benefit">
          <i className="fas fa-leaf" />
          <span>{highlight(item.benefit, searchTerm)}</span>
        </div>
      )}

      <div className="card-footer">
        <button
          className={'card-action-btn favorite-btn' + (isFav ? ' active' : '')}
          aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFav(item.id);
          }}
        >
          <i className={(isFav ? 'fas' : 'far') + ' fa-star'} />
        </button>
        <button
          className="card-action-btn audio-btn"
          aria-label="Écouter la prononciation"
          onClick={(e) => {
            e.stopPropagation();
            playAudio(item);
          }}
        >
          <i className="fas fa-volume-low" />
        </button>
        <button
          className="card-action-btn tasbih-btn"
          aria-label="Ouvrir le compteur de dhikr"
          onClick={(e) => {
            e.stopPropagation();
            setTasbihOpen((v) => !v);
          }}
        >
          <i className="fas fa-fingerprint" />
          <span className="tasbih-counter">{t.count}</span>
        </button>
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        <Tasbih id={item.id} t={t} open={tasbihOpen} />
      </div>
    </div>
  );
}
