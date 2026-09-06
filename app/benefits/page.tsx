'use client';
// Module « Asma ul-Husna » (99 Noms d'Allah) — port de Benefits/ en React.
// Chargement des noms, recherche + suggestions, favoris, cartes verrouillées
// sans abonnement, modale, compteur de dhikr et carrés magiques par nom.
// Font Awesome (icônes des boutons : favori, audio, dhikr…) — auto-hébergé
// (npm) au lieu d'un @import CDN dans benefits.css : la CSP de l'app
// n'autorise pas cdnjs.cloudflare.com dans style-src, donc cet import était
// bloqué en silence et toutes les icônes s'affichaient vides (boutons
// « invisibles »). Seuls les styles Solid + Regular sont importés (seuls
// utilisés dans ce module) — pas Brands, pour ne pas charger sa police
// inutilement.
//
// TypeScript (batch 3/7, cf. tsconfig.json) : NameItem reflète la forme
// renvoyée par lib/benefits.js (loadNames()). NameCard.js, NameModal.js,
// useProgressiveList.js et Spinner.js restent en .js (composants/hooks
// partagés, hors scope de ce batch) — mêmes principes que dans
// app/menu/page.tsx et app/commandes/page.tsx (#114, #116).
import '@fortawesome/fontawesome-free/css/fontawesome.min.css';
import '@fortawesome/fontawesome-free/css/solid.min.css';
import '@fortawesome/fontawesome-free/css/regular.min.css';
import './benefits.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { loadNames } from '@/lib/benefits';
import { useAccess } from '@/components/AccessProvider';
import SpinnerUntyped from '@/components/Spinner';
import { useProgressiveList } from '@/components/useProgressiveList';
import NameCard from './NameCard';
import NameModal from './NameModal';

const Spinner = SpinnerUntyped as any;

interface NameItem {
  id: string;
  name: string;
  translit: string;
  meaning: string;
  benefit: string;
  number: number;
}

const norm = (s: unknown) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function BenefitsPage() {
  // useAccess() vient d'AccessProvider.js (.js, hors scope de ce batch) :
  // son contexte est créé via createContext(null), donc TS l'infère `null`
  // sans cast — la vraie forme documentée ici en local.
  const { allowed, refreshAccess, openGate } = useAccess() as unknown as {
    allowed: boolean | null;
    refreshAccess: () => Promise<boolean>;
    openGate: (reason?: string | null) => void;
  };
  const [names, setNames] = useState<NameItem[]>([]);
  const [namesLoading, setNamesLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFavs, setShowFavs] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [modalItem, setModalItem] = useState<NameItem | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [toastShow, setToastShow] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bootRef = useRef(false);

  const accessGranted = allowed === true;

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastShow(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastShow(false), 2200);
  }, []);

  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    try {
      setFavorites(new Set(JSON.parse(localStorage.getItem('favorites') as string) || []));
    } catch {}
    loadNames()
      .then(setNames)
      .catch(() => showToast('⚠️ Données locales utilisées'))
      .finally(() => setNamesLoading(false));
    refreshAccess().catch(() => {});
  }, [refreshAccess, showToast]);

  const toggleFav = useCallback(
    (id: string) => {
      setFavorites((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        try {
          localStorage.setItem('favorites', JSON.stringify([...next]));
        } catch {}
        showToast(next.has(id) ? '⭐ Ajouté aux favoris' : '✕ Retiré des favoris');
        return next;
      });
    },
    [showToast]
  );

  // Filtrage : favoris (ou compteur > 0) puis recherche multi-champs.
  const filtered = useMemo(() => {
    let list = names;
    if (showFavs) {
      list = list.filter((item) => {
        let count = 0;
        try {
          count = parseInt(localStorage.getItem(`tasbih_asma_${item.id}`) as string) || 0;
        } catch {}
        return favorites.has(item.id) || count > 0;
      });
    }
    const term = norm(search.trim());
    if (term) {
      list = list.filter((item) =>
        [item.name, item.translit, item.meaning, item.benefit, String(item.number)].some((f) => norm(f).includes(term))
      );
    }
    return list;
  }, [names, showFavs, search, favorites]);

  // Rendu progressif : les 99 cartes ne sont plus montées d'un bloc (chacune
  // porte son compteur de dhikr, ses icônes et ses lectures localStorage).
  const { visible: visibleNames, sentinelRef, hasMore } = useProgressiveList(filtered);

  // Suggestions (translit commençant par, ou sens contenant), top 6.
  const suggestions = useMemo(() => {
    const term = search.trim();
    if (!term) return [];
    return names.filter((i) => norm(i.translit).startsWith(norm(term)) || norm(i.meaning).includes(norm(term))).slice(0, 6);
  }, [search, names]);
  const [suggestOpen, setSuggestOpen] = useState(false);

  return (
    <div className="app-wrapper">
      <header className="app-header">
        <div className="header-inner">
          <div className="header-brand">
            <div className="brand-icon">
              <Link href="/" aria-label="Accueil" style={{ display: 'block', width: '100%', height: '100%' }}>
                🕌
              </Link>
            </div>
            <div>
              <h1 className="brand-title">Asma ul-Husna</h1>
              <div className="brand-subtitle">Les plus beaux noms d'Allah — sagesse, lumière et bénédiction</div>
            </div>
          </div>
          <div className="header-actions">
            <button
              className={'icon-btn' + (showFavs ? ' active' : '')}
              aria-label="Voir les favoris"
              onClick={() => setShowFavs((v) => !v)}
            >
              <i className={showFavs ? 'fas fa-star' : 'far fa-star'} />
            </button>
          </div>
        </div>
        <div className="header-stats">
          <div className="stat-pill">
            <i className="fas fa-dharmachakra" />
            <span>{filtered.length}</span> noms disponibles
          </div>
        </div>
      </header>

      <div className="search-wrapper">
        <div className="search-box">
          <i className="fas fa-search search-icon" />
          <input
            type="text"
            placeholder="Rechercher un nom, une translitération…"
            autoComplete="off"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSuggestOpen(true);
            }}
            onFocus={() => setSuggestOpen(true)}
          />
          {search && (
            <button
              className="clear-btn"
              onClick={() => {
                setSearch('');
                setSuggestOpen(false);
              }}
            >
              <i className="fas fa-times" />
            </button>
          )}
        </div>
        {suggestOpen && suggestions.length > 0 && (
          <div className="suggestions-dropdown" style={{ display: 'block' }}>
            {suggestions.map((item) => (
              <div
                key={item.id}
                className="suggestion-item"
                onClick={() => {
                  setSearch(item.translit);
                  setSuggestOpen(false);
                  setModalItem(item);
                }}
              >
                {item.translit} – <small>{item.meaning}</small>
              </div>
            ))}
          </div>
        )}
      </div>

      <main className="cards-grid">
        {namesLoading ? (
          <div className="empty-message">
            <Spinner size={28} />
            <p>Chargement des noms…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-message">
            <i className="fas fa-moon" />
            <p>{search ? `Aucun nom trouvé pour « ${search} »` : 'Aucun nom.'}</p>
          </div>
        ) : (
          <>
            {visibleNames.map((item) => (
              <NameCard
                key={item.id}
                item={item}
                accessGranted={accessGranted}
                isFav={favorites.has(item.id)}
                searchTerm={search.trim()}
                onToggleFav={toggleFav}
                onOpenModal={setModalItem}
                onOpenGate={openGate}
              />
            ))}
            {hasMore && <div ref={sentinelRef} className="load-sentinel" aria-hidden />}
          </>
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-inner">
          <span>Données en temps réel</span>
          <span className="footer-dot" />
          <span>Élégance spirituelle</span>
        </div>
      </footer>

      {modalItem && (
        <NameModal
          item={modalItem}
          accessGranted={accessGranted}
          isFav={favorites.has(modalItem.id)}
          onClose={() => setModalItem(null)}
          onToggleFav={toggleFav}
          onOpenGate={openGate}
        />
      )}

      <div className={'toast' + (toastShow ? ' show' : '')}>{toastMsg}</div>
    </div>
  );
}
