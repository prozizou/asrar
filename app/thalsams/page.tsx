'use client';
// Module « Thalsams » — recherche combinatoire d'une chaîne de lettres
// arabes dont le poids abjad total égale exactement une valeur cible, avec
// finition imposée et classification lumineuse/non-lumineuse — port de la
// spécification fonctionnelle fournie par l'utilisateur (voir lib/thalsam.js
// pour le moteur, section par section). Entièrement côté client : la
// recherche est pure et rapide (backtracking + élagage), pas d'appel serveur.
//
// Réservé au forfait 1 An (même palier que Al-Qalam/Géomancie/Wafq — cf.
// menu) : générée seulement après ensureAccess(), jamais « en silence ».
import './thalsams.css';
import { useState } from 'react';
import Link from 'next/link';
import { useAccess } from '@/components/AccessProvider';
import { PREMIUM_LEVEL } from '@/lib/access';
import { generateThalsams, ENDINGS, TARGET_WEIGHT_MAX } from '@/lib/thalsam';

type LengthMode = 'exact' | 'range' | 'auto';
type EndingMode = 'auto' | 'specific';
type Classification = 'mixed' | 'luminousOnly' | 'nonLuminousOnly';

function ResultCard({ r }: { r: any }) {
  const [showCalc, setShowCalc] = useState(false);
  return (
    <div className="th-card">
      <div className="th-card-word">{r.thalsam}</div>
      <div className="th-card-meta">
        <span><b>Poids</b> {r.totalWeight}</span>
        <span><b>Lettres</b> {r.totalLetters}</span>
        <span><b>Finition</b> {r.ending}</span>
        <span><b>Racine</b> {r.root || '—'} ({r.rootWeight})</span>
      </div>
      <div className="th-card-verif">{r.rootWeight} + {r.endingWeight} = {r.totalWeight} ✓</div>
      <button type="button" className="th-detail-toggle" onClick={() => setShowCalc((v) => !v)}>
        {showCalc ? 'Masquer le détail' : 'Détail lettre par lettre'}
      </button>
      {showCalc && (
        <div className="th-calc">
          {r.calculation.map((c: { letter: string; value: number }, i: number) => (
            <span key={i} className="th-calc-item">{c.letter}<span>{c.value}</span></span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ThalsamsPage() {
  const { ensureAccess } = useAccess() as unknown as { ensureAccess: (minLevel?: number) => Promise<boolean> };

  const [targetWeight, setTargetWeight] = useState('');
  const [lengthMode, setLengthMode] = useState<LengthMode>('exact');
  const [lengthExact, setLengthExact] = useState('7');
  const [lengthMin, setLengthMin] = useState('5');
  const [lengthMax, setLengthMax] = useState('8');
  const [endingMode, setEndingMode] = useState<EndingMode>('auto');
  const [endingSelected, setEndingSelected] = useState(ENDINGS[0]);
  const [classification, setClassification] = useState<Classification>('mixed');
  const [allowRepeats, setAllowRepeats] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [output, setOutput] = useState<any>(null);

  const targetNum = Math.floor(Number(targetWeight));
  const targetValid = targetWeight !== '' && Number.isFinite(targetNum) && targetNum > 0 && targetNum <= TARGET_WEIGHT_MAX;
  const canSubmit = !busy && targetValid;

  const onGenerate = async () => {
    if (!canSubmit) return;
    setError('');
    setBusy(true);
    try {
      const ok = await ensureAccess(PREMIUM_LEVEL);
      if (!ok) return;

      const length: { mode: LengthMode; exact?: number; min?: number; max?: number } =
        lengthMode === 'exact' ? { mode: 'exact', exact: Number(lengthExact) }
        : lengthMode === 'range' ? { mode: 'range', min: Number(lengthMin), max: Number(lengthMax) }
        : { mode: 'auto' };

      const out = generateThalsams({
        targetWeight: targetNum,
        length,
        ending: endingMode === 'auto' ? { mode: 'auto' } : { mode: 'specific', selected: endingSelected },
        letterClassification: { mode: classification },
        generation: { allowRepeatedLetters: allowRepeats },
      });

      if (out.error) {
        setError(out.error);
        setOutput(null);
      } else {
        setOutput(out);
      }
    } finally {
      setBusy(false);
    }
  };

  const grouped = output && lengthMode !== 'exact'
    ? Object.entries(
        output.results.reduce((acc: Record<number, any[]>, r: any) => {
          (acc[r.totalLetters] ||= []).push(r);
          return acc;
        }, {})
      ).sort(([a], [b]) => Number(a) - Number(b))
    : null;

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <Link href="/menu" className="back-btn">← Retour</Link>
      <div className="glass-panel">
        <div className="header">
          <h1>🧿 Thalsams</h1>
          <p style={{ color: 'var(--text-muted)' }}>Recherche combinatoire d’une chaîne de lettres dont le poids égale exactement une valeur cible.</p>
        </div>

        <label className="th-field">
          <span>Poids cible <em style={{ color: 'var(--accent)', fontStyle: 'normal' }}>obligatoire</em></span>
          <input type="number" min={1} max={TARGET_WEIGHT_MAX} value={targetWeight} placeholder="2743" onChange={(e) => setTargetWeight(e.target.value)} />
        </label>

        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>Nombre de lettres</span>
        <div className="th-tabs">
          <button type="button" className={'th-tab' + (lengthMode === 'exact' ? ' active' : '')} onClick={() => setLengthMode('exact')}>Exactement</button>
          <button type="button" className={'th-tab' + (lengthMode === 'range' ? ' active' : '')} onClick={() => setLengthMode('range')}>Intervalle</button>
          <button type="button" className={'th-tab' + (lengthMode === 'auto' ? ' active' : '')} onClick={() => setLengthMode('auto')}>Auto</button>
        </div>
        {lengthMode === 'exact' && (
          <label className="th-field">
            <span>Nombre de lettres</span>
            <input type="number" min={1} max={100} value={lengthExact} onChange={(e) => setLengthExact(e.target.value)} />
          </label>
        )}
        {lengthMode === 'range' && (
          <div className="th-row2">
            <label className="th-field">
              <span>De</span>
              <input type="number" min={1} max={100} value={lengthMin} onChange={(e) => setLengthMin(e.target.value)} />
            </label>
            <label className="th-field">
              <span>À</span>
              <input type="number" min={1} max={100} value={lengthMax} onChange={(e) => setLengthMax(e.target.value)} />
            </label>
          </div>
        )}

        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>Finition</span>
        <div className="th-tabs">
          <button type="button" className={'th-tab' + (endingMode === 'auto' ? ' active' : '')} onClick={() => setEndingMode('auto')}>Automatique</button>
          {ENDINGS.map((e) => (
            <button key={e} type="button" className={'th-tab' + (endingMode === 'specific' && endingSelected === e ? ' active' : '')}
              onClick={() => { setEndingMode('specific'); setEndingSelected(e); }}>
              {e}
            </button>
          ))}
        </div>

        <label className="th-field">
          <span>Type de lettres</span>
          <select value={classification} onChange={(e) => setClassification(e.target.value as Classification)}>
            <option value="mixed">Mixte (toutes les lettres)</option>
            <option value="luminousOnly">Lumineuses uniquement</option>
            <option value="nonLuminousOnly">Non lumineuses uniquement</option>
          </select>
        </label>

        <label className="th-checkbox-field">
          <input type="checkbox" checked={allowRepeats} onChange={(e) => setAllowRepeats(e.target.checked)} />
          <span>Autoriser la répétition des lettres dans la racine</span>
        </label>

        <button type="button" className="th-generate-btn" onClick={onGenerate} disabled={!canSubmit}>
          {busy ? 'Recherche…' : 'GÉNÉRER'}
        </button>
        {error && <p className="th-error">{error}</p>}

        {output && (
          <>
            <div className="th-summary">
              Poids cible : <strong>{output.targetWeight}</strong> · {output.totalResults} résultat{output.totalResults > 1 ? 's' : ''}
              {output.truncated && ' (plafond atteint — affinez les critères pour une liste plus précise)'}
            </div>

            {output.totalResults === 0 ? (
              <div className="th-empty">
                Aucun résultat exact trouvé.
                <ul>
                  <li>augmenter ou élargir le nombre de lettres ;</li>
                  <li>activer la finition automatique ;</li>
                  <li>autoriser la répétition des lettres ;</li>
                  <li>passer la classification en « Mixte ».</li>
                </ul>
              </div>
            ) : grouped ? (
              grouped.map(([len, results]) => (
                <div key={len} className="th-length-group">
                  <div className="th-length-title">{len} lettres</div>
                  <div className="th-cards">
                    {(results as any[]).map((r, i) => <ResultCard key={i} r={r} />)}
                  </div>
                </div>
              ))
            ) : (
              <div className="th-cards" style={{ marginTop: 16 }}>
                {output.results.map((r: any, i: number) => <ResultCard key={i} r={r} />)}
              </div>
            )}
          </>
        )}

        <p className="th-disclaimer">
          ⚠️ Ce générateur formalise un référentiel traditionnel/ésotérique : les « poids » sont traités comme des
          valeurs numériques symboliques, ce module ne constitue pas une preuve d’efficacité surnaturelle.
        </p>
      </div>
    </div>
  );
}
