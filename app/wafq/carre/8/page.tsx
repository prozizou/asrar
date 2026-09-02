'use client';
// Carré 8×8 — porté depuis prozizou/Kanzou app/carre/8/page.tsx (voir
// lib/kanzouWafq.ts carre8()/diamond8() pour les formules).
import '../carre.css';
import { useState } from 'react';
import Link from 'next/link';
import { useAccess } from '@/components/AccessProvider';
import { PREMIUM_LEVEL } from '@/lib/access';
import SquareGrid, { squareToRows } from '../_components/SquareGrid';
import NumeralToggle from '../_components/NumeralToggle';
import TextScaleSlider from '../_components/TextScaleSlider';
import ExportWordButton from '../_components/ExportWordButton';
import MagicDiamond from '../_components/MagicDiamond';
import {
  carre8, diamond8, diamond8ToRows, isValidDiamond8Base, DIAMOND8_STEP,
  SQUARE8_LAYOUT, type Square8, type Diamond8,
} from '@/lib/kanzouWafq';
import type { NumeralSystem } from '@/lib/kanzouNumerals';

type Mode = 'carre' | 'losange';

const MODE_LABELS: Record<Mode, string> = {
  carre: 'Carré (une valeur)',
  losange: 'Losange magique (32 nombres)',
};

const MIN_VALUE = 252;
const DIAMOND_MIN_VALUE = 124;

export default function Carre8Page() {
  const { ensureAccess } = useAccess() as unknown as { ensureAccess: (minLevel?: number) => Promise<boolean> };

  const [mode, setMode] = useState<Mode>('carre');
  const [error, setError] = useState<string | null>(null);
  const [numerals, setNumerals] = useState<NumeralSystem>('latin');
  const [scale, setScale] = useState(1);

  const [base, setBase] = useState('');
  const [square, setSquare] = useState<Square8 | null>(null);

  const [diamondBase, setDiamondBase] = useState('');
  const [diamond, setDiamond] = useState<Diamond8 | null>(null);

  function handleModeChange(next: Mode) {
    setMode(next);
    setSquare(null);
    setDiamond(null);
    setError(null);
  }

  async function handleCompute() {
    setError(null);
    if (mode === 'carre') {
      if (base.trim() === '') { setSquare(null); setError('Champ vide.'); return; }
      const b = Number(base);
      if (Number.isNaN(b)) { setSquare(null); setError('Merci de renseigner un nombre valide.'); return; }
      if (b < MIN_VALUE) { setSquare(null); setError(`La valeur doit être supérieure à ${MIN_VALUE}.`); return; }
      const ok = await ensureAccess(PREMIUM_LEVEL);
      if (!ok) return;
      setSquare(carre8(b));
    } else {
      if (diamondBase.trim() === '') { setDiamond(null); setError('Champ vide.'); return; }
      const b = Number(diamondBase);
      if (Number.isNaN(b)) { setDiamond(null); setError('Merci de renseigner un nombre valide.'); return; }
      if (b < DIAMOND_MIN_VALUE) { setDiamond(null); setError(`La valeur doit être supérieure à ${DIAMOND_MIN_VALUE}.`); return; }
      if (!isValidDiamond8Base(b)) {
        setDiamond(null);
        const lower = b - ((b - DIAMOND_MIN_VALUE) % DIAMOND8_STEP);
        const upper = lower + DIAMOND8_STEP;
        setError(
          `Ce nombre ne donne pas des rangées exactement égales à ${b} ` +
            `(le losange n'a que 32 cases pour ${DIAMOND8_STEP} termes par rangée : ` +
            `seul un nombre de la forme ${DIAMOND_MIN_VALUE} + ${DIAMOND8_STEP}×n convient). ` +
            `Essayez ${lower} ou ${upper}.`
        );
        return;
      }
      const ok = await ensureAccess(PREMIUM_LEVEL);
      if (!ok) return;
      setDiamond(diamond8(b));
    }
  }

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <Link href="/wafq/carre" className="back-btn">← Retour</Link>
      <div className="glass-panel kz-wrap">
        <h1 className="kz-title">Carré 8 × 8</h1>

        <div className="kz-modes">
          {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
            <button key={m} type="button" className={'kz-mode-btn' + (mode === m ? ' active' : '')} onClick={() => handleModeChange(m)}>
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {mode === 'losange' && (
          <p className="kz-note">
            Absent de l’app Android d’origine. Losange de 32 nombres fourni par l’utilisateur : 4 rangées
            gauche-à-droite, 4 rangées droite-à-gauche et 2 colonnes somment toutes au nombre entré ; les
            losanges intérieurs concentriques somment à sa moitié. Chaque case du diagramme est coupée en
            deux : un nombre « extérieur » (haut) et un nombre « intérieur » (bas). Ici, chaque case
            appartient à une rangée des deux sens à la fois, donc seul un nombre de la forme{' '}
            {DIAMOND_MIN_VALUE} + {DIAMOND8_STEP}×n donne des rangées exactement égales au nombre entré.
          </p>
        )}

        <div className="kz-fields">
          {mode === 'carre' ? (
            <label className="kz-field">
              <span>Nombre (supérieur à {MIN_VALUE})</span>
              <input type="number" inputMode="numeric" value={base} onChange={(e) => setBase(e.target.value)} />
            </label>
          ) : (
            <label className="kz-field">
              <span>
                Nombre (supérieur à {DIAMOND_MIN_VALUE}, de la forme {DIAMOND_MIN_VALUE} + {DIAMOND8_STEP}×n
                — ex. {DIAMOND_MIN_VALUE}, {DIAMOND_MIN_VALUE + DIAMOND8_STEP}, {DIAMOND_MIN_VALUE + 2 * DIAMOND8_STEP}…)
              </span>
              <input type="number" inputMode="numeric" value={diamondBase} onChange={(e) => setDiamondBase(e.target.value)} />
            </label>
          )}

          <button type="button" className="kz-compute-btn" onClick={handleCompute}>Calculer</button>
          {error && <p className="kz-error">{error}</p>}
        </div>

        {mode === 'carre' && square && (
          <div className="kz-result">
            <div className="kz-result-toolbar">
              <NumeralToggle value={numerals} onChange={setNumerals} />
              <TextScaleSlider value={scale} onChange={setScale} />
              <ExportWordButton
                title="Al Kanzou — Carré 8 × 8"
                rows={squareToRows(SQUARE8_LAYOUT, (idx) => square.t[idx], numerals)}
                fileName="al-kanzou-carre-8x8"
              />
            </div>
            <SquareGrid layout={SQUARE8_LAYOUT} getValue={(idx) => square.t[idx]} numerals={numerals} scale={scale} maxWidth={672} />
          </div>
        )}

        {mode === 'losange' && diamond && (
          <div className="kz-result">
            <div className="kz-result-toolbar">
              <NumeralToggle value={numerals} onChange={setNumerals} />
              <TextScaleSlider value={scale} onChange={setScale} />
              <ExportWordButton
                title="Al Kanzou — Losange magique"
                rows={diamond8ToRows(diamond)}
                fileName="al-kanzou-losange-magique"
              />
            </div>
            <MagicDiamond cells={diamond.cells} numerals={numerals} scale={scale} />
          </div>
        )}
      </div>
    </div>
  );
}
