'use client';
// Carré 7×7 — porté depuis prozizou/Kanzou app/carre/7/page.tsx (voir
// lib/kanzouWafq.ts carre7() pour la formule).
import '../carre.css';
import { useState } from 'react';
import Link from 'next/link';
import { useAccess } from '@/components/AccessProvider';
import { PREMIUM_LEVEL } from '@/lib/access';
import SquareGrid, { squareToRows } from '../_components/SquareGrid';
import NumeralToggle from '../_components/NumeralToggle';
import TextScaleSlider from '../_components/TextScaleSlider';
import ExportWordButton from '../_components/ExportWordButton';
import { carre7, SQUARE7_LAYOUT, type Square7 } from '@/lib/kanzouWafq';
import type { NumeralSystem } from '@/lib/kanzouNumerals';

export default function Carre7Page() {
  const { ensureAccess } = useAccess() as unknown as { ensureAccess: (minLevel?: number) => Promise<boolean> };

  const [base, setBase] = useState('');
  const [base2, setBase2] = useState(''); // base = 7*(x-3)
  const [square, setSquare] = useState<Square7 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [numerals, setNumerals] = useState<NumeralSystem>('latin');
  const [scale, setScale] = useState(1);

  async function handleCompute() {
    setError(null);
    const b = Number(base);
    if (Number.isNaN(b)) {
      setSquare(null);
      setError('Merci de renseigner un nombre valide.');
      return;
    }
    const ok = await ensureAccess(PREMIUM_LEVEL);
    if (!ok) return;
    setSquare(carre7(b));
  }

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <Link href="/wafq/carre" className="back-btn">← Retour</Link>
      <div className="glass-panel kz-wrap">
        <h1 className="kz-title">Carré 7 × 7</h1>

        <div className="kz-fields">
          <label className="kz-field">
            <span>Nombre</span>
            <input type="number" inputMode="numeric" value={base} onChange={(e) => setBase(e.target.value)} />
          </label>
          <label className="kz-field">
            <span>Ou calculer depuis une autre valeur (base = 7 × (x − 3))</span>
            <input
              type="number" inputMode="numeric" value={base2}
              onChange={(e) => {
                setBase2(e.target.value);
                const x = Number(e.target.value);
                if (!Number.isNaN(x) && e.target.value !== '') setBase(String(Math.trunc(7 * (x - 3))));
              }}
            />
          </label>
          <button type="button" className="kz-compute-btn" onClick={handleCompute}>Calculer</button>
          {error && <p className="kz-error">{error}</p>}
        </div>

        {square && (
          <div className="kz-result">
            <div className="kz-result-toolbar">
              <NumeralToggle value={numerals} onChange={setNumerals} />
              <TextScaleSlider value={scale} onChange={setScale} />
              <ExportWordButton
                title="Al Kanzou — Carré 7 × 7"
                rows={squareToRows(SQUARE7_LAYOUT, (idx) => square.t[idx], numerals)}
                fileName="al-kanzou-carre-7x7"
              />
            </div>
            <SquareGrid layout={SQUARE7_LAYOUT} getValue={(idx) => square.t[idx]} numerals={numerals} scale={scale} maxWidth={576} />
          </div>
        )}
      </div>
    </div>
  );
}
