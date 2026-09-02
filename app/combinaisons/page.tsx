'use client';
// Module « Combinaisons » — port de combinaisons/combinaisons.html.
// Recherche des combinaisons de N noms d'Allah dont la somme des poids Abjad
// vaut une cible. L'algorithme (backtracking + élagage) vit dans
// lib/combinaisons.js ; ici, l'UI React : formulaire, progression, arrêt,
// filtre, pagination, calculatrice, tableau des noms et restauration.
//
// TypeScript (batch 6/7, cf. tsconfig.json) : Outcome/Progress/Banner sont
// des types locaux pour l'état React de cette page — lib/combinaisons.js
// reste en .js (hors scope de ce batch) : les combinaisons/noms restent
// typés `any`/`number[]` en local plutôt que reproduits en interfaces
// (forme interne propre à ce module), même principe que dans les batches
// précédents (#120, #122). useAccess() suit le même traitement (cast) que
// dans les batches précédents.
import './combinaisons.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAccess } from '@/components/AccessProvider';
import {
  NAMES,
  NUM_NAMES,
  abjadWeight,
  countCombinations,
  hasAllah,
  describeCombo,
  resultSearchText,
  searchCombinations,
  splitFr,
} from '@/lib/combinaisons';

// Résultats par page (revue design, point 8) : 20 par défaut au lieu de 50
// fixe — 50 restait choisissable, pas retiré, juste plus rarement le
// premier choix vu depuis mobile.
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_PAGE_SIZE = 20;
const K_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const STORE_KEY = 'asrar_last_search';

type Combo = number[]; // indices dans NAMES_SORTED

// Fiche de nom (revue design, point 9) — voir ResultCard/onNameClick.
interface NameSheetData {
  display: string;
  translit: string;
  desc: string;
  weight: number;
}

interface Outcome {
  results: Combo[];
  elapsed: string | number;
  pruned: number;
  stopped: boolean;
  target: number;
  k: number;
  empty: boolean;
  restored?: boolean;
}

interface Progress {
  pct: number;
  found: number;
  pruned: number;
}

interface Banner {
  target: number;
  k: number;
  results: Combo[];
  elapsed: string | number;
  date: string;
}

export default function CombinaisonsPage() {
  // useAccess() vient d'AccessProvider.js (.js, hors scope de ce batch) :
  // son contexte est créé via createContext(null), donc TS l'infère `null`
  // sans cast — la vraie forme documentée ici en local.
  const { ensureAccess } = useAccess() as unknown as {
    ensureAccess: (minLevel?: number) => Promise<boolean>;
  };

  const [target, setTarget] = useState('');
  const [k, setK] = useState(3);
  const [calcInput, setCalcInput] = useState('');

  const [isSearching, setIsSearching] = useState(false);
  const stopRef = useRef(false);
  const [progress, setProgress] = useState<Progress | null>(null); // { pct, found, pruned }
  const [outcome, setOutcome] = useState<Outcome | null>(null); // résultats finalisés
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [banner, setBanner] = useState<Banner | null>(null); // recherche sauvegardée
  // Fiche de nom (revue design, point 9) : nom touché dans une carte de
  // résultat — null = fermée. Réutilise pickName() pour « Utiliser comme
  // cible » (même geste que le tableau des 99 noms plus bas sur la page).
  const [nameSheet, setNameSheet] = useState<NameSheetData | null>(null);

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

  const results = useMemo(() => (outcome ? outcome.results : []), [outcome]);
  // Tri : combinaisons contenant « الله » d'abord.
  const sortedResults = useMemo(
    () => [...results].sort((a, b) => (hasAllah(a) ? 0 : 1) - (hasAllah(b) ? 0 : 1)),
    [results]
  );
  const searchTexts = useMemo(() => sortedResults.map(resultSearchText), [sortedResults]);
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return sortedResults.map((_, i) => i);
    const out: number[] = [];
    for (let i = 0; i < searchTexts.length; i++) if (searchTexts[i].includes(q)) out.push(i);
    return out;
  }, [filter, sortedResults, searchTexts]);

  const pages = Math.ceil(filtered.length / pageSize);
  const safePage = Math.min(page, Math.max(0, pages - 1));
  const start = safePage * pageSize;
  const end = Math.min(start + pageSize, filtered.length);
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
      onProgress: (pct: number, foundCount: number, pr: number) => setProgress({ pct, found: foundCount, pruned: pr }),
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

  const pickName = (w: number) => {
    setTarget(String(w));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // « Utiliser {poids} comme cible » depuis la fiche de nom (revue design,
  // point 9) — même geste que pickName() (tableau des 99 noms), en plus de
  // fermer la fiche.
  const applyNameAsTarget = (w: number) => {
    setNameSheet(null);
    pickName(w);
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
            Les 99 Noms d'<span>Allah</span>
          </h1>
          {/* « Asrar Pro » détaché du titre (revue design, point 7) : faisait
              auparavant partie du <h1>, à la même taille — écrasait le vrai
              titre de la page plutôt que de se lire comme une marque. */}
          <div className="brand-badge">Asrar Pro</div>
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
            {/* Libellés texte seul (revue design, point 4) : l'icône 🔍 sur
                le bouton principal, au repos, donnait l'impression d'un
                bouton « recherche » générique plutôt que l'action de la
                page — retirée. « Effacer » → « Réinitialiser » (plus
                explicite : remet le formulaire à zéro, pas juste le champ). */}
            <div className="btn-row">
              <button className="btn-primary" onClick={handleSearch}>
                {isSearching ? 'Arrêter la recherche' : 'Rechercher'}
              </button>
              <button className="btn-secondary" onClick={clearAll}>
                Réinitialiser
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
              {/* Résumé (revue design, point 3) : « Résultats pour {cible} »
                  + décompte contextuel — remplace un titre générique qui ne
                  rappelait ni la cible recherchée ni le nombre de noms. */}
              <div className="results-summary">
                <div className="card-title">Résultats pour {outcome.target}</div>
                <div className="results-count">
                  {count === 0 ? (
                    'Aucune combinaison trouvée'
                  ) : (
                    <>
                      <strong>{count}</strong> combinaison{count > 1 ? 's' : ''} de{' '}
                      <strong>{outcome.k}</strong> noms trouvée{count > 1 ? 's' : ''}
                    </>
                  )}
                </div>
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
                      <ResultCard key={idx} indices={sortedResults[idx]} onNameClick={setNameSheet} />
                    ))}
                  </div>

                  <Pagination
                    pages={pages}
                    page={safePage}
                    onGo={setPage}
                    start={start}
                    end={end}
                    total={filtered.length}
                    pageSize={pageSize}
                    onPageSizeChange={(n) => {
                      setPageSize(n);
                      setPage(0);
                    }}
                  />
                </>
              )}
            </div>
          )}

          {/* Calculatrice Abjad */}
          <div className="card">
            <div className="card-title">Calculatrice Abjad — poids d'un texte arabe</div>
            <div className="calc-row">
              {/* dir explicite (revue design, point 6) — le CSS posait déjà
                  direction:rtl/text-align:right, mais l'attribut HTML dir
                  participe plus correctement à l'algorithme bidi Unicode
                  (frontières avec la ponctuation/les espaces neutres). */}
              <input
                className="calc-text"
                type="text"
                dir="rtl"
                placeholder="Saisissez un texte en arabe…"
                value={calcInput}
                onChange={(e) => setCalcInput(e.target.value)}
              />
              <div className="calc-display" dir="ltr">
                {calcWeight > 0 ? calcWeight : '—'}
              </div>
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
                {NAMES.map((nm: any, i: number) => (
                  <div className="name-chip" key={i} onClick={() => pickName(nm.weight)} title={nm.fr}>
                    <span className="nc-ar" dir="rtl">
                      {nm.display}
                    </span>
                    <div className="nc-info">
                      <div className="nc-weight" dir="ltr">
                        {nm.weight}
                      </div>
                      <div className="nc-fr">{splitFr(nm.fr).translit}</div>
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

      {/* Fiche de nom (revue design, point 9) : touchée depuis une carte de
          résultat (voir ResultCard.onNameClick ci-dessous) — crée une vraie
          continuité entre la liste de résultats et la calculatrice, sans
          quitter la page. */}
      {nameSheet && (
        <div className="name-sheet-overlay" onClick={() => setNameSheet(null)}>
          <div className="name-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="name-sheet-ar" dir="rtl">
              {nameSheet.display}
            </div>
            <div className="name-sheet-translit">{nameSheet.translit}</div>
            {nameSheet.desc && <div className="name-sheet-desc">{nameSheet.desc}</div>}
            <div className="name-sheet-weight" dir="ltr">
              Valeur Abjad : {nameSheet.weight}
            </div>
            <div className="name-sheet-actions">
              <button className="name-sheet-use" onClick={() => applyNameAsTarget(nameSheet.weight)}>
                Utiliser {nameSheet.weight} comme cible
              </button>
              <button className="name-sheet-close" onClick={() => setNameSheet(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressLabel({ isSearching, progress, outcome }: { isSearching: boolean; progress: Progress | null; outcome: Outcome | null }) {
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

// Carte compacte (revue design, point 2) : 4 lignes fixes quel que soit k
// (2 à 11 noms) — noms arabes → formule → transcriptions → descriptions,
// jointes par « · » — au lieu d'une ligne par nom (« nom — description »),
// qui poussait une carte à k+2 lignes.
//
// Noms individuellement cliquables (point 9) : ouvrent la fiche de nom
// (voir la modale name-sheet-* dans le composant parent) — onNameClick reçoit
// directement les données déjà calculées ici (display/translit/desc/weight),
// pas juste un index, pour ne rien recalculer côté parent.
function ResultCard({ indices, onNameClick }: { indices: Combo; onNameClick: (n: NameSheetData) => void }) {
  const { names, formula, isAllah } = describeCombo(indices);
  const parts = names.map((nn: any) => splitFr(nn.fr));
  return (
    <div className={'result-card' + (isAllah ? ' has-allah' : '')}>
      {/* dir="rtl" explicite (revue design, point 6) sur le conteneur — les
          noms restent dans l'ordre de lecture arabe naturel, le signe "+"
          entre eux (neutre bidi) ne provoque pas d'inversion visuelle. */}
      <div className="rc-arabic" dir="rtl">
        {names.map((nn: any, i: number) => (
          <span key={i}>
            <button
              type="button"
              className="rc-name-btn"
              onClick={() => onNameClick({ display: nn.display, translit: parts[i].translit, desc: parts[i].desc, weight: nn.weight })}
            >
              {nn.display}
            </button>
            {i < names.length - 1 && '  +  '}
          </span>
        ))}
        {isAllah && <span className="rc-allah-badge">★ الله</span>}
      </div>
      <div>
        <span className="rc-formula" dir="ltr">
          {formula}
        </span>
      </div>
      <div className="rc-translit">{parts.map((p) => p.translit).join(' · ')}</div>
      <div className="rc-desc">{parts.map((p) => p.desc).join(' · ')}</div>
    </div>
  );
}

function Pagination({
  pages,
  page,
  onGo,
  start,
  end,
  total,
  pageSize,
  onPageSizeChange,
}: {
  pages: number;
  page: number;
  onGo: (p: number) => void;
  start: number;
  end: number;
  total: number;
  pageSize: number;
  onPageSizeChange: (n: number) => void;
}) {
  // Sélecteur « Afficher : 10 | 20 | 50 » (revue design, point 8) : toujours
  // utile même sur une seule page (passer à 10 quand 20 tenait déjà en une
  // page reste un choix légitime), donc rendu même si `pages <= 1` —
  // seule la navigation ‹ N › est alors masquée, pas tout le bloc.
  const sizePicker = (
    <label className="page-size-picker">
      Afficher :
      <select value={pageSize} onChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}>
        {PAGE_SIZE_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );

  if (pages <= 1) {
    return (
      <div className="pagination-wrap">
        {sizePicker}
        <span className="page-info">
          {start + 1}–{end} sur {total} résultat{total > 1 ? 's' : ''}
        </span>
      </div>
    );
  }

  const nums = [...new Set([0, pages - 1, page - 1, page, page + 1].filter((p) => p >= 0 && p < pages))].sort(
    (a, b) => a - b
  );
  const items: React.ReactNode[] = [];
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
      {sizePicker}
      <button className="page-btn" onClick={() => onGo(page - 1)} disabled={page === 0}>
        ‹
      </button>
      {items}
      <button className="page-btn" onClick={() => onGo(page + 1)} disabled={page >= pages - 1}>
        ›
      </button>
      <span className="page-info">
        {start + 1}–{end} sur {total}
      </span>
    </div>
  );
}
