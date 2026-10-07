'use client';
// Module « Géomancie (Tourab) » — port de geomancie/tourab.html.
// Écran 1 : étapes de dérivation, saisie des 4 Mères, historique local des écus.
// Écran 2 : organigramme M1–M16 (flèches de dérivation), parité, vœu, repérage,
// export PDF / partage. Calcul de l'écu (16 Maisons),
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
import { SHIELD_LAYOUT, SHIELD_EDGES, STEPS, edgePoints } from '@/lib/geomancieLayout';
import { addHistoryEntry, clearHistory, loadHistory, removeHistoryEntry } from '@/lib/geomancieHistory';
import { buildEcuPdf, ecuShareText } from '@/lib/geomancieExport';

const Spinner = SpinnerUntyped as any;

type Figure = number[]; // 4 lignes, chacune à 1 ou 2 points
type Mothers = Figure[]; // les 4 Mères
type HistoryEntry = { id: string; at: number; mothers: Mothers; judge: string; even: boolean };

const STAGE_MS = 130; // durée d'une étape de l'animation de calcul

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

function Stepper({ stage }: { stage: number }) {
  return (
    <ol className="stepper" aria-label="Étapes de dérivation">
      {STEPS.map((s, i) => {
        const state = stage > i ? 'done' : stage === i ? 'current' : 'todo';
        return (
          <li className={'step ' + state} key={s.key} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="step-dot">{state === 'done' ? '✓' : i + 1}</span>
            <span className="step-label">{s.label}</span>
            <span className="step-range">{s.range}</span>
          </li>
        );
      })}
    </ol>
  );
}

function formatWhen(at: number) {
  return new Date(at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
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
  const [stage, setStage] = useState(0); // 0 = saisie ; 1..4 = étapes dérivées pendant le calcul
  const [fbData, setFbData] = useState<any[]>([]);
  const [activeFig, setActiveFig] = useState<string | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [view, setView] = useState<'home' | 'ecu'>('home');
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [busy, setBusy] = useState<'pdf' | 'share' | null>(null);
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Historique local : lu après le premier rendu (localStorage indisponible en SSR).
  useEffect(() => {
    setHistory(loadHistory() as HistoryEntry[]);
  }, []);

  const houses = useMemo<any[]>(() => generateAllHouses(mothers), [mothers]);
  const backToHome = useCallback(() => {
    setView('home');
    setCalculated(false);
    setStage(0);
    setActiveFig(null);
    setHoverIdx(null);
    setModalIndex(null);
  }, []);
  const goBackHome = useHistoryClose(view === 'ecu', backToHome);

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

  // Calcule l'écu de `m` (les Mères saisies par défaut, ou celles d'une entrée
  // d'historique), joue les 4 étapes puis ouvre l'écran 2.
  const onCalculate = async (m: Mothers = mothers) => {
    if (calculating) return;
    const ok = await ensureAccess(PREMIUM_LEVEL);
    if (!ok) return;
    setCalculating(true);
    try {
      let data = fbData;
      if (!data || data.length === 0) data = (await fetchFirebaseData()) || [];
      setMothers(m);
      if (reducedMotion()) {
        setStage(4);
      } else {
        for (let s = 1; s <= 4; s++) {
          setStage(s);
          await sleep(STAGE_MS);
        }
      }
      const hs = generateAllHouses(m);
      const par = checkJudgeParity(hs);
      setHistory(
        addHistoryEntry({
          mothers: m,
          judge: data.length ? getCleanName(figToKey(hs[14]), data) : '',
          even: par.even,
        }) as HistoryEntry[]
      );
      setCalculated(true);
      setActiveFig(null);
      setView('ecu');
    } finally {
      setCalculating(false);
    }
  };

  const onRandom = () => {
    setMothers(randomMothers());
    setStage(0);
    setActiveFig(null);
  };

  const onReset = () => {
    setMothers(neutralMothers());
    setStage(0);
    setActiveFig(null);
    showToast('Thème réinitialisé');
  };

  const onNewCalculation = () => {
    setMothers(neutralMothers());
    goBackHome(); // revient à l'écran 1 (et dépile l'entrée d'historique du navigateur)
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

  const exportData = () => {
    const s = synthesis(houses);
    return {
      houses,
      names: houses.map((h) => getCleanName(figToKey(h), fbData)),
      parity: checkJudgeParity(houses),
      voeu: { fig: s.voeuFig, name: getCleanName(s.voeuKey, fbData) },
      rep: { fig: s.repFig, name: getCleanName(s.repKey, fbData) },
    };
  };

  const exportPdf = async () => {
    if (busy) return;
    setBusy('pdf');
    try {
      const { doc, filename } = await buildEcuPdf(exportData());
      doc.save(filename);
      showToast('PDF enregistré');
    } catch {
      showToast("L'export PDF a échoué");
    } finally {
      setBusy(null);
    }
  };

  // Partage : PDF en pièce jointe si le navigateur le permet, sinon résumé texte,
  // sinon copie dans le presse-papiers.
  const shareEcu = async () => {
    if (busy) return;
    setBusy('share');
    const data = exportData();
    const text = ecuShareText(data);
    const title = 'Écu géomantique — Asrar Pro';
    const nav: any = navigator;
    try {
      let file: File | null = null;
      try {
        const { blob, filename } = await buildEcuPdf(data);
        file = new File([blob], filename, { type: 'application/pdf' });
      } catch {
        file = null;
      }
      if (file && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title, text });
      } else if (nav.share) {
        await nav.share({ title, text });
      } else {
        await navigator.clipboard.writeText(text);
        showToast('Résumé copié');
      }
    } catch (e: any) {
      if (e && e.name === 'AbortError') return; // partage annulé par l'utilisateur
      showToast('Le partage a échoué');
    } finally {
      setBusy(null);
    }
  };

  const onEcu = view === 'ecu' && calculated;

  return (
    <div className={'geo-page' + (onEcu ? ' ecu-view' : '')}>
      <div className="app-container">
        {onEcu ? (
          <button type="button" className="geo-back" onClick={goBackHome}>
            ← Les 4 Mères
          </button>
        ) : (
          <Link href="/" className="geo-back">
            ← Retour
          </Link>
        )}

        <header className="header">
          <span className="eyebrow">Asrar Pro · Géomancie</span>
          <h1>{onEcu ? 'Écu géomantique' : 'Nouveau calcul'}</h1>
        </header>

        {!onEcu && (
          <>
            <section className="panel">
              <Stepper stage={stage} />
              <h2 className="panel-title">Les 4 Mères</h2>
              <p className="panel-hint">Touchez une ligne pour passer de 1 à 2 points.</p>
              <div className="mothers-grid">
                {/* Affichage de droite à gauche : M4 — M3 — M2 — M1 (même sens de lecture que l'écu) */}
                {[...mothers.keys()].reverse().map((mi) => {
                  const fig = mothers[mi];
                  return (
                    <div className="mother-card" key={mi}>
                      <div className="mother-label">Mère {mi + 1}</div>
                      <div className="figure-display">
                        {fig.map((count, ri) => (
                          <button
                            type="button"
                            className={'dot-row' + (count === 2 ? ' double-row' : '')}
                            key={ri}
                            aria-label={`Mère ${mi + 1}, ligne ${ri + 1} : ${count} point${count > 1 ? 's' : ''}`}
                            onClick={() => toggleMotherRow(mi, ri)}
                          >
                            {Array.from({ length: count }).map((_, d) => (
                              <span className="dot" key={d} />
                            ))}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="btn-row">
                <button className="btn primary" onClick={() => onCalculate()} disabled={calculating}>
                  {calculating ? (
                    <>
                      <Spinner /> Calcul…
                    </>
                  ) : (
                    "Calculer l'Écu"
                  )}
                </button>
                <button className="btn" onClick={onRandom} disabled={calculating}>
                  Aléatoire
                </button>
                <button className="btn" onClick={onReset} disabled={calculating}>
                  Réinitialiser
                </button>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2 className="panel-title">Historique des écus</h2>
                {history.length > 0 && (
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      setHistory(clearHistory() as HistoryEntry[]);
                      showToast('Historique effacé');
                    }}
                  >
                    Tout effacer
                  </button>
                )}
              </div>
              {history.length === 0 ? (
                <p className="panel-hint">Les écus calculés sur cet appareil apparaîtront ici.</p>
              ) : (
                <ul className="history-list">
                  {history.map((h) => (
                    <li className="history-item" key={h.id}>
                      <button
                        type="button"
                        className="history-open"
                        disabled={calculating}
                        onClick={() => onCalculate(h.mothers)}
                        aria-label={`Rouvrir l'écu du ${formatWhen(h.at)}`}
                      >
                        <span className="history-figs">
                          {[...h.mothers].reverse().map((m, i) => (
                            <MiniFigure fig={m} key={i} />
                          ))}
                        </span>
                        <span className="history-meta">
                          <span className="history-judge">{h.judge ? `Juge : ${h.judge}` : 'Écu'}</span>
                          <span className="history-when">
                            {formatWhen(h.at)} · {h.even ? 'parité paire' : 'anomalie de parité'}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="history-del"
                        aria-label="Supprimer cet écu de l'historique"
                        onClick={() => setHistory(removeHistoryEntry(h.id) as HistoryEntry[])}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {onEcu && (
          <section className="panel ecu-panel">
            <EcuChart
              houses={houses}
              fbData={fbData}
              activeFig={activeFig}
              hoverIdx={hoverIdx}
              onHover={setHoverIdx}
              onOpen={openHouseModal}
            />

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
                <button type="button" className="synthesis-card" onClick={() => highlightFigure(synth.voeuKey)}>
                  <h4>Le vœu</h4>
                  <MiniFigure fig={synth.voeuFig} />
                  <p>{getCleanName(synth.voeuKey, fbData)}</p>
                </button>
                <button type="button" className="synthesis-card" onClick={() => highlightFigure(synth.repKey)}>
                  <h4>Figure de Repérage</h4>
                  <MiniFigure fig={synth.repFig} />
                  <p>{getCleanName(synth.repKey, fbData)}</p>
                </button>
              </div>
            )}

            <div className="actions-row">
              <button className="btn primary" onClick={exportPdf} disabled={!!busy}>
                {busy === 'pdf' ? <Spinner /> : null} Export PDF
              </button>
              <button className="btn" onClick={shareEcu} disabled={!!busy}>
                {busy === 'share' ? <Spinner /> : null} Partager
              </button>
              <button className="btn" onClick={onNewCalculation} disabled={!!busy}>
                Nouveau calcul
              </button>
            </div>
          </section>
        )}
      </div>

      {modalIndex != null && (
        <HouseModal data={houseModalData(modalIndex, houses, fbData)} onClose={closeModal} />
      )}

      {toast && <div className="geo-toast">{toast.msg}</div>}
    </div>
  );
}

function EcuChart({
  houses,
  fbData,
  activeFig,
  hoverIdx,
  onHover,
  onOpen,
}: {
  houses: any[];
  fbData: any[];
  activeFig: string | null;
  hoverIdx: number | null;
  onHover: (idx: number | null) => void;
  onOpen: (idx: number) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [paths, setPaths] = useState<{ d: string; from: number; to: number }[]>([]);

  // Les flèches sont tracées d'après la position réelle des cases (mesurées dans
  // le DOM) : exactes à toute largeur, recalculées au redimensionnement. Les
  // animations d'entrée n'utilisent que l'opacité, pour ne pas fausser la mesure.
  const measure = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const g = grid.getBoundingClientRect();
    const boxes: Record<number, { l: number; r: number; t: number; b: number }> = {};
    for (let i = 0; i < 16; i++) {
      const el = cellRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      boxes[i] = { l: r.left - g.left, r: r.right - g.left, t: r.top - g.top, b: r.bottom - g.top };
    }
    const out: { d: string; from: number; to: number }[] = [];
    for (const [from, to] of SHIELD_EDGES as [number, number][]) {
      const pts = edgePoints(from, to, boxes, 8);
      if (!pts) continue;
      out.push({ d: pts.map(([x, y]: number[], i: number) => `${i ? 'L' : 'M'}${x},${y}`).join(' '), from, to });
    }
    setPaths(out);
  }, []);

  useEffect(() => {
    measure();
    const grid = gridRef.current;
    if (!grid || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(grid);
    return () => ro.disconnect();
  }, [measure, houses]);

  return (
    <div className="shield-grid" ref={gridRef}>
      <svg className="shield-arrows" aria-hidden="true">
        <defs>
          <marker id="geo-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0.5 L7,4 L0,7.5 Z" className="shield-arrowhead" />
          </marker>
        </defs>
        {paths.map((p, i) => (
          <path
            key={i}
            d={p.d}
            className={
              'shield-arrow' +
              (hoverIdx != null ? (p.from === hoverIdx || p.to === hoverIdx ? ' on' : ' dim') : '')
            }
            markerEnd="url(#geo-arrow)"
          />
        ))}
      </svg>
      {SHIELD_LAYOUT.map(({ idx, col, row }: { idx: number; col: number; row: number }) => (
        <HouseCell
          key={idx}
          idx={idx}
          fig={houses[idx]}
          fbData={fbData}
          active={activeFig != null && figToKey(houses[idx]) === activeFig}
          onOpen={onOpen}
          onHover={onHover}
          innerRef={(el) => {
            cellRefs.current[idx] = el;
          }}
          style={{ gridColumn: `${col} / span 2`, gridRow: row, ['--row' as any]: row }}
        />
      ))}
    </div>
  );
}

function HouseCell({ idx, fig, fbData, active, onOpen, onHover, style, innerRef }: { idx: number; fig: Figure; fbData: any[]; active: boolean; onOpen: (idx: number) => void; onHover?: (idx: number | null) => void; style?: React.CSSProperties; innerRef?: (el: HTMLDivElement | null) => void }) {
  const cls =
    'house-cell' +
    (idx === 14 ? ' judge-cell' : '') +
    (idx === 15 ? ' sentence-cell' : '') +
    (active ? ' voie-active' : '');
  return (
    <div
      className={cls}
      style={style}
      ref={innerRef}
      role="button"
      tabIndex={0}
      aria-label={`Maison ${idx + 1}`}
      onClick={() => onOpen(idx)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(idx);
        }
      }}
      onPointerEnter={(e) => e.pointerType === 'mouse' && onHover?.(idx)}
      onPointerLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(idx)}
      onBlur={() => onHover?.(null)}
    >
      <div className="house-num">M{idx + 1}</div>
      <MiniFigure fig={fig} />
      <div className="fig-name" title={getCleanName(figToKey(fig), fbData)}>{getCleanName(figToKey(fig), fbData)}</div>
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
