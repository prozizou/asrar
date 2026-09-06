'use client';
// Carte d'un nom — port de hydrateCard(). Deux états : verrouillé (nom seul +
// « Abonnement requis ») ou complet (poids abjad, carrés magiques, sens,
// bienfait, actions et compteur de dhikr).
//
// Revue design (module Noms d'Allah, v2) : la carte complète empilait
// beaucoup de cadres/badges/séparateurs dans UN SEUL bloc (numéro en gros
// badge, translittération en pilule à bordure, poids/objectif en pilule,
// Awfaq en bloc coloré, 3 boutons d'action en pilules, Dhikr en simple
// section repliable) — dense même une fois restructurée en v1 (voir
// historique ci-dessous). Reprise ici en deux temps :
//  1) une carte « identité + propriétés + actions + Awfaq », allégée (le
//     numéro devient un simple repère discret, l'arabe/la translit./le sens
//     forment un seul bloc d'identité, poids et objectif redeviennent du
//     texte plutôt qu'une pilule, les 3 actions sont compactes et sans
//     pilule propre, Awfaq n'est plus qu'une ligne cliquable) ;
//  2) une carte « Dhikr » séparée et dédiée (formule + compteur N/objectif +
//     % + barre + bouton « Égrainer »), pour que le compteur — l'action
//     principale du module — ait enfin sa propre zone au lieu d'être une
//     sous-section de plus dans la carte d'identité.
// Les deux cartes sont enveloppées dans .name-card-group pour rester UNE
// seule cellule de .cards-grid (display:grid) — sans ce conteneur, deux
// <div class="glass-card"> frères deviendraient deux cellules de grille
// distinctes.
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

// fmt() formate un compte qui peut légitimement valoir 0 (ex. le compteur de
// dhikr au départ) ; fmtOrDash() réserve le tiret cadratin aux valeurs
// absentes (ex. objectif non défini), pour ne jamais confondre « 0 » et
// « pas de valeur ».
const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');
const fmtOrDash = (n) => (n ? Number(n).toLocaleString('fr-FR') : '—');

export default function NameCard({ item, accessGranted, isFav, searchTerm, onToggleFav, onOpenModal, onOpenGate }) {
  const [tasbihOpen, setTasbihOpen] = useState(false);
  const poids = calculatePoidsMystique(item.name);
  const autoTarget = poids > 0 ? poids * 7 : '';
  const t = useTasbih(item.id, autoTarget);
  // Formule d'imploration (« يا رحمن ») — DISTINCTE du Nom lui-même
  // (item.name, « الرَّحْمَٰنُ ») : la carte affiche le Nom comme titre ; la
  // formule n'apparaît que dans la carte Dhikr, où elle a un sens.
  const dhikrFormula = implore(item.name);

  // Repère discret (revue design : « # 1 trop visible ») — simple texte, plus
  // de pilule/badge. N'affiche rien pour les entrées sans numéro exploitable
  // (999 = sentinelle « pas de numéro », voir lib/benefits.js normalizeName).
  const indexLabel =
    item.number && item.number < 999 ? <div className="name-index">N° {String(item.number).padStart(2, '0')}</div> : null;

  // — Sans abonnement : nom seul + verrou —
  if (!accessGranted) {
    return (
      <div className="glass-card is-locked" onClick={onOpenGate}>
        {indexLabel}
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

  // Premier tap sur le bouton « Égrainer » : ouvre le chapelet complet ET
  // compte ce même tap (pas de « premier tap perdu » à seulement développer
  // la zone) — voir TasbihChapelet.js pour le compteur/la barre, montés
  // indépendamment du chapelet visuel (coûteux, ~100 nœuds DOM + échantillonnage
  // SVG : voir Tasbih.js, jamais monté pour les 99 cartes à la fois).
  const openAndCount = (e) => {
    e.stopPropagation();
    if (!tasbihOpen) setTasbihOpen(true);
    t.tap();
  };

  const pct = Math.round(t.pct);

  // — Abonné : identité/propriétés/actions/Awfaq, puis Dhikr en carte à part —
  return (
    <div className="name-card-group">
      <div className="glass-card" onClick={() => onOpenModal(item)}>
        {indexLabel}

        {/* Identité — arabe, translittération et sens regroupés en un seul
            bloc (revue design : « arabe séparé de Rahman »), au lieu de la
            translittération en pilule à bordure gauche détachée du titre. */}
        <div className="name-identity">
          <div className="arabic-name">{highlight(item.name, searchTerm)}</div>
          <div className="translit-name">{highlight(item.translit, searchTerm)}</div>
          {item.meaning && <div className="meaning-line">{highlight(item.meaning, searchTerm)}</div>}
        </div>

        {poids > 0 && (
          <div className="name-props">
            Poids : <strong>{poids}</strong>
            <span className="name-props-sep">·</span>
            Objectif : <strong>{fmtOrDash(t.numericTarget)}</strong>
          </div>
        )}

        {/* Actions groupées, libellées, compactes — trois colonnes égales
            séparées par un simple filet plutôt que trois pilules pleines
            (revue design : « Favori/Écouter/Détails trop lourds »). Détails
            ouvre NameModal.js, qui porte déjà la signification et le bienfait
            complets : pas dupliqués ici. */}
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

        <div onClick={(e) => e.stopPropagation()}>
          <WafqSquares meaning={item.meaning} benefit={item.benefit} numericTarget={t.numericTarget} />
        </div>
      </div>

      {/* Dhikr — carte dédiée (revue design : « Dhikr peu mis en valeur »),
          plutôt qu'une simple sous-section de la carte d'identité. Repliée
          par défaut : formule + compteur N/objectif + % + barre + un bouton
          « Égrainer » ; le chapelet visuel complet ne se monte qu'au premier
          tap (voir plus haut). */}
      <div className={'glass-card dhikr-card' + (t.flash ? ' goal-reached' : '')} onClick={(e) => e.stopPropagation()}>
        <div className="dhikr-card-head">
          <span className="dhikr-card-label">Dhikr</span>
          <button
            type="button"
            className="dhikr-expand-btn"
            onClick={() => setTasbihOpen((v) => !v)}
            aria-expanded={tasbihOpen}
            aria-label={tasbihOpen ? 'Replier le chapelet' : 'Afficher le chapelet complet'}
          >
            <i className={'fas fa-chevron-' + (tasbihOpen ? 'up' : 'down')} />
          </button>
        </div>
        <div className="dhikr-formula" title="Formule du dhikr">
          {dhikrFormula}
        </div>

        {tasbihOpen ? (
          <Tasbih id={item.id} t={t} open={tasbihOpen} />
        ) : (
          <>
            <div className="dhikr-progress-row">
              <span>
                <strong>{fmt(t.total)}</strong> / {fmtOrDash(t.numericTarget)}
              </span>
              <span className="dhikr-pct">{pct} %</span>
            </div>
            <div className="tc-bar">
              <span style={{ width: pct + '%' }} />
            </div>
            <button type="button" className="dhikr-tap-cta" onClick={openAndCount}>
              Égrainer
            </button>
          </>
        )}
      </div>
    </div>
  );
}
