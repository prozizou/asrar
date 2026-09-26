'use client';
// Module « Secrets Mystiques » — port complet d'asrar.js/asrar.html en React.
// Liste par catégorie (métadonnées via /api/list-content) → détail complet
// (contenu payant via /api/get-content, gaté par ensureAccess).
//
// TypeScript (batch 3/7, cf. tsconfig.json) : Category/SecretListItem/
// CurrentSecret sont des types locaux reflétant la forme réellement
// manipulée ici (réponses de /api/list-content et /api/get-content, cf.
// pages/api/list-content.js et pages/api/get-content.js). SecretDetail.js,
// useHistoryClose.js, useProgressiveList.js et SmartImage.js restent en .js
// (composants/hooks partagés, hors scope de ce batch) — mêmes principes que
// dans app/menu/page.tsx et app/commandes/page.tsx (#114, #116).
import './asrar.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck, DoorOpen, Lock, BookOpen, Flower, ScrollText, Bookmark, ChevronRight } from 'lucide-react';
import { apiPost } from '@/lib/api';
import { useAccess } from '@/components/AccessProvider';
import { deepLink, cleanUrl } from '@/lib/share';
import { optimImg } from '@/lib/img';
import { sentenceCaseIfShouting } from '@/lib/text';
import { secretImages } from '@/lib/secretPresentation';
import SmartImageUntyped from '@/components/SmartImage';
import { useHistoryClose } from '@/components/useHistoryClose';
import { useProgressiveList } from '@/components/useProgressiveList';
import SecretDetail from './SecretDetail';

const SmartImage = SmartImageUntyped as any;

// Icônes vectorielles (lucide-react) plutôt que des émojis (rendu variable
// selon Android/iOS). Ordre, libellés et pictogrammes calqués sur la
// maquette : onglets carrés « icône au-dessus du libellé ».
interface Category {
  id: string;
  Icon: typeof Lock;
  label: string;
}

interface SecretListItem {
  key: string;
  faida: string;
  desc: string;
  img: string | null;
  ts: number;
}

interface CurrentSecret {
  catId: string;
  key: string;
  data: any;
}

const CATS: Category[] = [
  { id: 'protection', Icon: ShieldCheck, label: 'Protections' },
  { id: 'ouverture', Icon: DoorOpen, label: 'Ouvertures' },
  { id: 'deblocage', Icon: Lock, label: 'Déblocages' },
  { id: 'ilham', Icon: BookOpen, label: 'Ilham&Wilaya' },
  { id: 'domptage', Icon: Flower, label: 'Domptages' },
];

export default function AsrarPage() {
  // useAccess() vient d'AccessProvider.js (.js, hors scope de ce batch) :
  // son contexte est créé via createContext(null), donc TS l'infère `null`
  // sans cast — la vraie forme documentée ici en local.
  const { ensureAccess } = useAccess() as unknown as {
    ensureAccess: (minLevel?: number) => Promise<boolean>;
  };
  const cacheRef = useRef<Record<string, SecretListItem[]>>({}); // secretsCache par catégorie
  const [currentCat, setCurrentCat] = useState<Category>(CATS[0]);
  const [list, setList] = useState<SecretListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [currentSecret, setCurrentSecret] = useState<CurrentSecret | null>(null);
  const [loadingSecret, setLoadingSecret] = useState(false);
  const bootRef = useRef(false);
  const topbarRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [topbarHeight, setTopbarHeight] = useState<number>();
  const [railEdges, setRailEdges] = useState({ left: false, right: false });
  const updateRailEdges = useCallback(() => {
    const rail = railRef.current;
    if (rail) setRailEdges({ left: rail.scrollLeft > 2, right: rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2 });
  }, []);

  // Repère favori sur les cartes (revue design, point 5 : « aucun indicateur
  // permettant de distinguer rapidement les contenus... favori » — la seule
  // donnée de ce type déjà disponible SANS appel réseau supplémentaire : le
  // favori est stocké en local par SecretDetail.js (bmKey), simplement relu
  // ici. Popularité/type de contenu écartés : /api/list-content ne sert pas
  // ces champs pour ce nœud (voir server/sources.js) et les ajouter demanderait un appel par fiche ou un
  // changement serveur, hors périmètre d'une passe d'affichage.
  // Recalculé au changement de catégorie/liste ET au retour depuis la fiche
  // détail (currentSecret redevient null) — un favori qui vient d'être
  // ajouté/retiré s'y reflète sans recharger la page.
  const [bookmarkedKeys, setBookmarkedKeys] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const s = new Set<string>();
      for (const item of list) {
        if (localStorage.getItem(`bookmark_${currentCat.id}_${item.key}`)) s.add(item.key);
      }
      setBookmarkedKeys(s);
    } catch {
      setBookmarkedKeys(new Set());
    }
  }, [list, currentCat.id, currentSecret]);

  // Images en échec de chargement (URL morte, hôte injoignable) : on retombe
  // sur l'icône de repli au lieu d'une vignette vide.
  const [brokenImgs, setBrokenImgs] = useState<Set<string>>(new Set());
  const markBroken = useCallback((key: string) => {
    setBrokenImgs((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }, []);

  const loadSecrets = useCallback(async (catId: string) => {
    if (cacheRef.current[catId]) {
      setList(cacheRef.current[catId]);
      return cacheRef.current[catId];
    }
    setLoadingList(true);
    try {
      const { items } = await apiPost('list-content', { kind: 'secret', cat: catId });
      const mapped: SecretListItem[] = (items || []).map((val: any) => ({
        key: val._key,
        faida: val.faida || val.title || val.titre || 'Secret sans titre',
        desc: val.intro || val.description || val.desc || '',
        // Même lecture que la fiche détail (img, image, images[], imgs[]) :
        // un secret dont la seule image est dans `images` avait un placeholder.
        img: secretImages(val)[0] || null,
        ts: typeof val.updatedAt === 'number' ? val.updatedAt : 0,
      }));
      // Les plus récents en haut (updatedAt desc, sinon ordre des clés push).
      mapped.sort((a, b) => b.ts - a.ts || (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
      cacheRef.current[catId] = mapped;
      setList(mapped);
      return mapped;
    } catch (e) {
      cacheRef.current[catId] = [];
      setList([]);
      return [];
    } finally {
      setLoadingList(false);
    }
  }, []);

  const fetchDetail = useCallback(
    async (catId: string, key: string) => {
      setLoadingSecret(true);
      try {
        const { item } = await apiPost('get-content', { kind: 'secret', cat: catId, key });
        if (!item) throw new Error('Secret introuvable.');
        item.faida = item.faida || item.title || item.titre || '';
        item.sirr = item.sirr || item.content || '';
        item.img = item.img || item.image || null;
        setCurrentSecret({ catId, key, data: item });
      } catch (e: any) {
        if (e.status === 403) {
          // paywall serveur : l'utilisateur a perdu l'accès entre-temps
          ensureAccess();
          return;
        }
        alert('Impossible de charger le secret.');
      } finally {
        setLoadingSecret(false);
      }
    },
    [ensureAccess]
  );

  const openSecret = useCallback(
    async (catId: string, key: string) => {
      const ok = await ensureAccess();
      if (ok) fetchDetail(catId, key);
    },
    [ensureAccess, fetchDetail]
  );

  const switchCat = (cat: Category) => {
    setCurrentCat(cat);
    setCurrentSecret(null);
    loadSecrets(cat.id);
  };

  // Boot : deep link éventuel (?item=&cat= ou /s?i=&c=) puis chargement.
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    (async () => {
      const deep = deepLink();
      let cat = CATS[0];
      if (deep && deep.cat) {
        const c = CATS.find((x) => x.id === deep.cat);
        if (c) cat = c;
      }
      setCurrentCat(cat);
      await loadSecrets(cat.id);
      if (deep && deep.key) {
        cleanUrl();
        openSecret(cat.id, deep.key);
      }
    })();
  }, [loadSecrets, openSecret]);

  const inDetail = !!currentSecret;
  // Mesure la barre réelle : lien retour, zoom texte et safe-area compris.
  useEffect(() => {
    const bar = topbarRef.current;
    if (!bar) return;
    const measure = () => { setTopbarHeight(bar.getBoundingClientRect().height); updateRailEdges(); };
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    measure();
    return () => observer.disconnect();
  }, [inDetail, updateRailEdges]);

  useEffect(() => {
    const rail = railRef.current;
    const active = rail?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!rail || !active) return;
    const target = active.offsetLeft - (rail.clientWidth - active.offsetWidth) / 2;
    rail.scrollTo({ left: target, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    updateRailEdges();
  }, [currentCat.id, inDetail, updateRailEdges]);

  const closeSecret = useCallback(() => setCurrentSecret(null), []);
  // Backpress Android : ferme le détail (pas de vraie navigation de page ici).
  const goBackFromSecret = useHistoryClose(inDetail, closeSecret);

  // Rendu progressif : une catégorie chargée ne monte plus toutes ses cartes
  // (vignettes comprises) d'un bloc ; le compteur repart à chaque changement
  // de catégorie (`list` remplacée — voir useProgressiveList.js).
  const { visible: visibleList, sentinelRef, hasMore } = useProgressiveList(list);

  return (
    <div className="container asrar-page">
      <div className="asrar-topbar" ref={topbarRef}>
        {inDetail ? (
          <div className="secret-detail-topbar">
            <button type="button" className="secret-return" onClick={goBackFromSecret}>← Retour</button>
            <span dir="auto">{sentenceCaseIfShouting(currentSecret?.data.faida || 'Secret mystique')}</span>
          </div>
        ) : null}
        {!inDetail && (
          // .cat-rail-wrap porte le dégradé de bord droit (voir asrar.css) —
          // indice visuel qu'il reste des catégories à faire défiler, plutôt
          // que la barre coupée net qui donnait une impression d'interface
          // tronquée (5 catégories, seules les ~3 premières visibles au repos).
          <div className={`cat-rail-wrap${railEdges.left ? ' can-scroll-left' : ''}${railEdges.right ? ' can-scroll-right' : ''}`}>
            <div className="cat-rail" ref={railRef} onScroll={updateRailEdges} role="group" aria-label="Catégories de secrets">
              {CATS.map((cat) => (
                <button
                  type="button"
                  aria-pressed={cat.id === currentCat.id}
                  key={cat.id}
                  className={'cat-item' + (cat.id === currentCat.id ? ' active' : '')}
                  onClick={() => switchCat(cat)}
                >
                  <cat.Icon size={22} strokeWidth={2} className="ic" aria-hidden="true" />
                  <span className="lb">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className={'asrar-topbar-spacer' + (inDetail ? '' : ' with-cats')} style={{ height: topbarHeight }} aria-hidden />

      <div className="glass-panel">
        <div className={'asrar-wrap' + (inDetail ? ' detail-mode' : '')}>
          <div className="asrar-main">
            {inDetail ? (
              <SecretDetail secret={currentSecret} catLabel={currentCat.label} />
            ) : (
              <div className="secrets-list">
                {loadingList ? (
                  <div className="loader" />
                ) : list.length === 0 ? (
                  <p className="secrets-empty">Aucun secret trouvé dans cette catégorie.</p>
                ) : (
                  <>
                  {/* Cartes horizontales (maquette) : vignette à gauche, titre en
                      capitales + filet vert + description, flèche ronde à droite. */}
                  <h1 className="sr-only">{currentCat.label}</h1>
                  <div className="secrets-grid">
                  {visibleList.map((item) => (
                    <button
                      type="button"
                      title={sentenceCaseIfShouting(item.faida)}
                      key={item.key}
                      className="secret-card"
                      onClick={() => openSecret(currentCat.id, item.key)}
                    >
                      <span className="secret-thumb">
                        {item.img && !brokenImgs.has(item.key) ? (
                          <SmartImage
                            src={optimImg(item.img, 280)}
                            alt=""
                            fill
                            sizes="132px"
                            style={{ objectFit: 'cover' }}
                            onError={() => markBroken(item.key)}
                          />
                        ) : (
                          <ScrollText size={28} strokeWidth={1.5} aria-hidden="true" />
                        )}
                        {bookmarkedKeys.has(item.key) && (
                          <span className="secret-bookmark-badge" title="Dans vos favoris">
                            <Bookmark size={13} strokeWidth={2} fill="currentColor" aria-hidden="true" />
                          </span>
                        )}
                      </span>
                      <span className="secret-body">
                        <span className="secret-title">{sentenceCaseIfShouting(item.faida)}</span>
                        <span className="secret-rule" aria-hidden="true" />
                        {item.desc && <span className="secret-desc">{item.desc}</span>}
                      </span>
                      <span className="secret-go" aria-hidden="true">
                        <ChevronRight size={20} strokeWidth={2.6} />
                      </span>
                    </button>
                  ))}
                  </div>
                  {hasMore && <div ref={sentinelRef} className="load-sentinel" aria-hidden />}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {loadingSecret && (
        <div id="secret-loading">
          <div className="sl-spin" />
        </div>
      )}
    </div>
  );
}
