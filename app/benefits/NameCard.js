'use client';
// Carte d'un nom — port de hydrateCard(). Deux états : verrouillé (nom seul +
// « Abonnement requis ») ou complet (poids abjad, carrés magiques, sens,
// bienfait, actions et compteur de dhikr).
//
// Revue design (module Noms d'Allah) : la carte complète cumulait tête de
// nom + signification + bienfait + carrés magiques + compteur de dhikr en
// un seul bloc — « un seul nom occupe presque 2 écrans ». Restructurée en :
// tête compacte (nom + translit + sens en une ligne) → actions (Favori/
// Écouter/Détails, ce dernier ouvrant NameModal.js qui portait déjà
// signification + bienfait complets, sans les dupliquer ici) → Awfaq
// (inchangé, déjà repliable) → Dhikr, désormais TOUJOURS visible dans sa
// forme compacte (compteur + barre + un grand bouton « Appuyer pour
// égrainer », plutôt qu'une simple icône empreinte ambiguë) et qui ne
// développe le chapelet complet (TasbihChapelet, coûteux — voir Tasbih.js)
// qu'au premier tap, pas avant.
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
  // Formule d'imploration (« يا رحمن ») — DISTINCTE du Nom lui-même
  // (item.name, « الرَّحْمَٰنُ ») : avant, la carte affichait la formule comme
  // titre principal, brouillant la relation entre le Nom et la formule à
  // réciter (revue design, point 6). Le Nom redevient le titre ; la formule
  // n'apparaît plus que dans le bloc Dhikr, où elle a un sens (voir plus bas).
  const dhikrFormula = implore(item.name);

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
        <div className="arabic-name">{highlight(item.name, searchTerm)}</div>
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

  // Premier tap sur la zone de comptage compacte : ouvre le chapelet complet
  // ET compte ce même tap (pas de « premier tap perdu » à seulement
  // développer la zone) — voir TasbihChapelet.js pour le compteur/la barre,
  // montés indépendamment du chapelet visuel (coûteux, ~100 nœuds DOM +
  // échantillonnage SVG : voir Tasbih.js, jamais monté pour les 99 cartes
  // à la fois).
  const openAndCount = (e) => {
    e.stopPropagation();
    if (!tasbihOpen) setTasbihOpen(true);
    t.tap();
  };

  // — Abonné : carte complète —
  return (
    <div className={'glass-card' + (t.flash ? ' goal-reached' : '')} onClick={() => onOpenModal(item)}>
      {numLabel && <div style={{ marginBottom: '0.4rem' }}>{numLabel}</div>}
      <div className="arabic-name">{highlight(item.name, searchTerm)}</div>
      <div className="translit-name">{highlight(item.translit, searchTerm)}</div>
      {item.meaning && <div className="meaning-line">{highlight(item.meaning, searchTerm)}</div>}

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

      {/* Actions groupées, libellées (revue design : « ⭐🔊 empreinte 🎯🔄
          sans libellés clairs ») — Détails ouvre NameModal.js, qui porte déjà
          la signification et le bienfait complets : pas dupliqués ici, la
          carte reste à une ligne de sens. */}
      <div className="card-footer">
        <button
          className={'card-action-btn favorite-btn' + (isFav ? ' active' : '')}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFav(item.id);
          }}
        >
          <i className={(isFav ? 'fas' : 'far') + ' fa-star'} /> <span>Favori</span>
        </button>
        <button
          className="card-action-btn audio-btn"
          onClick={(e) => {
            e.stopPropagation();
            playAudio(item);
          }}
        >
          <i className="fas fa-volume-low" /> <span>Écouter</span>
        </button>
        <button
          className="card-action-btn details-btn"
          onClick={(e) => {
            e.stopPropagation();
            onOpenModal(item);
          }}
        >
          <i className="fas fa-circle-info" /> <span>Détails</span>
        </button>
      </div>

      {/* Dhikr — toujours visible (plus une icône empreinte à déchiffrer),
          compteur = progression cumulée (voir TasbihChapelet.js). Repliée
          par défaut : juste la formule, le compteur et un grand bouton de
          comptage ; le chapelet visuel se développe au premier tap. */}
      <div className="dhikr-section" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="dhikr-header" onClick={() => setTasbihOpen((v) => !v)} aria-expanded={tasbihOpen}>
          <span>Dhikr</span>
          <i className={'fas fa-chevron-' + (tasbihOpen ? 'up' : 'down')} />
        </button>

        {tasbihOpen ? (
          <Tasbih id={item.id} t={t} open={tasbihOpen} />
        ) : (
          <div className="dhikr-compact">
            <div className="dhikr-formula" title="Formule du dhikr">
              {dhikrFormula}
            </div>
            <div className="dhikr-counter-row">
              <strong>{t.total}</strong>
              <span>sur {t.numericTarget || '—'}</span>
            </div>
            <div className="tc-bar">
              <span style={{ width: t.pct + '%' }} />
            </div>
            <button type="button" className="dhikr-tap-cta" onClick={openAndCount}>
              👆 Appuyer pour égrainer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
