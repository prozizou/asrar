'use client';
// Carré 9×9 — porté depuis prozizou/Kanzou app/carre/9/page.tsx (voir
// lib/kanzouWafq.ts carre9() : 9 cases jamais calculées dans l'app
// d'origine, complétées ici par la règle du carré magique).
import '../carre.css';
import { useState } from 'react';
import Link from 'next/link';
import { useAccess } from '@/components/AccessProvider';
import { PREMIUM_LEVEL } from '@/lib/access';
import SquareGrid, { squareToRows } from '../_components/SquareGrid';
import NumeralToggle from '../_components/NumeralToggle';
import TextScaleSlider from '../_components/TextScaleSlider';
import ExportWordButton from '../_components/ExportWordButton';
import { carre9, SQUARE9_LAYOUT, type Square9 } from '@/lib/kanzouWafq';
import type { NumeralSystem } from '@/lib/kanzouNumerals';

const MIN_VALUE = 360;

export default function Carre9Page() {
  const { ensureAccess } = useAccess() as unknown as { ensureAccess: (minLevel?: number) => Promise<boolean> };

  const [base, setBase] = useState('');
  const [square, setSquare] = useState<Square9 | null>(null);
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
    setSquare(carre9(b));
  }

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <Link href="/wafq/carre" className="back-btn">← Retour</Link>
      <div className="glass-panel kz-wrap">
        <h1 className="kz-title">Carré 9 × 9</h1>
        <p className="kz-note">
          Dans l’app d’origine, 9 cases n’étaient jamais calculées (le code s’arrête avec un commentaire
          « //KASR »). Elles sont complétées ici en appliquant la règle du carré magique : chaque ligne doit
          sommer au nombre entré, donc la case manquante d’une ligne vaut ce nombre moins la somme des 8
          autres cases de la même ligne.
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
                title="Al Kanzou — Carré 9 × 9"
                rows={squareToRows(SQUARE9_LAYOUT, (idx) => square.t[idx], numerals)}
                fileName="al-kanzou-carre-9x9"
              />
            </div>
            <SquareGrid
              layout={SQUARE9_LAYOUT} getValue={(idx) => square.t[idx]} getFilled={(idx) => square.t[idx] !== null}
              numerals={numerals} scale={scale} maxWidth={672}
            />
          </div>
        )}
      </div>
    </div>
  );
}
