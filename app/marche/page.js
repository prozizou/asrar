'use client';
// Module « Marché Mystique » — port de marche.html/marche.js en React.
// Produits (via /api/list-content kind=product), vendeurs reconstruits depuis
// les métadonnées, filtres/recherche, tri par popularité, modale produit et
// boutique vendeur.
//
// NB : le panier de marche.js ciblait des éléments DOM absents du HTML (code
// mort) ; la commande réelle se fait par produit via WhatsApp. On porte donc
// le comportement effectif, sans panier.
import './marche.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ref, get, set, remove } from 'firebase/database';
import { db, auth } from '@/lib/firebase';
import { apiPost } from '@/lib/api';
import { deepLink, cleanUrl } from '@/lib/share';
import { vendorKey, safeKey, formatCount, formatPrice, extractVendors, scorePopularite } from '@/lib/market';
import ProductModal from './ProductModal';
import VendorShop from './VendorShop';

export default function MarchePage() {
  const [allProducts, setAllProducts] = useState([]);
  const [allVendors, setAllVendors] = useState([]);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [popularite, setPopularite] = useState({});
  const [vendorLikes, setVendorLikes] = useState({});
  const [modalProduct, setModalProduct] = useState(null);
  const [vendorShopId, setVendorShopId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const bootRef = useRef(false);

  // — Popularité (likes + commentaires + achats) : chargée après l'affichage —
  const loadPopularite = useCallback(async (products) => {
    try {
      const [likesSnap, comsSnap, ordersSnap] = await Promise.all([
        get(ref(db, 'ratings/product')),
        get(ref(db, 'comments/product')),
        get(ref(db, 'orders_count')).catch(() => null),
      ]);
      const likes = likesSnap.val() || {};
      const coms = comsSnap.val() || {};
      const orders = (ordersSnap && ordersSnap.val()) || {};
      const pop = {};
      products.forEach((p) => {
        pop[p._key] = {
          likes: Object.keys(likes[p._key] || {}).length,
          comments: Object.keys(coms[p._key] || {}).length,
          orders: Number(orders[p._key] || 0),
        };
      });
      setPopularite(pop);
    } catch {
      /* bonus : ne bloque pas l'affichage */
    }
  }, []);

  // — Likes des boutiques —
  const loadVendorLikes = useCallback(async (vendors) => {
    try {
      const uid = auth.currentUser?.uid;
      const snap = await get(ref(db, 'ratings/vendor'));
      const val = snap.val() || {};
      const out = {};
      vendors.forEach((v) => {
        const k = safeKey(v.id);
        const entry = val[k] || {};
        out[k] = { count: Object.keys(entry).length, liked: !!(uid && entry[uid]) };
      });
      setVendorLikes(out);
    } catch {
      /* non bloquant */
    }
  }, []);

  const gatedOpenProduct = useCallback(
    async (key, products) => {
      const list = products || allProducts;
      const meta = list.find((p) => p._key === key);
      if (!meta) return;
      try {
        // Fiche complète (description + contacts vendeur). Auth seule.
        const { item } = await apiPost('get-content', { kind: 'product', key });
        setModalProduct({ _key: key, ...meta, ...item });
      } catch (e) {
        alert('Erreur : ' + (e.message || e));
      }
    },
    [allProducts]
  );

  // Boot : charge produits, vendeurs, popularité, likes boutiques, deep link.
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    (async () => {
      try {
        const { items } = await apiPost('list-content', { kind: 'product' });
        const products = (items || []).map((v) => ({ _key: v._key, ...v }));
        const vendors = extractVendors(products);
        setAllProducts(products);
        setAllVendors(vendors);
        setLoading(false);
        loadPopularite(products);
        loadVendorLikes(vendors);

        const deep = deepLink();
        if (deep && deep.key) {
          cleanUrl();
          if (products.some((p) => p._key === deep.key)) gatedOpenProduct(deep.key, products);
          else alert("Ce produit n'est plus disponible.");
        }
      } catch (e) {
        setLoading(false);
        setError(e.message || 'Erreur de chargement des produits.');
      }
    })();
  }, [loadPopularite, loadVendorLikes, gatedOpenProduct]);

  const toggleVendorLike = (vendorId, ev) => {
    if (ev) {
      ev.stopPropagation();
      ev.preventDefault();
    }
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const k = safeKey(vendorId);
    const etait = vendorLikes[k] && vendorLikes[k].liked;
    // Mise à jour optimiste, puis écriture.
    setVendorLikes((prev) => ({
      ...prev,
      [k]: { count: Math.max(0, (prev[k]?.count || 0) + (etait ? -1 : 1)), liked: !etait },
    }));
    const r = ref(db, `ratings/vendor/${k}/${uid}`);
    (etait ? remove(r) : set(r, 5)).catch(() => loadVendorLikes(allVendors));
  };

  const chains = useMemo(
    () => [...new Set(allProducts.map((p) => p.chain).filter(Boolean))].sort(),
    [allProducts]
  );

  // Liste filtrée + triée par popularité (achats > likes > commentaires,
  // puis plus récents à score égal).
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    let out = allProducts;
    if (activeFilter) out = out.filter((p) => p.chain === activeFilter);
    out = out.filter(
      (p) =>
        (p.produit || '').toLowerCase().includes(q) ||
        (p.chain || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.vendeur || '').toLowerCase().includes(q)
    );
    return out.slice().sort((a, b) => {
      const d = scorePopularite(popularite, b._key) - scorePopularite(popularite, a._key);
      return d !== 0 ? d : Number(b.updatedAt || 0) - Number(a.updatedAt || 0);
    });
  }, [allProducts, activeFilter, query, popularite]);

  const modalVendor = modalProduct ? allVendors.find((v) => v.id === vendorKey(modalProduct)) : null;
  const shopVendor = vendorShopId ? allVendors.find((v) => v.id === vendorShopId) : null;
  const shopProducts = vendorShopId ? allProducts.filter((p) => vendorKey(p) === vendorShopId) : [];

  return (
    <div className="container">
      <Link href="/" className="back-btn">
        ← Retour
      </Link>

      {shopVendor ? (
        <VendorShop
          vendor={shopVendor}
          products={shopProducts}
          onBack={() => setVendorShopId(null)}
          onOpenProduct={(key) => gatedOpenProduct(key)}
        />
      ) : (
        <div className="glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>🛒 Marché Mystique</h2>
            <Link
              href="/boutique"
              className="shop-link"
              style={{
                background: 'var(--accent)',
                color: 'var(--text-on-accent)',
                textDecoration: 'none',
                fontWeight: 700,
                padding: '8px 14px',
                borderRadius: 10,
                fontSize: '.85rem',
              }}
            >
              🏪 Ma boutique
            </Link>
          </div>
          <p className="subtitle">Produits ésotériques de nos praticiens certifiés</p>

          <div className="market-nav">
            <input
              type="text"
              className="search-bar"
              placeholder="🔍 Rechercher un produit..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {allVendors.length > 0 && (
            <div className="vendors-section">
              <h3>🌙 Nos praticiens et vendeurs certifiés</h3>
              <div className="vendors-scroll">
                {allVendors.map((v) => {
                  const l = vendorLikes[safeKey(v.id)] || { count: 0, liked: false };
                  return (
                    <div key={v.id} className="vendor-card" onClick={() => setVendorShopId(v.id)}>
                      <div className="vendor-avatar">
                        {v.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={v.avatar}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                          />
                        ) : (
                          '🔮'
                        )}
                      </div>
                      <div className="vendor-name">{v.name}</div>
                      <div className="vendor-specialty">{v.specialty}</div>
                      <button
                        className={'vendor-like' + (l.liked ? ' liked' : '')}
                        onClick={(e) => toggleVendorLike(v.id, e)}
                        aria-label="Aimer cette boutique"
                      >
                        <span>{l.liked ? '❤️' : '🤍'}</span> <span>{formatCount(l.count)}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="filters">
            <div className={'filter-tag' + (activeFilter === '' ? ' active' : '')} onClick={() => setActiveFilter('')}>
              Tous
            </div>
            {chains.map((chain) => (
              <div
                key={chain}
                className={'filter-tag' + (activeFilter === chain ? ' active' : '')}
                onClick={() => setActiveFilter(chain)}
              >
                {chain}
              </div>
            ))}
          </div>

          <div className="prod-grid">
            {loading ? (
              <>
                <div className="skeleton" />
                <div className="skeleton" />
                <div className="skeleton" />
                <div className="skeleton" />
              </>
            ) : error ? (
              <p style={{ color: '#888', textAlign: 'center', padding: 40, width: '100%' }}>
                Erreur de chargement des produits.
                <br />
                <small>{error}</small>
              </p>
            ) : filtered.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center', padding: 40, width: '100%' }}>Aucun produit trouvé.</p>
            ) : (
              filtered.map((p) => {
                const vendor = allVendors.find((v) => v.id === vendorKey(p));
                const s = popularite[p._key] || { likes: 0, comments: 0 };
                return (
                  <div key={p._key} className="prod-card" onClick={() => gatedOpenProduct(p._key)}>
                    {p.Image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="prod-img"
                        src={p.Image}
                        alt={p.produit || ''}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.outerHTML = '<div class="prod-img-placeholder">🔮</div>';
                        }}
                      />
                    ) : (
                      <div className="prod-img-placeholder">🔮</div>
                    )}
                    <div className="prod-body">
                      <div className="prod-name">{p.produit || 'Produit'}</div>
                      <div className="prod-price">{formatPrice(p.Prix, p.devise)}</div>
                      <div className="prod-chain">{p.chain || ''}</div>
                      <div className="prod-stats">
                        🤍 {formatCount(s.likes)} &nbsp; 💬 {formatCount(s.comments)}
                      </div>
                      {vendor && (
                        <div className="prod-vendor-line">
                          {vendor.avatar && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              className="prod-vendor-avatar"
                              src={vendor.avatar}
                              alt=""
                              onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                          )}
                          <span>
                            {vendor.name} {vendor.verified && <span className="verified-badge">✔ Vérifié</span>}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {modalProduct && (
        <ProductModal
          product={modalProduct}
          vendor={modalVendor}
          onClose={() => setModalProduct(null)}
          onVisitShop={(id) => setVendorShopId(id)}
        />
      )}
    </div>
  );
}
