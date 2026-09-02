'use client';
// Carré 5×5 — porté depuis prozizou/Kanzou app/carre/5/page.tsx (voir
// lib/kanzouWafq.ts carre5Base()/carre5Askandria() pour les formules).
import '../carre.css';
import { useState } from 'react';
import Link from 'next/link';
import { useAccess } from '@/components/AccessProvider';
import { PREMIUM_LEVEL } from '@/lib/access';
import SquareGrid, { squareToRows } from '../_components/SquareGrid';
import NumeralToggle from '../_components/NumeralToggle';
import TextScaleSlider from '../_components/TextScaleSlider';
import ExportWordButton from '../_components/ExportWordButton';
import Field from '../_components/Field';
import { carre5Base, carre5Askandria, SQUARE5_LAYOUT, type Square5 } from '@/lib/kanzouWafq';
import type { NumeralSystem } from '@/lib/kanzouNumerals';

type Mode = 'base' | 'askandria';

const MODE_LABELS: Record<Mode, string> = {
  base: 'Base (une valeur)',
  askandria: 'Askandria (4 valeurs connues)',
};

export default function Carre5Page() {
  const { ensureAccess } = useAccess() as unknown as { ensureAccess: (minLevel?: number) => Promise<boolean> };

  const [mode, setMode] = useState<Mode>('base');
  const [square, setSquare] = useState<Square5 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [numerals, setNumerals] = useState<NumeralSystem>('latin');
  const [scale, setScale] = useState(1);

  // Mode Base
  const [base, setBase] = useState('');
  const [base2, setBase2] = useState(''); // équivalent edittext2 : base = 5*(x-2)

  // Mode Askandria
  const [t8, setT8] = useState('');
  const [t4, setT4] = useState('');
  const [t21, setT21] = useState('');
  const [t17, setT17] = useState('');

  async function handleCompute() {
    setError(null);
    try {
      let next: Square5;
      if (mode === 'base') {
        const b = Number(base);
        if (Number.isNaN(b)) throw new Error('invalid');
        next = carre5Base(b);
      } else {
        const v8 = Number(t8), v4 = Number(t4), v21 = Number(t21), v17 = Number(t17);
        if ([v8, v4, v21, v17].some((n) => Number.isNaN(n))) throw new Error('invalid');
        next = carre5Askandria(v8, v4, v21, v17);
      }
      const ok = await ensureAccess(PREMIUM_LEVEL);
      if (!ok) return;
      setSquare(next);
    } catch {
      setSquare(null);
      setError('Merci de renseigner un nombre valide dans chaque champ.');
    }
  }

  function handleModeChange(next: Mode) {
    setMode(next);
    setSquare(null);
    setError(null);
  }

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <Link href="/wafq/carre" className="back-btn">← Retour</Link>
      <div className="glass-panel kz-wrap">
        <h1 className="kz-title">Carré 5 × 5</h1>

        <div className="kz-modes">
          {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
            <button key={m} type="button" className={'kz-mode-btn' + (mode === m ? ' active' : '')} onClick={() => handleModeChange(m)}>
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        <div className="kz-fields">
          {mode === 'base' && (
            <>
              <label className="kz-field">
                <span>Nombre</span>
                <input type="number" inputMode="numeric" value={base} onChange={(e) => setBase(e.target.value)} />
              </label>
              <label className="kz-field">
                <span>Ou calculer depuis une autre valeur (base = 5 × (x − 2))</span>
                <input
                  type="number" inputMode="numeric" value={base2}
                  onChange={(e) => {
                    setBase2(e.target.value);
                    const x = Number(e.target.value);
                    if (!Number.isNaN(x) && e.target.value !== '') setBase(String(Math.trunc(5 * (x - 2))));
                  }}
                />
              </label>
            </>
          )}

          {mode === 'askandria' && (
            <div className="kz-fields grid2">
              <Field label="t8" value={t8} onChange={setT8} />
              <Field label="t4" value={t4} onChange={setT4} />
              <Field label="t21" value={t21} onChange={setT21} />
              <Field label="t17" value={t17} onChange={setT17} />
            </div>
          )}

          <button type="button" className="kz-compute-btn" onClick={handleCompute}>Calculer</button>
          {error && <p className="kz-error">{error}</p>}
        </div>

        {square && (
          <div className="kz-result">
            <div className="kz-result-toolbar">
              <NumeralToggle value={numerals} onChange={setNumerals} />
              <TextScaleSlider value={scale} onChange={setScale} />
              <ExportWordButton
                title="Al Kanzou — Carré 5 × 5"
                rows={squareToRows(SQUARE5_LAYOUT, (idx) => square.t[idx], numerals)}
                fileName="al-kanzou-carre-5x5"
              />
            </div>
            <SquareGrid
              layout={SQUARE5_LAYOUT} getValue={(idx) => square.t[idx]} getFilled={(idx) => square.t[idx] !== null}
              numerals={numerals} scale={scale} maxWidth={448}
            />
            {square.total !== undefined && <p className="kz-total">Tot: {square.total}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
