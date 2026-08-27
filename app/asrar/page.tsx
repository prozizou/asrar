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
import Link from 'next/link';
import { apiPost } from '@/lib/api';
import { useAccess } from '@/components/AccessProvider';
import { deepLink, cleanUrl } from '@/lib/share';
import { optimImg } from '@/lib/img';
import SmartImageUntyped from '@/components/SmartImage';
import { useHistoryClose } from '@/components/useHistoryClose';
import { useProgressiveList } from '@/components/useProgressiveList';
import SecretDetail from './SecretDetail';

const SmartImage = SmartImageUntyped as any;

interface Category {
  id: string;
  icon: string;
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
  { id: 'deblocage', icon: '🔓', label: 'Déblocage' },
  { id: 'domptage', icon: '🌀', label: 'Domptage' },
  { id: 'ilham', icon: '✨', label: 'Ilham' },
  { id: 'protection', icon: '🛡️', label: 'Protection' },
  { id: 'ouverture', icon: '🚪', label: 'Ouverture' },
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

  // Rendu progressif : une catégorie chargée ne monte plus toutes ses cartes
  // (vignettes comprises) d'un bloc. Le compteur repart à chaque changement de
  // catégorie, `list` étant remplacée à ce moment-là.
  const { visible: visibleList, sentinelRef, hasMore } = useProgressiveList(list);

  return (
    <div className="container">
      <div className="asrar-topbar">
        <Link href="/" className="back-btn">
          ← Retour
        </Link>
        {!inDetail && (
          <div className="cat-rail">
            {CATS.map((cat) => (
              <div
                key={cat.id}
                className={'cat-item' + (cat.id === currentCat.id ? ' active' : '')}
                onClick={() => switchCat(cat)}
              >
                <span className="ic">{cat.icon}</span>
                <span className="lb">{cat.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={'asrar-topbar-spacer' + (inDetail ? '' : ' with-cats')} />

      <div className="glass-panel">
        <div className={'asrar-wrap' + (inDetail ? ' detail-mode' : '')}>
          <div className="asrar-main">
            {inDetail ? (
              <SecretDetail secret={currentSecret} onBack={goBackFromSecret} />
            ) : (
              <div className="secrets-list">
                {loadingList ? (
                  <div className="loader" />
                ) : list.length === 0 ? (
                  <p style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>Aucun secret trouvé.</p>
                ) : (
                  <>
                  {visibleList.map((item) => (
                    <div
                      key={item.key}
                      className={'secret-card' + (item.img ? ' has-cover' : '')}
                      onClick={() => openSecret(currentCat.id, item.key)}
                    >
                      <div className="secret-thumb">
                        {item.img ? (
                          <SmartImage
                            src={optimImg(item.img, 400)}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 90vw, 48px"
                            style={{ objectFit: 'cover' }}
                          />
                        ) : (
                          '📜'
                        )}
                      </div>
                      <div className="secret-title">{item.faida}</div>
                    </div>
                  ))}
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
