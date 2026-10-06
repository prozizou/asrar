'use client';
// Module « Géomancie (Tourab) » — port de geomancie/tourab.html.
// Saisie des 4 Mères (lignes à 1 ou 2 points) → calcul de l'écu (16 Maisons),
// figures binaires, بزدح, parité du Juge, synthèse (vœu / repérage) et modale
// d'interprétation par maison. La logique vit dans lib/geomancie.js ; ici l'UI
// React et les données premium (via /api/get-theme, réservées au forfait 1 An —
// PREMIUM_LEVEL — vérifié côté client (ensureAccess) ET côté serveur (get-theme)).
//
// TypeScript (batch 5/7, cf. tsconfig.json) : lib/geomancie.js reste en .js
// (hors scope de ce batch) — ses valeurs de retour (mères, maisons, figures)
// restent typées `any`/`number[][]` en local plutôt que reproduites en
// interfaces (forme interne complexe, propre à ce module), même principe que
// lib/rouwhania.js dans le batch précédent (#120). useAccess()/Spinner.js
// suivent le même traitement (cast) que dans les batches précédents (#114,
// #116, #118, #120).
import './geomancie.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { apiPost } from '@/lib/api';
import { useAccess } from '@/components/AccessProvider';
import { useHistoryClose } from '@/components/useHistoryClose';
import SpinnerUntyped from '@/components/Spinner';
import { PREMIUM_LEVEL } from '@/lib/access';
import {
  generateAllHouses,
  checkJudgeParity,
  synthesis,
  getCleanName,
  figToKey,
  getBZDHValue,
  houseModalData,
  randomMothers,
  neutralMothers,
} from '@/lib/geomancie';

const Spinner = SpinnerUntyped as any;

type Figure = number[]; // 4 lignes, chacune à 1 ou 2 points
type Mothers = Figure[]; // les 4 Mères

// Écu sur une grille de 16 colonnes : chaque maison occupe 2 colonnes (même
// largeur partout). `col` = colonne de départ, `row` = ligne ; `drop` décale la
// maison vers le bas (décalage vertical du modèle). Index = numéro de maison - 1.
const SHIELD_LAYOUT: { idx: number; col: number; row: number; drop?: boolean }[] = [
  // Ligne 1 : M8 → M1
  ...[7, 6, 5, 4, 3, 2, 1, 0].map((idx, i) => ({ idx, col: 1 + i * 2, row: 1 })),
  // Ligne 2 : M12 → M9, chacune centrée sous deux maisons de la ligne 1
  ...[11, 10, 9, 8].map((idx, i) => ({ idx, col: 2 + i * 4, row: 2 })),
  // Ligne 3 : M14 à gauche, M13 à droite
  { idx: 13, col: 4, row: 3 },
  { idx: 12, col: 12, row: 3 },
  // Ligne 4 : M15 centre-gauche, M16 à droite et plus bas
  { idx: 14, col: 6, row: 4 },
  { idx: 15, col: 11, row: 4, drop: true },
];

function MiniFigure({ fig }: { fig: Figure }) {
  return (
    <div className="mini-figure">
      {fig.map((count, r) => (
        <div className="mini-row" key={r}>
          {Array.from({ length: count }).map((_, d) => (
            <span className="mini-dot" key={d} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function GeomanciePage() {
  // useAccess() vient d'AccessProvider.js (.js, hors scope de ce batch) :
  // son contexte est créé via createContext(null), donc TS l'infère `null`
  // sans cast — la vraie forme documentée ici en local.
  const { ensureAccess, openGate } = useAccess() as unknown as {
    ensureAccess: (minLevel?: number) => Promise<boolean>;
    openGate: (reason?: string | null) => void;
  };

  const [mothers, setMothers] = useState<Mothers>(neutralMothers);
  const [calculated, setCalculated] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [fbData, setFbData] = useState<any[]>([]);
  const [activeFig, setActiveFig] = useState<string | null>(null);
  const [view, setView] = useState<'mothers' | 'ecu'>('mothers');
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const houses = useMemo<any[]>(() => generateAllHouses(mothers), [mothers]);
  const backToMothers = useCallback(() => {
    setView('mothers');
    setCalculated(false);
    setActiveFig(null);
    setModalIndex(null);
  }, []);
  const goBackToMothers = useHistoryClose(view === 'ecu', backToMothers);

  const synth = calculated ? synthesis(houses) : null;
  const parity = calculated ? checkJudgeParity(houses) : null;

  const showToast = useCallback((msg: string) => {
    setToast({ id: Date.now(), msg });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  // Échap ferme la modale.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalIndex(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const toggleMotherRow = (mi: number, ri: number) => {
    setMothers((prev) => {
      const next = prev.map((row) => [...row]);
      next[mi][ri] = next[mi][ri] === 1 ? 2 : 1;
      return next;
    });
    setActiveFig(null); // clearPassation
  };

  const fetchFirebaseData = useCallback(async () => {
    try {
      const res = await apiPost('get-theme');
      setFbData(res.data || []);
      showToast('Données chargées');
      return res.data || [];
    } catch (error: any) {
      if (error && error.status === 403) {
        showToast('Géomancie réservée au forfait 1 An (45 000 FCFA).');
        openGate('level');
      } else {
        showToast('Échec du chargement (' + (error.message || 'erreur') + ')');
      }
      return null;
    }
  }, [showToast, openGate]);

  const onCalculate = async () => {
    const ok = await ensureAccess(PREMIUM_LEVEL);
    if (!ok) return;
    setCalculating(true);
    try {
      if (!fbData || fbData.length === 0) await fetchFirebaseData();
      setCalculated(true);
      setActiveFig(null);
      setView('ecu');
    } finally {
      setCalculating(false);
    }
  };

  const onRandom = () => {
    setMothers(randomMothers());
    setCalculated(false);
    setActiveFig(null);
  };

  const onReset = () => {
    setMothers(neutralMothers());
    setCalculated(false);
    setActiveFig(null);
    showToast('Thème réinitialisé');
  };

  const openHouseModal = (idx: number) => {
    if (!calculated) return;
    setActiveFig(figToKey(houses[idx]));
    setModalIndex(idx);
  };

  const closeModal = () => {
    setModalIndex(null);
    setActiveFig(null);
  };

  const highlightFigure = (figKey: string) => {
    const count = houses.filter((h) => figToKey(h) === figKey).length;
    const name = getCleanName(figKey, fbData);
    if (count > 0) {
      setActiveFig(figKey);
      showToast(`${name} présente dans ${count} maison(s)`);
    } else {
      setActiveFig(null);
      showToast(`${name} absente de l'écu`);
    }
  };

  const onEcu = view === 'ecu' && calculated;

  return (
    <div className="geo-page">
      <div className="app-container">
        {onEcu ? (
          <button type="button" className="geo-back" onClick={goBackToMothers}>
            ← Les 4 Mères
          </button>
        ) : (
          <Link href="/" className="geo-back">
            ← Retour
          </Link>
        )}

        <header className="header">
          <span className="eyebrow">Asrar Pro · Géomancie</span>
          <h1>{onEcu ? 'Écu Géomantique' : 'Les 4 Mères'}</h1>
        </header>

        {!onEcu && (
          <div className="panel">
            <div className="mothers-grid">
              {mothers.map((fig, mi) => (
                <div className="mother-card" key={mi}>
                  <div className="mother-label">Mère {mi + 1}</div>
                  <div className="figure-display">
                    {fig.map((count, ri) => (
                      <div
                        className={'dot-row' + (count === 2 ? ' double-row' : '')}
                        key={ri}
                        onClick={() => toggleMotherRow(mi, ri)}
                      >
                        {Array.from({ length: count }).map((_, d) => (
                          <span className="dot" key={d} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="btn-row">
              <button className="btn primary" onClick={onCalculate} disabled={calculating}>
                {calculating ? (
                  <>
                    <Spinner /> Calcul…
                  </>
                ) : (
                  "Calculer l'Écu"
                )}
              </button>
              <button className="btn" onClick={onRandom}>
                Aléatoire
              </button>
              <button className="btn" onClick={onReset}>
                Réinitialiser
              </button>
            </div>
          </div>
        )}

        {onEcu && (
          <div className="panel">
            <div className="shield-grid">
              {SHIELD_LAYOUT.map(({ idx, col, row, drop }) => (
                <HouseCell
                  key={idx}
                  idx={idx}
                  fig={houses[idx]}
                  fbData={fbData}
                  active={activeFig != null && figToKey(houses[idx]) === activeFig}
                  onOpen={openHouseModal}
                  style={{ gridColumn: `${col} / span 2`, gridRow: row, marginTop: drop ? 'var(--drop)' : undefined }}
                />
              ))}
            </div>

            {parity && (
              <div className="parity-wrap">
                {parity.even ? (
                  <span className="parity-badge ok">Parité du Juge : {parity.total} points (paire)</span>
                ) : (
                  <span className="parity-badge warn">Anomalie de parité détectée</span>
                )}
              </div>
            )}

            {synth && (
              <div className="synthesis-container">
                <div className="synthesis-card" onClick={() => highlightFigure(synth.voeuKey)}>
                  <h4>Le vœu</h4>
                  <MiniFigure fig={synth.voeuFig} />
                  <p>{getCleanName(synth.voeuKey, fbData)}</p>
                </div>
                <div className="synthesis-card" onClick={() => highlightFigure(synth.repKey)}>
                  <h4>Figure de Repérage</h4>
                  <MiniFigure fig={synth.repFig} />
                  <p>{getCleanName(synth.repKey, fbData)}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {modalIndex != null && (
        <HouseModal data={houseModalData(modalIndex, houses, fbData)} onClose={closeModal} />
      )}

      {toast && <div className="geo-toast">{toast.msg}</div>}
    </div>
  );
}

function HouseCell({ idx, fig, fbData, active, onOpen, style }: { idx: number; fig: Figure; fbData: any[]; active: boolean; onOpen: (idx: number) => void; style?: React.CSSProperties }) {
  const cls =
    'house-cell' +
    (idx === 14 ? ' judge-cell' : '') +
    (idx === 15 ? ' sentence-cell' : '') +
    (active ? ' voie-active' : '');
  return (
    <div className={cls} style={style} onClick={() => onOpen(idx)}>
      <div className="house-num">M{idx + 1}</div>
      <MiniFigure fig={fig} />
      <div className="fig-name">{getCleanName(figToKey(fig), fbData)}</div>
      <div className="bzdh-badge">ord: {getBZDHValue(fig)}</div>
    </div>
  );
}

function ModalBlock({ tone, title, domaine, interpretation, prefix }: { tone: 'blue' | 'gold'; title: string; domaine: string; interpretation: string; prefix: string }) {
  return (
    <div className={'modal-block ' + tone}>
      <h4 style={{ color: tone === 'blue' ? '#4facfe' : 'var(--gold)' }}>{title}</h4>
      <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: 'var(--gold)' }}>
        <strong>Domaine :</strong> {domaine}
      </p>
      <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.5 }}>
        {prefix ? prefix + ' ' : ''}{interpretation}
      </p>
    </div>
  );
}

function HouseModal({ data, onClose }: { data: any; onClose: () => void }) {
  const stop = (e: React.MouseEvent) => e.target === e.currentTarget && onClose();
  return (
    <div className="geo-modal-overlay" onClick={stop}>
      <div className="geo-modal">
        <button className="close-btn" onClick={onClose}>
          ×
        </button>
        <h3>
          Maison {data.houseIndex + 1} – {data.houseName}
        </h3>
        <p style={{ color: 'var(--text2)', fontSize: '0.85rem', marginBottom: 6 }}>
          <strong>Occupante :</strong> {data.title} | <span style={{ color: '#4facfe' }}>بزدح: {data.bzdh}</span>
        </p>

        {data.kind === 'judge' && (
          <>
            <div className="copulation-steps">
              <div className="step-fig" style={{ border: '2px solid var(--gold)' }}>
                <strong>Verdict</strong>
                <br />
                <MiniFigure fig={data.houseFig} />
                <small style={{ color: 'var(--gold)', fontWeight: 700 }}>{data.cleanName}</small>
              </div>
            </div>
            <ModalBlock
              tone="gold"
              title="Interprétation du Juge"
              domaine={data.data ? data.data.domaine : 'Le verdict final.'}
              interpretation={data.data ? data.data.interpretation : 'Données en cours de chargement...'}
              prefix=""
            />
          </>
        )}

        {data.kind === 'sentence' && (
          <>
            <div className="copulation-steps">
              <div className="step-fig">
                <strong>Juge</strong>
                <br />
                <MiniFigure fig={data.judgeFig} />
              </div>
              <span style={{ fontSize: '1.3rem', color: 'var(--gold)' }}>+</span>
              <div className="step-fig">
                <strong>M1 (Âme)</strong>
                <br />
                <MiniFigure fig={data.m1Fig} />
                <small>{data.m1Name}</small>
              </div>
              <span style={{ fontSize: '1.3rem', color: 'var(--gold)' }}>=</span>
              <div className="step-fig" style={{ border: '2px solid var(--gold)' }}>
                <strong>Sentence</strong>
                <br />
                <MiniFigure fig={data.houseFig} />
                <small style={{ color: 'var(--gold)', fontWeight: 700 }}>{data.cleanName}</small>
              </div>
            </div>
            <ModalBlock
              tone="gold"
              title="Interprétation de la Sentence"
              domaine={data.data ? data.data.domaine : 'Le point de chute final.'}
              interpretation={data.data ? data.data.interpretation : 'Données en cours de chargement...'}
              prefix=""
            />
          </>
        )}

        {data.kind === 'normal' && (
          <>
            <ModalBlock
              tone="blue"
              title={`Étape 1 : ${data.step1Data ? data.step1Data.titre : data.step1Title}`}
              domaine={data.step1Data ? data.step1Data.domaine : 'Parole de la Maison (Occupante + Repos)'}
              interpretation={data.step1Data ? data.step1Data.interpretation : 'En attente des données Firebase...'}
              prefix="Interprétation :"
            />
            <ModalBlock
              tone="gold"
              title={`Secret final : ${data.step2Data ? data.step2Data.titre : data.step2Title}`}
              domaine={data.step2Data ? data.step2Data.domaine : 'Décret du Juge (Parole + Juge)'}
              interpretation={data.step2Data ? data.step2Data.interpretation : 'En attente des données Firebase...'}
              prefix="Interprétation :"
            />
          </>
        )}
      </div>
    </div>
  );
}
