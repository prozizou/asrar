'use client';
// Carré 11×11 — porté depuis prozizou/Kanzou app/carre/11/page.tsx (voir
// lib/kanzouWafq.ts carre11() : taille absente de l'app d'origine, carré de
// référence fourni décalé uniformément).
import '../carre.css';
import { useState } from 'react';
import Link from 'next/link';
import { useAccess } from '@/components/AccessProvider';
import { PREMIUM_LEVEL } from '@/lib/access';
import SquareGrid, { squareToRows } from '../_components/SquareGrid';
import NumeralToggle from '../_components/NumeralToggle';
import TextScaleSlider from '../_components/TextScaleSlider';
import ExportWordButton from '../_components/ExportWordButton';
import { carre11, SQUARE11_LAYOUT, type Square11 } from '@/lib/kanzouWafq';
import type { NumeralSystem } from '@/lib/kanzouNumerals';

const MIN_VALUE = 660;

export default function Carre11Page() {
  const { ensureAccess } = useAccess() as unknown as { ensureAccess: (minLevel?: number) => Promise<boolean> };

  const [base, setBase] = useState('');
  const [square, setSquare] = useState<Square11 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [numerals, setNumerals] = useState<NumeralSystem>('latin');
  const [scale, setScale] = useState(1);

  async function handleCompute() {
    setError(null);
    if (base.trim() === '') { setSquare(null); setError('Champ vide.'); return; }
    const b = Number(base);
    if (Number.isNaN(b)) { setSquare(null); setError('Merci de renseigner un nombre valide.'); return; }
    if (b < MIN_VALUE) { setSquare(null); setError(`La valeur doit être supérieure à ${MIN_VALUE}.`); return; }
    const ok = await ensureAccess(PREMIUM_LEVEL);
    if (!ok) return;
    setSquare(carre11(b));
  }

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <Link href="/wafq/carre" className="back-btn">← Retour</Link>
      <div className="glass-panel kz-wrap">
        <h1 className="kz-title">Carré 11 × 11</h1>
        <p className="kz-note">
          Taille absente de l’app Android d’origine (le plus grand carré développé était le 10×10, resté
          inachevé). Ce carré repose sur un carré magique de référence (671 ; lignes, colonnes et diagonales
          valides ; entiers 1 à 121 chacun utilisé une fois), décalé uniformément selon le nombre entré.
        </p>

        <div className="kz-fields">
          <label className="kz-field">
            <span>Nombre (supérieur à {MIN_VALUE})</span>
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
                title="Al Kanzou — Carré 11 × 11"
                rows={squareToRows(SQUARE11_LAYOUT, (idx) => square.t[idx], numerals)}
                fileName="al-kanzou-carre-11x11"
              />
            </div>
            <SquareGrid layout={SQUARE11_LAYOUT} getValue={(idx) => square.t[idx]} numerals={numerals} scale={scale} maxWidth={672} />
          </div>
        )}
      </div>
    </div>
  );
}
