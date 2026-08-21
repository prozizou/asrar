'use client';
// Compteur de dhikr (UI) — port du bloc .inline-tasbih de hydrateCard().
// La logique vit dans useTasbih ; ici, l'affichage + l'animation des grains.
import { useRef } from 'react';
import { objSubdivisions } from '@/lib/benefits';

// Défilement fluide d'un grain (port de scrollBead) : décale d'une largeur de
// grain puis recycle le premier sans à-coup.
function scrollBead(container) {
  if (!container) return;
  const first = container.firstElementChild;
  if (!first) return;
  const style = getComputedStyle(container);
  const gap = parseFloat(style.columnGap || style.gap || '0') || 0;
  const shift = first.getBoundingClientRect().width + gap;
  container.style.transition = 'transform 0.28s cubic-bezier(0.22, 0.61, 0.36, 1)';
  container.style.transform = `translateX(-${shift}px)`;
  const onEnd = () => {
    container.removeEventListener('transitionend', onEnd);
    container.style.transition = 'none';
    container.style.transform = 'translateX(0)';
    container.appendChild(first);
    void container.offsetWidth;
  };
  container.addEventListener('transitionend', onEnd);
}

export default function Tasbih({ id, t, open }) {
  const beadsRef = useRef(null);

  const onTap = (e) => {
    if (e.target.closest('.tasbih-settings')) return; // les réglages ne comptent pas
    t.tap();
    scrollBead(beadsRef.current);
  };

  const subs = objSubdivisions(t.target);

  return (
    <div
      className={'inline-tasbih' + (open ? ' active' : '')}
      id={`inline-tasbih-${id}`}
      role="region"
      aria-label="Compteur de dhikr"
      onClick={onTap}
    >
      <div className="tasbih-settings">
        <div className="setting-group" title="Objectif de récitation (Poids × 7 par défaut)">
          <i className="fas fa-bullseye" />
          <input
            type="number"
            className="zikr-input"
            placeholder="Obj."
            min="0"
            aria-label="Objectif"
            value={t.target}
            onChange={(e) => t.setTarget(e.target.value)}
          />
        </div>
        <div className="obj-subdiv">
          {subs.map((x) => (
            <span key={x} className="obj-chip">
              {x}
            </span>
          ))}
        </div>
        <div className="setting-group" title="Nombre de séries (l'objectif est réparti dessus, le reste va sur la dernière)">
          <i className="fas fa-rotate" />
          <input
            type="number"
            className="zikr-input"
            placeholder="Séries"
            min="0"
            aria-label="Nombre de séries"
            value={t.series}
            onChange={(e) => t.setSeries(e.target.value)}
          />
        </div>
        <div
          className="loop-display"
          style={{ display: t.seriesCount > 0 ? 'flex' : 'none', alignItems: 'center', gap: 4 }}
        >
          Série <span>{t.loopCur}</span>/<span>{t.seriesCount}</span>
        </div>
        <button className="reset-zikr-btn" aria-label="Réinitialiser le compteur" onClick={t.reset}>
          <i className="fas fa-rotate-left" />
        </button>
      </div>

      <div className="inline-counter" aria-live="polite" aria-atomic="true">
        {String(t.count).padStart(2, '0')}
      </div>

      {/* Série de dhikr (lib/dhikrStreak.js) : portée globale (tous noms),
          pas propre à cette carte — affichée dès qu'il y a une série en
          cours, avec un badge de franchissement de seuil temporaire. */}
      {t.streak > 0 && (
        <div className="tasbih-streak" aria-live="polite">
          🔥 Série : {t.streak} jour{t.streak > 1 ? 's' : ''}
          {t.newBadge && (
            <span className="tasbih-streak-badge">
              {t.newBadge.icon} Badge « {t.newBadge.label} » débloqué !
            </span>
          )}
        </div>
      )}

      <div className="tasbih-progress" style={{ margin: '6px 0 4px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', opacity: 0.85 }}>
          <span>Progression</span>
          <span>
            <strong>{t.total}</strong> / <span>{t.numericTarget || 0}</span>
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 6, background: 'var(--glass-border)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: t.pct + '%',
              borderRadius: 6,
              background: 'linear-gradient(90deg,var(--accent),var(--accent-hover))',
              transition: 'width .3s ease',
            }}
          />
        </div>
      </div>

      <div className="inline-bead-string" aria-hidden="true">
        <div className="inline-bead-line" />
        <div className="inline-beads-container" ref={beadsRef}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="inline-bead" />
          ))}
        </div>
      </div>

      <p className="tasbih-hint">Appuyez pour égrainer</p>
    </div>
  );
}
