'use client';
// Carré 6×6 — porté depuis prozizou/Kanzou app/carre/6/page.tsx (voir
// lib/kanzouWafq.ts carre6() pour la formule).
import '../carre.css';
import { useState } from 'react';
import Link from 'next/link';
import { useAccess } from '@/components/AccessProvider';
import { PREMIUM_LEVEL } from '@/lib/access';
import SquareGrid, { squareToRows } from '../_components/SquareGrid';
import NumeralToggle from '../_components/NumeralToggle';
import TextScaleSlider from '../_components/TextScaleSlider';
import ExportWordButton from '../_components/ExportWordButton';
import { carre6, SQUARE6_LAYOUT, type Square6 } from '@/lib/kanzouWafq';
import type { NumeralSystem } from '@/lib/kanzouNumerals';

export default function Carre6Page() {
  const { ensureAccess } = useAccess() as unknown as { ensureAccess: (minLevel?: number) => Promise<boolean> };

  const [base, setBase] = useState('');
  const [square, setSquare] = useState<Square6 | null>(null);
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
    setSquare(carre6(b));
  }

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <Link href="/wafq/carre" className="back-btn">← Retour</Link>
      <div className="glass-panel kz-wrap">
        <h1 className="kz-title">Carré 6 × 6</h1>

        <div className="kz-fields">
          <label className="kz-field">
            <span>Nombre</span>
            <input type="number" inputMode="numeric" value={base} onChange={(e) => setBase(e.target.value)} />
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
                title="Al Kanzou — Carré 6 × 6"
                rows={squareToRows(SQUARE6_LAYOUT, (idx) => square.t[idx], numerals)}
                fileName="al-kanzou-carre-6x6"
              />
            </div>
            <SquareGrid layout={SQUARE6_LAYOUT} getValue={(idx) => square.t[idx]} numerals={numerals} scale={scale} maxWidth={512} />
          </div>
        )}
      </div>
    </div>
  );
}
