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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Unlock, Flame, Sparkles, Shield, DoorOpen, ScrollText, Search } from 'lucide-react';
import { apiPost } from '@/lib/api';
import { useAccess } from '@/components/AccessProvider';
import { deepLink, cleanUrl } from '@/lib/share';
import { optimImg } from '@/lib/img';
import { sentenceCaseIfShouting } from '@/lib/text';
import SmartImageUntyped from '@/components/SmartImage';
import { useHistoryClose } from '@/components/useHistoryClose';
import { useProgressiveList } from '@/components/useProgressiveList';
import SecretDetail from './SecretDetail';

const SmartImage = SmartImageUntyped as any;

// Icônes vectorielles (lucide-react) à la place des émojis 🔓🌀✨🛡️🚪 — revue
// design : le rendu d'un émoji varie selon Android/iOS/le fabricant du
// téléphone, ce qui nuit à une identité visuelle cohérente. Choix
// sémantiques (pas de correspondance 1:1 parfaite pour des concepts
// ésotériques comme « Domptage ») : Unlock=déblocage, Flame=domptage
// (maîtrise/pouvoir), Sparkles=ilham (inspiration), Shield=protection,
// DoorOpen=ouverture (de voie).
interface Category {
  id: string;
  Icon: typeof Unlock;
  label: string;
}

interface SecretListItem {
  key: string;
  faida: string;
  img: string | null;
  ts: number;
}

interface CurrentSecret {
  catId: string;
  key: string;
  data: any;
}

const CATS: Category[] = [
  { id: 'deblocage', Icon: Unlock, label: 'Déblocage' },
  { id: 'domptage', Icon: Flame, label: 'Domptage' },
  { id: 'ilham', Icon: Sparkles, label: 'Ilham' },
  { id: 'protection', Icon: Shield, label: 'Protection' },
  { id: 'ouverture', Icon: DoorOpen, label: 'Ouverture' },
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
  // Recherche : filtre côté client la catégorie déjà chargée (pas d'appel
  // serveur supplémentaire — `list` est déjà en cache par catégorie). Réinitialisée
  // à chaque changement de catégorie (switchCat).
  const [search, setSearch] = useState('');
  const [currentSecret, setCurrentSecret] = useState<CurrentSecret | null>(null);
  const [loadingSecret, setLoadingSecret] = useState(false);
  const bootRef = useRef(false);

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
        img: val.img || val.image || null,
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
    setSearch('');
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
  const closeSecret = useCallback(() => setCurrentSecret(null), []);
  // Backpress Android : ferme le détail (pas de vraie navigation de page ici).
  const goBackFromSecret = useHistoryClose(inDetail, closeSecret);

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) => item.faida.toLowerCase().includes(q));
  }, [list, search]);

  // Rendu progressif : une catégorie chargée ne monte plus toutes ses cartes
  // (vignettes comprises) d'un bloc. Le compteur repart à chaque changement de
  // catégorie OU de recherche, `filteredList` étant remplacée dans les deux
  // cas (nouvelle référence à chaque changement de `search`/`list` — voir
  // useProgressiveList.js, prévu dès l'origine pour ce cas).
  const { visible: visibleList, sentinelRef, hasMore } = useProgressiveList(filteredList);

  return (
    <div className="container">
      <div className="asrar-topbar">
        <Link href="/" className="back-btn">
          ← Retour
        </Link>
        {!inDetail && (
          // .cat-rail-wrap porte le dégradé de bord droit (voir asrar.css) —
          // indice visuel qu'il reste des catégories à faire défiler, plutôt
          // que la barre coupée net qui donnait une impression d'interface
          // tronquée (5 catégories, seules les ~3 premières visibles au repos).
          <div className="cat-rail-wrap">
            <div className="cat-rail">
              {CATS.map((cat) => (
                <div
                  key={cat.id}
                  className={'cat-item' + (cat.id === currentCat.id ? ' active' : '')}
                  onClick={() => switchCat(cat)}
                >
                  <cat.Icon size={16} strokeWidth={2} className="ic" aria-hidden="true" />
                  <span className="lb">{cat.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className={'asrar-topbar-spacer' + (inDetail ? '' : ' with-cats')} />

      <div className="glass-panel">
        <div className={'asrar-wrap' + (inDetail ? ' detail-mode' : '')}>
          <div className="asrar-main">
            {inDetail ? (
              <SecretDetail secret={currentSecret} catLabel={currentCat.label} onBack={goBackFromSecret} />
            ) : (
              <div className="secrets-list">
                {/* Titre de page = catégorie sélectionnée (pas seulement dans
                    l'onglet actif) + décompte, et recherche client (filtre
                    `list`, déjà en cache par catégorie — aucun appel serveur
                    supplémentaire) — revue design : sans ce bloc, on passait
                    directement des onglets à de grandes cartes, sans repère
                    de « où suis-je / combien de contenus ». */}
                <div className="section-header">
                  <h1 className="section-title">{currentCat.label}</h1>
                  <span className="section-count">
                    {loadingList
                      ? '…'
                      : search.trim()
                      ? `${filteredList.length} résultat${filteredList.length > 1 ? 's' : ''} pour « ${search.trim()} »`
                      : `${list.length} contenu${list.length > 1 ? 's' : ''} disponible${list.length > 1 ? 's' : ''}`}
                  </span>
                </div>
                {!loadingList && list.length > 0 && (
                  <label className="search-bar">
                    <Search size={16} strokeWidth={2} aria-hidden="true" />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Rechercher une pratique…"
                      aria-label={`Rechercher dans ${currentCat.label}`}
                    />
                  </label>
                )}

                {loadingList ? (
                  <div className="loader" />
                ) : list.length === 0 ? (
                  <p className="secrets-empty">Aucun secret trouvé dans cette catégorie.</p>
                ) : filteredList.length === 0 ? (
                  <p className="secrets-empty">Aucun résultat pour « {search.trim()} ».</p>
                ) : (
                  <>
                  {/* Grille compacte (2 colonnes sur mobile, plus large sur
                      grand écran) : les anciennes cartes « has-cover » à
                      hauteur fixe (180px de vignette + titre) prenaient
                      quasiment tout l'écran sur un titre long — une seule
                      carte visible à la fois. Un seul type de carte
                      maintenant (plus de distinction has-cover / sans image) :
                      vignette à ratio fixe (16/9, voir .secret-thumb dans
                      asrar.css) avec une icône de repli cohérente au lieu
                      d'un emoji quand l'image manque, la même structure
                      « chip catégorie + titre » dans tous les cas. */}
                  <div className="secrets-grid">
                  {visibleList.map((item) => (
                    <div
                      key={item.key}
                      className="secret-card"
                      onClick={() => openSecret(currentCat.id, item.key)}
                    >
                      <div className="secret-thumb">
                        {item.img ? (
                          <SmartImage
                            src={optimImg(item.img, 400)}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 46vw, 220px"
                            style={{ objectFit: 'cover' }}
                          />
                        ) : (
                          <ScrollText size={26} strokeWidth={1.6} aria-hidden="true" />
                        )}
                      </div>
                      <div className="secret-body">
                        <span className="secret-cat-chip">{currentCat.label}</span>
                        <div className="secret-title">{sentenceCaseIfShouting(item.faida)}</div>
                      </div>
                    </div>
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
