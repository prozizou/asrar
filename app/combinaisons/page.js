'use client';
// Module « Combinaisons » — port de combinaisons/combinaisons.html.
// Recherche des combinaisons de N noms d'Allah dont la somme des poids Abjad
// vaut une cible. L'algorithme (backtracking + élagage) vit dans
// lib/combinaisons.js ; ici, l'UI React : formulaire, progression, arrêt,
// filtre, pagination, calculatrice, tableau des noms et restauration.
import './combinaisons.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAccess } from '@/components/AccessProvider';
import {
  NAMES,
  NAMES_SORTED,
  NUM_NAMES,
  abjadWeight,
  countCombinations,
  hasAllah,
  describeCombo,
  resultSearchText,
  searchCombinations,
} from '@/lib/combinaisons';

const PAGE_SIZE = 50;
const K_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const STORE_KEY = 'asrar_last_search';

export default function CombinaisonsPage() {
  const { ensureAccess } = useAccess();

  const [target, setTarget] = useState('');
  const [k, setK] = useState(3);
  const [calcInput, setCalcInput] = useState('');

  const [isSearching, setIsSearching] = useState(false);
  const stopRef = useRef(false);
  const [progress, setProgress] = useState(null); // { pct, found, pruned }
  const [outcome, setOutcome] = useState(null); // résultats finalisés
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const [banner, setBanner] = useState(null); // recherche sauvegardée

  // Restauration : bannière si une recherche précédente est en cache.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setBanner(JSON.parse(raw));
    } catch {
      /* données corrompues — ignorer */
    }
  }, []);

  const calcWeight = useMemo(() => abjadWeight(calcInput), [calcInput]);

  const results = outcome ? outcome.results : [];
  // Tri : combinaisons contenant « الله » d'abord.
  const sortedResults = useMemo(
    () => [...results].sort((a, b) => (hasAllah(a) ? 0 : 1) - (hasAllah(b) ? 0 : 1)),
    [results]
  );
  const searchTexts = useMemo(() => sortedResults.map(resultSearchText), [sortedResults]);
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return sortedResults.map((_, i) => i);
    const out = [];
    for (let i = 0; i < searchTexts.length; i++) if (searchTexts[i].includes(q)) out.push(i);
    return out;
  }, [filter, sortedResults, searchTexts]);

  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, pages - 1));
  const start = safePage * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, filtered.length);
  const slice = filtered.slice(start, end);

  const runSearch = useCallback(async () => {
    // Deuxième clic pendant une recherche → demande d'arrêt.
    if (isSearching) {
      stopRef.current = true;
      return;
    }
    const t = parseInt(String(target).trim(), 10);
    if (!String(target).trim() || isNaN(t) || t < 1) {
      alert('Veuillez saisir un poids cible valide (nombre entier positif).');
      return;
    }

    setOutcome(null);
    setFilter('');
    setPage(0);
    stopRef.current = false;
    setIsSearching(true);
    setProgress({ pct: 0, found: 0, pruned: 0 });

    const t0 = performance.now();
    const { results: found, pruned, stopped } = await searchCombinations({
      target: t,
      k,
      shouldStop: () => stopRef.current,
      onProgress: (pct, foundCount, pr) => setProgress({ pct, found: foundCount, pruned: pr }),
    });
    const elapsed = ((performance.now() - t0) / 1000).toFixed(2);

    setIsSearching(false);
    setProgress({ pct: 100, found: found.length, pruned });

    if (!stopped && found.length > 0) {
      try {
        localStorage.setItem(
          STORE_KEY,
          JSON.stringify({ target: t, k, results: found, elapsed, date: new Date().toLocaleString('fr-FR') })
        );
      } catch {
        /* quota dépassé — ignorer */
      }
    }
    setOutcome({ results: found, elapsed, pruned, stopped, target: t, k, empty: found.length === 0 && !stopped });
  }, [isSearching, target, k]);

  const handleSearch = useCallback(async () => {
    // Paywall au clic : abonné → recherche ; sinon → portail d'abonnement.
    const ok = await ensureAccess();
    if (ok) runSearch();
  }, [ensureAccess, runSearch]);

  const clearAll = () => {
    setOutcome(null);
    setFilter('');
    setPage(0);
    setProgress(null);
    setTarget('');
    setBanner(null);
    try {
      localStorage.removeItem(STORE_KEY);
    } catch {}
  };

  const restore = () => {
    if (!banner) return;
    setTarget(String(banner.target));
    setK(K_OPTIONS.includes(banner.k) ? banner.k : 3);
    setFilter('');
    setPage(0);
    setProgress({ pct: 100, found: banner.results.length, pruned: 0 });
    setOutcome({
      results: banner.results,
      elapsed: banner.elapsed,
      pruned: 0,
      stopped: false,
      target: banner.target,
      k: banner.k,
      empty: false,
      restored: true,
    });
    setBanner(null);
  };

  const pickName = (w) => {
    setTarget(String(w));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const count = results.length;
  const showFilterBar = sortedResults.length > 10;

  return (
    <div className="cc-page">
      <div className="container" style={{ maxWidth: 900 }}>
        <Link href="/" className="back-btn">
          ← Retour
        </Link>

        <header>
          <div className="bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
          <h1>
            Les 99 Noms d'<span>Allah</span> Asrar Pro
          </h1>
          <p className="subtitle">Combinaisons par poids mystique · Calcul Abjad (حساب الجُمَّل)</p>
        </header>

        <main>
          {/* Bannière de restauration */}
          {banner && (
            <div className="restore-banner">
              <div className="rb-text">
                💾 Une recherche précédente a été trouvée :{' '}
                <strong>
                  poids {banner.target}, {banner.k} noms — {banner.results.length} résultat(s) — {banner.date}
                </strong>
              </div>
              <button className="rb-btn rb-btn-restore" onClick={restore}>
                Restaurer
              </button>
              <button className="rb-btn rb-btn-dismiss" onClick={() => setBanner(null)}>
                Ignorer
              </button>
            </div>
          )}

          {/* Recherche */}
          <div className="card">
            <div className="card-title">Recherche de combinaisons</div>
            <div className="form-grid">
              <div className="field">
                <label>Poids mystique cible</label>
                <input
                  type="number"
                  placeholder="ex. 644"
                  min="1"
                  max="999999"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <div className="field">
                <label>Nombre de noms à combiner</label>
                <select value={k} onChange={(e) => setK(parseInt(e.target.value, 10))}>
                  {K_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} noms
                    </option>
                  ))}
                </select>
                {k >= 8 && (
                  <div className="perf-warning">
                    ⚠️ <strong>Attention :</strong> k ≥ 8 implique des milliards de combinaisons théoriques (ex.
                    C(99,9) ≈ 1,7 Md). Le pruning reste efficace, mais préparez-vous à une exécution longue selon le
                    poids cible. Utilisez le bouton <em>Arrêter</em> si nécessaire.
                  </div>
                )}
              </div>
            </div>
            <div className="btn-row">
              <button className="btn-primary" onClick={handleSearch}>
                <span>{isSearching ? '⏹' : '🔍'}</span>
                <span>{isSearching ? 'Arrêter la recherche' : 'Rechercher'}</span>
              </button>
              <button className="btn-secondary" onClick={clearAll}>
                Effacer
              </button>
            </div>

            {(isSearching || progress) && (
              <div className="progress-wrap">
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: (progress ? progress.pct : 0) + '%' }} />
                </div>
                <div className="progress-meta">
                  <ProgressLabel isSearching={isSearching} progress={progress} outcome={outcome} />
                  <span className="stop-hint">
                    {isSearching
                      ? `~${countCombinations(NUM_NAMES, k).toLocaleString('fr-FR')} combinaisons théoriques`
                      : outcome?.restored
                      ? `Sauvegardé le ${banner?.date || ''}`
                      : 'Cliquez sur Arrêter pour interrompre'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Résultats */}
          {outcome && (outcome.empty || count > 0) && (
            <div className="card">
              <div className="results-bar">
                <div className="card-title" style={{ marginBottom: 0 }}>
                  Combinaisons trouvées
                </div>
                <span className="badge">{count === 1 ? '1 résultat' : `${count} résultats`}</span>
              </div>

              {outcome.empty ? (
                <div className="empty-state">
                  <div className="icon">🔎</div>
                  <p>
                    Aucune combinaison de <strong>{outcome.k} noms</strong> ne donne le poids{' '}
                    <strong>{outcome.target}</strong>.
                    <br />
                    Essayez un autre nombre de noms ou un autre poids cible.
                  </p>
                </div>
              ) : (
                <>
                  {showFilterBar && (
                    <div className="results-search-wrap">
                      <div className="search-icon-wrap">
                        <span className="search-icon">🔍</span>
                        <input
                          className="results-search-input"
                          type="text"
                          placeholder="Filtrer : nom arabe, transcription, poids…"
                          dir="auto"
                          value={filter}
                          onChange={(e) => {
                            setFilter(e.target.value);
                            setPage(0);
                          }}
                        />
                      </div>
                      {filter && (
                        <button className="results-search-clear" onClick={() => setFilter('')} title="Effacer le filtre">
                          ✕
                        </button>
                      )}
                      <span className="filter-count">
                        {filter
                          ? filtered.length === 0
                            ? 'Aucun résultat'
                            : `${filtered.length} résultat${filtered.length > 1 ? 's' : ''}`
                          : ''}
                      </span>
                    </div>
                  )}

                  <div className="results-list">
                    {slice.map((idx) => (
                      <ResultCard key={idx} indices={sortedResults[idx]} />
                    ))}
                  </div>

                  <Pagination pages={pages} page={safePage} onGo={setPage} start={start} end={end} total={filtered.length} />
                </>
              )}
            </div>
          )}

          {/* Calculatrice Abjad */}
          <div className="card">
            <div className="card-title">Calculatrice Abjad — poids d'un texte arabe</div>
            <div className="calc-row">
              <input
                className="calc-text"
                type="text"
                placeholder="Saisissez un texte en arabe…"
                value={calcInput}
                onChange={(e) => setCalcInput(e.target.value)}
              />
              <div className="calc-display">{calcWeight > 0 ? calcWeight : '—'}</div>
            </div>
            <p className="calc-note">
              Le poids est calculé selon le système Abjad (حساب الجُمَّل الكبير). Cliquez sur un nom dans le tableau
              ci-dessous pour l'utiliser comme cible.
            </p>
          </div>

          {/* Tableau des noms */}
          <div className="card">
            <details>
              <summary>Tableau des 99 Noms et leurs poids Abjad</summary>
              <div className="names-grid">
                {NAMES.map((nm, i) => (
                  <div className="name-chip" key={i} onClick={() => pickName(nm.weight)} title={nm.fr}>
                    <span className="nc-ar">{nm.display}</span>
                    <div className="nc-info">
                      <div className="nc-weight">{nm.weight}</div>
                      <div className="nc-fr">{nm.fr.split('—')[0].trim()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </main>

        <footer>
          Les 99 Noms d'Allah · Poids Abjad (حساب الجُمَّل الكبير) · Application éducative et spirituelle
        </footer>
      </div>
    </div>
  );
}

function ProgressLabel({ isSearching, progress, outcome }) {
  if (isSearching) {
    const p = progress || { pct: 0, found: 0, pruned: 0 };
    return (
      <span>
        Vérification… {p.pct}% — {p.found} combinaison(s) trouvée(s) · {p.pruned.toLocaleString('fr-FR')} branches
        élaguées
      </span>
    );
  }
  if (!outcome) return <span>Recherche en cours…</span>;
  if (outcome.restored) {
    return (
      <span>
        Résultats restaurés — {outcome.results.length} combinaison(s) pour le poids {outcome.target}{' '}
        <span className="speed-badge">💾 Restauré</span>
      </span>
    );
  }
  const badge = (
    <span className="speed-badge">
      ⚡ {outcome.elapsed}s · {outcome.pruned.toLocaleString('fr-FR')} branches élaguées
    </span>
  );
  if (outcome.stopped) {
    return (
      <span>
        Recherche interrompue — {outcome.results.length} résultat(s) partiel(s) {badge}
      </span>
    );
  }
  return (
    <span>
      Terminé — {outcome.results.length} combinaison(s) pour le poids {outcome.target} {badge}
    </span>
  );
}

function ResultCard({ indices }) {
  const { names, formula, isAllah } = describeCombo(indices);
  return (
    <div className={'result-card' + (isAllah ? ' has-allah' : '')}>
      <div className="rc-arabic">
        {names.map((nn) => nn.display).join('  +  ')}
        {isAllah && <span className="rc-allah-badge">★ الله</span>}
      </div>
      <div>
        <span className="rc-formula">{formula}</span>
      </div>
      <div className="rc-defs">
        {names.map((nn, i) => (
          <span key={i}>
            <b>{nn.display}</b> — {nn.fr}
            {i < names.length - 1 && <br />}
          </span>
        ))}
      </div>
    </div>
  );
}

function Pagination({ pages, page, onGo, start, end, total }) {
  if (pages <= 1) return null;
  const nums = [...new Set([0, pages - 1, page - 1, page, page + 1].filter((p) => p >= 0 && p < pages))].sort(
    (a, b) => a - b
  );
  const items = [];
  let prev = -1;
  for (const p of nums) {
    if (prev >= 0 && p - prev > 1) items.push(<span className="page-info" key={'e' + p}>…</span>);
    items.push(
      <button className={'page-btn' + (p === page ? ' active' : '')} key={p} onClick={() => onGo(p)}>
        {p + 1}
      </button>
    );
    prev = p;
  }
  return (
    <div className="pagination-wrap">
      <button className="page-btn" onClick={() => onGo(page - 1)} disabled={page === 0}>
        ‹
      </button>
      {items}
      <button className="page-btn" onClick={() => onGo(page + 1)} disabled={page >= pages - 1}>
        ›
      </button>
      <span className="page-info">
        {start + 1}–{end} / {total}
      </span>
    </div>
  );
}
