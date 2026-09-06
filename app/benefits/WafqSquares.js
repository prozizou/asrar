'use client';
// Awfaq — carrés magiques — port de buildWafqSliderHtml() + le bloc <details>
// de hydrateCard(). Bascule chiffres occidentaux / arabes orientaux via l'état.
import { useMemo, useState } from 'react';
import {
  generateAllWafq3x3,
  generateAllWafq3x3Vide,
  generateAllWafq4x4,
  getElementalOrderFromText,
  toEasternArabic,
} from '@/lib/abjad';

function Square({ squares, orderedKeys, numericTarget, typeName, eastern }) {
  if (!squares) return null;
  const first = squares[orderedKeys[0]];
  const cols = first && Array.isArray(first.grid) && first.grid.length ? first.grid.length : typeName.indexOf('4') !== -1 ? 4 : 3;
  const is4 = cols === 4;

  return (
    <>
      {orderedKeys.map((key, index) => {
        const sq = squares[key];
        const isPrimary = index === 0;
        return (
          <div key={key} className={'wafq-slide' + (isPrimary ? ' primary-element' : '')}>
            <div className="wafq-nature-badge">
              {sq.icon} {sq.arabic}
            </div>
            <div className="wafq-title">
              {typeName}
              {isPrimary ? ' ✦' : ''}
            </div>
            <div className="wafq-subtitle">
              Constante: {numericTarget} · {sq.name}
            </div>
            <div className={`wafq-grid grid-${cols}x${cols}`}>
              {sq.grid.map((row, rIndex) =>
                row.map((cell, cIndex) => {
                  const shown = eastern ? toEasternArabic(cell.v) : cell.v;
                  if (cell.s === 'V') {
                    return (
                      <div key={`${rIndex}-${cIndex}`} className="wafq-cell center-vide">
                        <span className="num-w">{shown}</span>
                      </div>
                    );
                  }
                  let stepClass = 'step-right';
                  if (is4 && cIndex === 1 && (rIndex === 1 || rIndex === 2)) stepClass = 'step-left';
                  return (
                    <div key={`${rIndex}-${cIndex}`} className="wafq-cell">
                      <span className={'cell-step ' + stepClass} title="Ordre de remplissage">
                        {cell.s}
                      </span>
                      <span className="cell-val">
                        <span className="num-w">{shown}</span>
                      </span>
                    </div>
                  );
                })
              )}
              {is4 && <div className="wafq-center-dot" />}
            </div>
          </div>
        );
      })}
    </>
  );
}

export default function WafqSquares({ meaning, benefit, numericTarget }) {
  const [eastern, setEastern] = useState(false);
  const orderedKeys = useMemo(() => getElementalOrderFromText(meaning, benefit), [meaning, benefit]);

  const s3 = numericTarget >= 15 ? generateAllWafq3x3(numericTarget) : null;
  const s3v = numericTarget >= 15 ? generateAllWafq3x3Vide(numericTarget) : null;
  const s4 = numericTarget >= 34 ? generateAllWafq4x4(numericTarget) : null;

  if (!s3 && !s3v && !s4) return null;

  const slider = (squares, typeName) =>
    squares ? (
      <div className="wafq-slider-wrapper">
        <div className="swipe-hint">
          <i className="fas fa-arrows-left-right" /> Glissez pour voir les autres éléments
        </div>
        <div className="wafq-slider">
          <Square squares={squares} orderedKeys={orderedKeys} numericTarget={numericTarget} typeName={typeName} eastern={eastern} />
        </div>
      </div>
    ) : null;

  return (
    <details className="wafq-expander wafq-container-global" aria-label="Carrés Magiques">
      <summary className="wafq-summary" aria-expanded="false">
        <span>
          <i className="fas fa-table-cells" style={{ marginRight: 6 }} />
          Awfaq &amp; carrés magiques
        </span>
        <i className="fas fa-chevron-down toggle-icon" />
      </summary>
      <div className="wafq-controls">
        <span style={{ fontSize: '0.8rem' }}>123</span>
        <label className="switch-numeral" title="Chiffres arabes orientaux">
          <input
            type="checkbox"
            className="toggle-numeral-btn"
            aria-label="Basculer chiffres arabes"
            checked={eastern}
            onChange={(e) => setEastern(e.target.checked)}
          />
          <span className="slider-numeral round" />
        </label>
        <span style={{ fontSize: '1rem' }}>١٢٣</span>
      </div>
      {slider(s3, '3×3 Classique')}
      {slider(s3v, '3×3 Vide')}
      {slider(s4, '4×4 Murabba')}
    </details>
  );
}
