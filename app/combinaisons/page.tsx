'use client';
// Module « Combinaisons » — port de combinaisons/combinaisons.html.
// Recherche des combinaisons de N noms d'Allah dont la somme des poids Abjad
// vaut une cible. L'algorithme (backtracking + élagage) vit dans
// lib/combinaisons.js ; ici, l'UI React : formulaire, progression, arrêt,
// filtre, pagination, calculatrice, tableau des noms et restauration.
//
// Revue design v2 : la page lisait comme un outil technique (formulaire
// imposant, informations internes toujours visibles — branches élaguées,
// temps de calcul —, gros rectangle de résultat pour la calculatrice,
// tableau des 99 noms isolé dans sa propre carte, pagination affichée même
// pour 4 résultats). Reprise en moteur de recherche simple : paramètres →
// rechercher → résultat → détails, le technique reste disponible mais
// replié (« Détails du calcul »).
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
// Combinaisons favorites (revue design v2, point 3 : « ajouter une action
// aux résultats ») — signature = indices triés (déjà croissants, cf.
// searchCombinations) joints par une virgule, stable tant que la table des
// 99 noms ne change pas.
const FAVORITES_KEY = 'cc_favorites';

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

// Résumé texte d'une combinaison (revue design v2, point 3 — action
// « Copier ») — un seul point de vérité, utilisé par ResultCard et la fiche
// de combinaison.
function comboCopyText(indices: Combo) {
  const { names, formula } = describeCombo(indices);
  const parts = names.map((nn: any) => splitFr(nn.fr));
  const arabic = names.map((nn: any) => nn.display).join(' + ');
  const translit = parts.map((p: any) => p.translit).join(' + ');
  return `${arabic} (${translit}) — ${formula}`;
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
  const [namesFilter, setNamesFilter] = useState(''); // filtre du tableau des 99 noms
  // Fiche de nom (revue design, point 9) : nom touché dans une carte de
  // résultat — null = fermée. Réutilise pickName() pour « Utiliser comme
  // cible » (même geste que le tableau des 99 noms plus bas sur la page).
  const [nameSheet, setNameSheet] = useState<NameSheetData | null>(null);
  // Fiche de combinaison (revue design v2, point 3) : la combinaison entière
  // (tous les noms + la formule), pas un seul nom — voir ComboSheet plus bas.
  const [comboSheet, setComboSheet] = useState<Combo | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());

  // Restauration : bannière si une recherche précédente est en cache.
  // Favoris : chargés une seule fois, indépendamment de la restauration.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setBanner(JSON.parse(raw));
    } catch {
      /* données corrompues — ignorer */
    }
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      if (raw) setFavorites(new Set(JSON.parse(raw)));
    } catch {
      /* données corrompues — ignorer */
    }
  }, []);

  const toggleFavorite = useCallback((signature: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(signature)) next.delete(signature);
      else next.add(signature);
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      } catch {
        /* quota dépassé — ignorer */
      }
      return next;
    });
  }, []);

  const copyCombo = useCallback(async (indices: Combo) => {
    const text = comboCopyText(indices);
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        window.prompt('Copiez la combinaison :', text);
      } catch {
        /* environnement sans prompt — rien de plus à faire */
      }
      return false;
    }
  }, []);

  const calcWeight = useMemo(() => abjadWeight(calcInput), [calcInput]);

  const filteredNames = useMemo(() => {
    const q = namesFilter.trim().toLowerCase();
    if (!q) return NAMES;
    return NAMES.filter((nm: any) => `${nm.display} ${nm.fr} ${nm.weight}`.toLowerCase().includes(q));
  }, [namesFilter]);

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
          {/* Terminologie unifiée sur « poids Abjad » (revue design v2,
              point 6) — la mention arabe du calcul, déjà expliquée dans la
              calculatrice plus bas, n'a pas besoin d'être répétée ici. */}
          <p className="subtitle">Combinaisons par poids Abjad</p>
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
                <label>
                  Poids cible
                  <span
                    className="field-help"
                    tabIndex={0}
                    role="img"
                    aria-label="Aide"
                    title="Valeur numérique calculée selon le système Abjad (حساب الجُمَّل)."
                  >
                    ⓘ
                  </span>
                </label>
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
                <label>Nombre de noms</label>
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
            {/* Réinitialiser en action texte secondaire (revue design v2,
                point 4) : ne rivalise plus visuellement avec Rechercher, la
                seule vraie action de ce formulaire. */}
            <div className="btn-row">
              <button className="btn-primary" onClick={handleSearch}>
                {isSearching ? 'Arrêter la recherche' : 'Rechercher'}
              </button>
              <button className="btn-secondary" onClick={clearAll}>
                Réinitialiser
              </button>
            </div>

            {/* Statut de la recherche — une seule ligne, sans le détail
                technique (branches élaguées, temps…), replié sous « Détails
                du calcul » quand il a une utilité réelle (revue design v2,
                points « informations trop techniques » et « message Arrêter
                qui reste affiché après la fin »). */}
            {(isSearching || outcome) && (
              <div className="progress-wrap">
                {isSearching && (
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: (progress ? progress.pct : 0) + '%' }} />
                  </div>
                )}
                <SearchStatus isSearching={isSearching} progress={progress} outcome={outcome} />
              </div>
            )}
          </div>

          {/* Résultats — le statut ci-dessus porte déjà le rappel de la
              cible et du décompte ; cette carte ne montre plus qu'un
              résumé redondant, juste les cartes de résultat. */}
          {outcome && count > 0 && (
            <div className="card">
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
                  <ResultCard
                    key={idx}
                    indices={sortedResults[idx]}
                    isFav={favorites.has(sortedResults[idx].join(','))}
                    onNameClick={setNameSheet}
                    onToggleFav={toggleFavorite}
                    onDetails={setComboSheet}
                    onCopy={copyCombo}
                  />
                ))}
              </div>

              {/* Pagination masquée quand tout tient déjà sur un écran
                  (revue design v2, point 4) — n'apparaît que lorsque le
                  nombre de résultats dépasse la taille de page choisie. */}
              {filtered.length > pageSize && (
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
              )}
            </div>
          )}

          {/* Calculatrice Abjad + tableau des 99 noms, réunis dans UNE seule
              carte (revue design v2, points 5 et 7) : le tableau n'est plus
              une section indépendante en bas de page, et le résultat de la
              calculatrice n'est plus un gros pavé sombre mais une ligne de
              texte sous le champ. */}
          <div className="card">
            <div className="card-title">Calculateur Abjad</div>
            <input
              className="calc-text"
              type="text"
              dir="rtl"
              placeholder="Saisissez un texte en arabe…"
              value={calcInput}
              onChange={(e) => setCalcInput(e.target.value)}
            />
            <div className="calc-result">
              Poids Abjad : <strong>{calcWeight > 0 ? calcWeight : '—'}</strong>
            </div>
            <p className="calc-note">
              Valeur numérique calculée selon le système Abjad (حساب الجُمَّل). Touchez un nom ci-dessous pour
              l'utiliser comme cible.
            </p>

            <details className="names-table">
              <summary>Tableau des 99 Noms et leurs poids Abjad</summary>
              <div className="results-search-wrap">
                <div className="search-icon-wrap">
                  <span className="search-icon">🔍</span>
                  <input
                    className="results-search-input"
                    type="text"
                    placeholder="Rechercher un nom…"
                    dir="auto"
                    value={namesFilter}
                    onChange={(e) => setNamesFilter(e.target.value)}
                  />
                </div>
                {namesFilter && (
                  <button className="results-search-clear" onClick={() => setNamesFilter('')} title="Effacer">
                    ✕
                  </button>
                )}
              </div>
              <div className="names-grid">
                {filteredNames.map((nm: any, i: number) => (
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

        <footer>Les 99 Noms d'Allah · Poids Abjad (حساب الجُمَّل الكبير)</footer>
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

      {/* Fiche de combinaison (revue design v2, point 3 : « ajouter une
          action aux résultats ») — ouverte via « Détails » ou un tap sur la
          carte entière ; détaille TOUS les noms de la combinaison, pas un
          seul, contrairement à la fiche de nom ci-dessus. */}
      {comboSheet && (
        <ComboSheet indices={comboSheet} onClose={() => setComboSheet(null)} onCopy={copyCombo} />
      )}
    </div>
  );
}

// Statut de la recherche — remplace l'ancien ProgressLabel : ne garde en
// permanence que l'essentiel (une phrase), le détail technique (temps,
// branches élaguées, combinaisons théoriques) vit derrière « Détails du
// calcul » (revue design v2). Corrige au passage un bogue de l'ancienne
// version : le message « Cliquez sur Arrêter pour interrompre » restait
// affiché après la fin de la recherche (branche par défaut atteinte à tort
// une fois `isSearching` redevenu faux) — cette version ne montre plus ce
// texte que pendant la recherche elle-même (le libellé du bouton suffit).
function SearchStatus({
  isSearching,
  progress,
  outcome,
}: {
  isSearching: boolean;
  progress: Progress | null;
  outcome: Outcome | null;
}) {
  if (isSearching) {
    const p = progress || { pct: 0, found: 0, pruned: 0 };
    return (
      <div className="status-line">
        Recherche en cours… {p.pct}% — {p.found} combinaison{p.found > 1 ? 's' : ''} trouvée{p.found > 1 ? 's' : ''}
      </div>
    );
  }
  if (!outcome) return null;

  if (outcome.restored) {
    return (
      <div className="status-line status-ok">
        💾 Résultats restaurés — {outcome.results.length} combinaison{outcome.results.length > 1 ? 's' : ''} pour le
        poids {outcome.target}
      </div>
    );
  }
  if (outcome.stopped) {
    return (
      <div className="status-line status-stopped">
        ⏸ Recherche interrompue — {outcome.results.length} résultat{outcome.results.length > 1 ? 's' : ''} partiel
        {outcome.results.length > 1 ? 's' : ''}
        <CalcDetails elapsed={outcome.elapsed} pruned={outcome.pruned} k={outcome.k} />
      </div>
    );
  }
  if (outcome.empty) {
    return (
      <div className="status-line status-empty">
        🔎 Aucune combinaison trouvée pour le poids {outcome.target}. Essayez un autre nombre de noms ou un autre
        poids cible.
      </div>
    );
  }
  const n = outcome.results.length;
  return (
    <div className="status-line status-ok">
      ✓ {n} combinaison{n > 1 ? 's' : ''} trouvée{n > 1 ? 's' : ''} pour le poids {outcome.target}
      <CalcDetails elapsed={outcome.elapsed} pruned={outcome.pruned} k={outcome.k} />
    </div>
  );
}

// Informations internes du calcul (revue design v2, « trop technique pour
// l'utilisateur ») — repliées par défaut, accessibles pour qui veut
// comprendre le fonctionnement (temps de calcul, élagage, combinatoire).
function CalcDetails({ elapsed, pruned, k }: { elapsed: string | number; pruned: number; k: number }) {
  return (
    <details className="calc-details">
      <summary>Détails du calcul</summary>
      <div className="calc-details-body">
        {elapsed}s · {Number(pruned).toLocaleString('fr-FR')} branches élaguées · ~
        {countCombinations(NUM_NAMES, k).toLocaleString('fr-FR')} combinaisons théoriques
      </div>
    </details>
  );
}

// Carte de résultat (revue design v2) : l'équation est désormais associée
// directement aux noms plutôt qu'isolée en haut de carte — arabe →
// transcription → sens → équation, dans cet ordre de lecture. Une rangée
// d'actions compactes (Détails/Copier/Favori) clôt la carte ; toute la carte
// est elle-même tactile et ouvre la fiche de combinaison (revue design,
// point 3 : « ajouter une action aux résultats »).
function ResultCard({
  indices,
  isFav,
  onNameClick,
  onToggleFav,
  onDetails,
  onCopy,
}: {
  indices: Combo;
  isFav: boolean;
  onNameClick: (n: NameSheetData) => void;
  onToggleFav: (signature: string) => void;
  onDetails: (indices: Combo) => void;
  onCopy: (indices: Combo) => Promise<boolean>;
}) {
  const [copied, setCopied] = useState(false);
  const { names, formula, isAllah } = describeCombo(indices);
  const parts = names.map((nn: any) => splitFr(nn.fr));
  const signature = indices.join(',');

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onCopy(indices);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={'result-card' + (isAllah ? ' has-allah' : '')} onClick={() => onDetails(indices)}>
      {/* dir="rtl" explicite (revue design, point 6) sur le conteneur — les
          noms restent dans l'ordre de lecture arabe naturel, le signe "+"
          entre eux (neutre bidi) ne provoque pas d'inversion visuelle. */}
      <div className="rc-arabic" dir="rtl">
        {names.map((nn: any, i: number) => (
          <span key={i}>
            <button
              type="button"
              className="rc-name-btn"
              onClick={(e) => {
                e.stopPropagation();
                onNameClick({ display: nn.display, translit: parts[i].translit, desc: parts[i].desc, weight: nn.weight });
              }}
            >
              {nn.display}
            </button>
            {i < names.length - 1 && '  +  '}
          </span>
        ))}
        {isAllah && <span className="rc-allah-badge">★ الله</span>}
      </div>
      <div className="rc-translit">{parts.map((p: any) => p.translit).join(' + ')}</div>
      <div className="rc-desc">{parts.map((p: any) => p.desc).join(' · ')}</div>

      <div className="rc-footer">
        <span className="rc-formula" dir="ltr">
          {formula}
        </span>
        <div className="rc-actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="rc-action" onClick={() => onDetails(indices)}>
            Détails
          </button>
          <button type="button" className="rc-action" onClick={handleCopy}>
            {copied ? 'Copié ✓' : 'Copier'}
          </button>
          <button
            type="button"
            className={'rc-action rc-fav' + (isFav ? ' active' : '')}
            onClick={() => onToggleFav(signature)}
            aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            aria-pressed={isFav}
          >
            {isFav ? '★' : '☆'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Fiche de combinaison (revue design v2, point 3) : détaille TOUS les noms
// de la combinaison (arabe, transcription, sens, poids) puis la formule
// complète — pendant de la fiche de nom (name-sheet) mais pour l'ensemble
// de la combinaison plutôt qu'un seul nom.
function ComboSheet({ indices, onClose, onCopy }: { indices: Combo; onClose: () => void; onCopy: (indices: Combo) => Promise<boolean> }) {
  const [copied, setCopied] = useState(false);
  const { names, formula, isAllah } = describeCombo(indices);
  const parts = names.map((nn: any) => splitFr(nn.fr));

  const handleCopy = async () => {
    await onCopy(indices);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="name-sheet-overlay" onClick={onClose}>
      <div className="name-sheet combo-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="combo-sheet-list">
          {names.map((nn: any, i: number) => (
            <div className="combo-sheet-item" key={i}>
              <div className="combo-sheet-ar" dir="rtl">
                {nn.display}
              </div>
              <div className="combo-sheet-meta">
                <span className="combo-sheet-translit">{parts[i].translit}</span>
                <span className="combo-sheet-weight" dir="ltr">
                  {nn.weight}
                </span>
              </div>
              {parts[i].desc && <div className="combo-sheet-desc">{parts[i].desc}</div>}
            </div>
          ))}
        </div>
        {isAllah && <div className="rc-allah-badge combo-sheet-allah">★ الله</div>}
        <div className="name-sheet-weight" dir="ltr">
          {formula}
        </div>
        <div className="name-sheet-actions">
          <button className="name-sheet-use" onClick={handleCopy}>
            {copied ? 'Copié ✓' : 'Copier la combinaison'}
          </button>
          <button className="name-sheet-close" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
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
