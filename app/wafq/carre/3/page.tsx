'use client';
// Carré 3×3 — porté depuis prozizou/Kanzou app/carre/3/page.tsx (voir
// lib/kanzouWafq.ts wilaya()/ghazaly()/bayt()/hatimTriangulaire() pour les
// formules et le bug corrigé du mode Bayt).
import '../carre.css';
import { useState } from 'react';
import Link from 'next/link';
import { useAccess } from '@/components/AccessProvider';
import { PREMIUM_LEVEL } from '@/lib/access';
import SquareGrid, { squareToRows } from '../_components/SquareGrid';
import HatimTriangleGrid from '../_components/HatimTriangleGrid';
import NumeralToggle from '../_components/NumeralToggle';
import TextScaleSlider from '../_components/TextScaleSlider';
import ExportWordButton from '../_components/ExportWordButton';
import Field from '../_components/Field';
import {
  wilaya, ghazaly, bayt, hatimTriangulaire, hatimTriangleToRows, SQUARE3_LAYOUT,
  type Square3, type HatimTriangle,
} from '@/lib/kanzouWafq';
import type { NumeralSystem } from '@/lib/kanzouNumerals';

type Mode = 'wilaya' | 'ghazaly' | 'bayt' | 'hatim';

const MODE_LABELS: Record<Mode, string> = {
  wilaya: 'Wilaya (3 valeurs connues)',
  ghazaly: 'Ghazaly (une valeur)',
  bayt: 'Bayt (deux valeurs)',
  hatim: 'Hatim triangulaire (une valeur)',
};

export default function Carre3Page() {
  const { ensureAccess } = useAccess() as unknown as { ensureAccess: (minLevel?: number) => Promise<boolean> };

  const [mode, setMode] = useState<Mode>('ghazaly');
  const [square, setSquare] = useState<Square3 | null>(null);
  const [triangle, setTriangle] = useState<HatimTriangle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [numerals, setNumerals] = useState<NumeralSystem>('latin');
  const [scale, setScale] = useState(1);

  // Wilaya
  const [wE2, setWE2] = useState('8');
  const [wE4, setWE4] = useState('2');
  const [wE9, setWE9] = useState('4');

  // Ghazaly
  const [hajah, setHajah] = useState('');

  // Bayt
  const [bHajah, setBHajah] = useState('');
  const [bEntree, setBEntree] = useState('');

  // Hatim triangulaire
  const [hD, setHD] = useState('');

  async function handleCompute() {
    setError(null);
    try {
      if (mode === 'wilaya') {
        const e2 = Number(wE2), e4 = Number(wE4), e9 = Number(wE9);
        if ([e2, e4, e9].some((n) => Number.isNaN(n))) throw new Error('invalid');
        const ok = await ensureAccess(PREMIUM_LEVEL);
        if (!ok) return;
        setSquare(wilaya(e2, e4, e9));
      } else if (mode === 'ghazaly') {
        const g = Number(hajah);
        if (Number.isNaN(g)) throw new Error('invalid');
        const ok = await ensureAccess(PREMIUM_LEVEL);
        if (!ok) return;
        setSquare(ghazaly(g));
      } else if (mode === 'bayt') {
        const g = Number(bHajah), en = Number(bEntree);
        if (Number.isNaN(g) || Number.isNaN(en)) throw new Error('invalid');
        const ok = await ensureAccess(PREMIUM_LEVEL);
        if (!ok) return;
        setSquare(bayt(g, en));
      } else {
        const d = Number(hD);
        if (Number.isNaN(d) || hD.trim() === '') throw new Error('invalid');
        const ok = await ensureAccess(PREMIUM_LEVEL);
        if (!ok) return;
        setTriangle(hatimTriangulaire(d));
      }
    } catch {
      setSquare(null);
      setTriangle(null);
      setError('Merci de renseigner un nombre valide dans chaque champ.');
    }
  }

  function handleModeChange(next: Mode) {
    setMode(next);
    setSquare(null);
    setTriangle(null);
    setError(null);
  }

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <Link href="/wafq/carre" className="back-btn">← Retour</Link>
      <div className="glass-panel kz-wrap">
        <h1 className="kz-title">Carré 3 × 3</h1>

        <div className="kz-modes">
          {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
            <button key={m} type="button" className={'kz-mode-btn' + (mode === m ? ' active' : '')} onClick={() => handleModeChange(m)}>
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {mode === 'hatim' && (
          <p className="kz-note">
            Absent de l’app Android d’origine (aucune Activity Java correspondante). Un triangle extérieur
            (sommet + 2 coins de base) dont le triangle médian intérieur relie les milieux des 3 côtés : les
            6 lignes droites du diagramme somment toutes à la valeur entrée. Comme pour Ghazaly, une seule
            valeur suffit — les 3 sommets sont départagés automatiquement.
          </p>
        )}

        <div className="kz-fields">
          {mode === 'wilaya' && (
            <div className="kz-fields grid3">
              <Field label="e2" value={wE2} onChange={setWE2} />
              <Field label="e4" value={wE4} onChange={setWE4} />
              <Field label="e9" value={wE9} onChange={setWE9} />
            </div>
          )}

          {mode === 'ghazaly' && (
            <label className="kz-field">
              <span>Nombre (hajah)</span>
              <input type="number" inputMode="numeric" value={hajah} onChange={(e) => setHajah(e.target.value)} />
            </label>
          )}

          {mode === 'bayt' && (
            <div className="kz-fields grid2">
              <Field label="Nombre (hajah)" value={bHajah} onChange={setBHajah} />
              <Field label="Entrée" value={bEntree} onChange={setBEntree} />
            </div>
          )}

          {mode === 'hatim' && (
            <label className="kz-field">
              <span>Valeur (somme de chaque ligne)</span>
              <input type="number" inputMode="numeric" value={hD} onChange={(e) => setHD(e.target.value)} />
            </label>
          )}

          {mode === 'bayt' && bHajah && !bEntree && (
            <button type="button" className="kz-suggest-btn" onClick={() => setBEntree(String(Math.trunc(Number(bHajah) * 3)))}>
              Suggérer entrée = 3 × hajah
            </button>
          )}

          <button type="button" className="kz-compute-btn" onClick={handleCompute}>Calculer</button>
          {error && <p className="kz-error">{error}</p>}
        </div>

        {mode !== 'hatim' && square && (
          <div className="kz-result">
            <div className="kz-result-toolbar">
              <NumeralToggle value={numerals} onChange={setNumerals} />
              <TextScaleSlider value={scale} onChange={setScale} />
              <ExportWordButton
                title="Al Kanzou — Carré 3 × 3"
                rows={squareToRows(SQUARE3_LAYOUT, (key) => square[key], numerals)}
                fileName="al-kanzou-carre-3x3"
              />
            </div>
            <SquareGrid layout={SQUARE3_LAYOUT} getValue={(key) => square[key]} numerals={numerals} scale={scale} maxWidth={320} />
          </div>
        )}

        {mode === 'hatim' && triangle && (
          <div className="kz-result">
            <div className="kz-result-toolbar">
              <NumeralToggle value={numerals} onChange={setNumerals} />
              <TextScaleSlider value={scale} onChange={setScale} />
              <ExportWordButton
                title="Al Kanzou — Hatim triangulaire"
                rows={hatimTriangleToRows(triangle)}
                fileName="al-kanzou-hatim-triangulaire"
              />
            </div>
            <HatimTriangleGrid triangle={triangle} numerals={numerals} scale={scale} />
          </div>
        )}
      </div>
    </div>
  );
}
