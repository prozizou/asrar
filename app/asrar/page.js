'use client';
// Module « Secrets Mystiques » — port complet d'asrar.js/asrar.html en React.
// Liste par catégorie (métadonnées via /api/list-content) → détail complet
// (contenu payant via /api/get-content, gaté par ensureAccess).
import './asrar.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiPost } from '@/lib/api';
import { useAccess } from '@/components/AccessProvider';
import { deepLink, cleanUrl } from '@/lib/share';
import { optimImg } from '@/lib/img';
import SecretDetail from './SecretDetail';

const CATS = [
  { id: 'deblocage', icon: '🔓', label: 'Déblocage' },
  { id: 'domptage', icon: '🌀', label: 'Domptage' },
  { id: 'ilham', icon: '✨', label: 'Ilham' },
  { id: 'protection', icon: '🛡️', label: 'Protection' },
  { id: 'ouverture', icon: '🚪', label: 'Ouverture' },
];

export default function AsrarPage() {
  const { ensureAccess } = useAccess();
  const cacheRef = useRef({}); // secretsCache par catégorie
  const [currentCat, setCurrentCat] = useState(CATS[0]);
  const [list, setList] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [currentSecret, setCurrentSecret] = useState(null);
  const [loadingSecret, setLoadingSecret] = useState(false);
  const bootRef = useRef(false);

  const loadSecrets = useCallback(async (catId) => {
    if (cacheRef.current[catId]) {
      setList(cacheRef.current[catId]);
      return cacheRef.current[catId];
    }
    setLoadingList(true);
    try {
      const { items } = await apiPost('list-content', { kind: 'secret', cat: catId });
      const mapped = (items || []).map((val) => ({
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
    async (catId, key) => {
      setLoadingSecret(true);
      try {
        const { item } = await apiPost('get-content', { kind: 'secret', cat: catId, key });
        if (!item) throw new Error('Secret introuvable.');
        item.faida = item.faida || item.title || item.titre || '';
        item.sirr = item.sirr || item.content || '';
        item.img = item.img || item.image || null;
        setCurrentSecret({ catId, key, data: item });
      } catch (e) {
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
    async (catId, key) => {
      const ok = await ensureAccess();
      if (ok) fetchDetail(catId, key);
    },
    [ensureAccess, fetchDetail]
  );

  const switchCat = (cat) => {
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

  return (
    <div className="container">
      <Link href="/" className="back-btn">
        ← Retour
      </Link>

      <div className="glass-panel">
        <div className={'asrar-wrap' + (inDetail ? ' detail-mode' : '')}>
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

          <div className="asrar-main">
            {inDetail ? (
              <SecretDetail secret={currentSecret} onBack={() => setCurrentSecret(null)} />
            ) : (
              <div className="secrets-list">
                {loadingList ? (
                  <div className="loader" />
                ) : list.length === 0 ? (
                  <p style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>Aucun secret trouvé.</p>
                ) : (
                  list.map((item) => (
                    <div
                      key={item.key}
                      className={'secret-card' + (item.img ? ' has-cover' : '')}
                      onClick={() => openSecret(currentCat.id, item.key)}
                    >
                      <div className="secret-thumb">
                        {item.img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={optimImg(item.img, 400)}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          '📜'
                        )}
                      </div>
                      <div className="secret-title">{item.faida}</div>
                    </div>
                  ))
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
