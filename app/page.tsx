'use client';
// Page d'accueil = Marché Mystique (décision produit : le module le plus
// utilisé devient la porte d'entrée de l'app). Le tableau de bord — la liste
// des autres modules — est déplacé sur /menu, accessible via le grand bouton
// « ☰ Accéder au menu » en bas de page (compte/thème/déconnexion ont suivi
// sur /menu, cf. app/menu/page.tsx). Port de marche.html/marche.js en React.
// Produits (via /api/list-content kind=product), vendeurs reconstruits depuis
// les métadonnées, tri par popularité, modale produit et boutique vendeur.
// Volontairement épuré : pas de barre de recherche ni de filtre par
// catégorie — juste la liste des vendeurs puis les produits.
//
// NB : le panier de marche.js ciblait des éléments DOM absents du HTML (code
// mort) ; la commande réelle se fait par produit via WhatsApp. On porte donc
// le comportement effectif, sans panier.
//
// TypeScript (batch 4/7, dernière page du batch — cf. tsconfig.json) :
// Product/Vendor sont des types locaux reflétant la forme réellement
// manipulée ici (réponses de /api/list-content et lib/market.js).
// ProductModal.js, VendorShop.js, useHistoryClose.js, useProgressiveList.js
// et SmartImage.js restent en .js (composants/hooks partagés, hors scope de
// ce batch) — mêmes principes que dans les batches précédents (#114, #116,
// #118).
import './marche/marche.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { apiPost } from '@/lib/api';
import { deepLink, cleanUrl } from '@/lib/share';
import { vendorKey, safeKey, formatCount, formatPrice, extractVendors, scorePopularite } from '@/lib/market';
import { optimImg } from '@/lib/img';
import SmartImageUntyped from '@/components/SmartImage';
import { useHistoryClose } from '@/components/useHistoryClose';
import { useProgressiveList } from '@/components/useProgressiveList';
import { useToast } from '@/components/useToast';
import ProductModal from './marche/ProductModal';
import VendorShop from './marche/VendorShop';

const SmartImage = SmartImageUntyped as any;

interface Product {
  _key: string;
  Image?: string;
  produit?: string;
  Prix?: number;
  devise?: string;
  chain?: string;
  updatedAt?: number;
  [k: string]: any;
}

interface Vendor {
  id: string;
  name: string;
  specialty?: string;
  avatar?: string;
  verified?: boolean;
  [k: string]: any;
}

interface PopulariteEntry {
  likes: number;
  comments: number;
  orders?: number;
}

export default function Home() {
  const { notify, toast } = useToast();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allVendors, setAllVendors] = useState<Vendor[]>([]);
  const [popularite, setPopularite] = useState<Record<string, PopulariteEntry>>({});
  const [vendorLikes, setVendorLikes] = useState<Record<string, { count: number; liked: boolean }>>({});
  const [modalProduct, setModalProduct] = useState<any>(null);
  const [vendorShopId, setVendorShopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({}); // { [productKey]: true } — image indisponible → repli 🔮
  const markImgError = useCallback((key: string) => setImgErrors((prev) => (prev[key] ? prev : { ...prev, [key]: true })), []);
  const bootRef = useRef(false);

  // — Popularité (likes + commentaires + achats) : chargée après l'affichage —
  // via /api/social (HTTPS, Admin SDK), pas le SDK client RTDB (get() direct
  // depuis le navigateur) — voir pages/api/social.js pour l'historique : sur
  // certains réseaux ce canal restait bloqué en silence, laissant les cartes
  // produit sans likes/commentaires alors que le reste de la page (la liste
  // elle-même, via /api/list-content) s'affichait normalement.
  const loadPopularite = useCallback(async (products: Product[]) => {
    try {
      const { likes, comments: coms, orders } = await apiPost('social', { action: 'market-popularity' });
      const pop: Record<string, PopulariteEntry> = {};
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
  const loadVendorLikes = useCallback(async (vendors: Vendor[]) => {
    try {
      const uid = auth.currentUser?.uid;
      const { vendorLikes: val } = await apiPost('social', { action: 'vendor-likes' });
      const out: Record<string, { count: number; liked: boolean }> = {};
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
    async (key: string, products?: Product[]) => {
      const list = products || allProducts;
      const meta = list.find((p) => p._key === key);
      if (!meta) return;
      try {
        // Fiche complète (description + contacts vendeur). Auth seule.
        const { item } = await apiPost('get-content', { kind: 'product', key });
        setModalProduct({ ...meta, ...item, _key: key });
      } catch (e: any) {
        notify('Erreur : ' + (e.message || e));
      }
    },
    [allProducts, notify]
  );

  // Boot : charge produits, vendeurs, popularité, likes boutiques, deep link.
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    (async () => {
      try {
        const { items } = await apiPost('list-content', { kind: 'product' });
        const products: Product[] = (items || []).map((v: any) => ({ _key: v._key, ...v }));
        const vendors: Vendor[] = extractVendors(products);
        setAllProducts(products);
        setAllVendors(vendors);
        setLoading(false);
        loadPopularite(products);
        loadVendorLikes(vendors);

        const deep = deepLink();
        if (deep && deep.key) {
          cleanUrl();
          if (products.some((p) => p._key === deep.key)) gatedOpenProduct(deep.key, products);
          else notify("Ce produit n'est plus disponible.");
        }
      } catch (e: any) {
        setLoading(false);
        setError(e.message || 'Erreur de chargement des produits.');
      }
    })();
  }, [loadPopularite, loadVendorLikes, gatedOpenProduct, notify]);

  const toggleVendorLike = (vendorId: string, ev?: React.MouseEvent) => {
    if (ev) {
      ev.stopPropagation();
      ev.preventDefault();
    }
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const k = safeKey(vendorId);
    const etait = vendorLikes[k] && vendorLikes[k].liked;
    // Mise à jour optimiste, puis écriture (via /api/social — même raison que
    // loadPopularite/loadVendorLikes ci-dessus : plus de SDK client RTDB).
    setVendorLikes((prev) => ({
      ...prev,
      [k]: { count: Math.max(0, (prev[k]?.count || 0) + (etait ? -1 : 1)), liked: !etait },
    }));
    apiPost('social', { cat: 'vendor', key: k, action: 'toggle-like' }).catch(() => loadVendorLikes(allVendors));
  };

  // Reconnaît automatiquement « sa » boutique dans la liste des vendeurs :
  // vendorKey() (lib/market.js) vaut l'email du vendeur (repli sur l'uid).
  const isOwnVendor = useCallback((v: Vendor) => {
    const me = auth.currentUser;
    if (!me) return false;
    const email = me.email ? me.email.toLowerCase() : null;
    return v.id === email || v.id === me.uid;
  }, []);

  // Triés par popularité (achats > likes > commentaires, puis plus récents à
  // score égal) — plus de recherche ni de filtre par catégorie (retirés).
  const filtered = useMemo(() => {
    return allProducts.slice().sort((a, b) => {
      const d = scorePopularite(popularite, b._key) - scorePopularite(popularite, a._key);
      return d !== 0 ? d : Number(b.updatedAt || 0) - Number(a.updatedAt || 0);
    });
  }, [allProducts, popularite]);

  // Rendu progressif : la grille produit ne monte plus toutes ses cartes
  // (chacune avec son image) dans la même frame.
  const { visible: visibleProducts, sentinelRef, hasMore } = useProgressiveList(filtered);

  const modalVendor = modalProduct ? allVendors.find((v) => v.id === vendorKey(modalProduct)) : null;
  const shopVendor = vendorShopId ? allVendors.find((v) => v.id === vendorShopId) : null;
  const shopProducts = vendorShopId ? allProducts.filter((p) => vendorKey(p) === vendorShopId) : [];

  const closeVendorShop = useCallback(() => setVendorShopId(null), []);
  // Backpress Android : ferme la fiche boutique (pas de vraie navigation de page ici).
  const goBackFromShop = useHistoryClose(!!shopVendor, closeVendorShop);

  return (
    <div className="container">
      {shopVendor ? (
        <VendorShop
          vendor={shopVendor}
          products={shopProducts}
          onBack={goBackFromShop}
          onOpenProduct={(key: string) => gatedOpenProduct(key)}
        />
      ) : (
        <div className="glass-panel">
          <h2 className="market-title">Marché ASRAR PRO</h2>

          <div className="vendors-section">
            <div className="vendors-scroll">
              {loading ? (
                <>
                  <div className="vendor-skeleton" />
                  <div className="vendor-skeleton" />
                  <div className="vendor-skeleton" />
                </>
              ) : null}
              {allVendors.map((v) => {
                const l = vendorLikes[safeKey(v.id)] || { count: 0, liked: false };
                const own = isOwnVendor(v);
                const inner = (
                  <>
                    <div className="vendor-avatar">
                      {v.avatar ? (
                        <SmartImage
                          src={optimImg(v.avatar, 120)}
                          alt=""
                          fill
                          sizes="70px"
                          style={{ objectFit: 'cover' }}
                          onError={(e: any) => (e.currentTarget.style.display = 'none')}
                        />
                      ) : (
                        '🔮'
                      )}
                    </div>
                    {own && <div className="vendor-you-badge">Votre boutique</div>}
                    <div className="vendor-name">{v.name}</div>
                    <div className="vendor-specialty">{v.specialty}</div>
                    {!own && (
                      // Pas de <button> ici sur sa propre carte : elle devient un <Link>
                      // (imbriquer un bouton dans un lien est invalide en HTML), et « aimer
                      // sa propre boutique » n'a de toute façon pas de sens.
                      <button
                        className={'vendor-like' + (l.liked ? ' liked' : '')}
                        onClick={(e) => toggleVendorLike(v.id, e)}
                        aria-label="Aimer cette boutique"
                      >
                        <span>{l.liked ? '❤️' : '🤍'}</span> <span>{formatCount(l.count)}</span>
                      </button>
                    )}
                  </>
                );
                // Sa propre boutique est reconnue automatiquement (email/uid) : on
                // ouvre directement /boutique (gestion + ajout de produits) au lieu
                // de la vue vitrine en lecture seule des autres vendeurs.
                return own ? (
                  <Link key={v.id} href="/boutique" className="vendor-card" style={{ textDecoration: 'none' }}>
                    {inner}
                  </Link>
                ) : (
                  <div key={v.id} className="vendor-card" onClick={() => setVendorShopId(v.id)}>
                    {inner}
                  </div>
                );
              })}
              {!allVendors.some(isOwnVendor) && (
                <Link href="/boutique" className="vendor-card" style={{ textDecoration: 'none' }}>
                  <div className="vendor-avatar">➕</div>
                  <div className="vendor-name">Avoir une chaîne</div>
                  <div className="vendor-specialty">Ouvrez votre propre boutique</div>
                </Link>
              )}
            </div>
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
              <>
              {visibleProducts.map((p) => {
                const vendor = allVendors.find((v) => v.id === vendorKey(p));
                const s = popularite[p._key] || { likes: 0, comments: 0 };
                return (
                  <div key={p._key} className="prod-card" onClick={() => gatedOpenProduct(p._key)}>
                    {p.Image && !imgErrors[p._key] ? (
                      <div className="prod-img">
                        <SmartImage
                          src={optimImg(p.Image, 400)}
                          alt={p.produit || ''}
                          fill
                          sizes="220px"
                          style={{ objectFit: 'cover' }}
                          onError={() => markImgError(p._key)}
                        />
                      </div>
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
                            <div className="prod-vendor-avatar">
                              <SmartImage
                                src={optimImg(vendor.avatar, 80)}
                                alt=""
                                fill
                                sizes="24px"
                                style={{ objectFit: 'cover' }}
                                onError={(e: any) => (e.currentTarget.style.display = 'none')}
                              />
                            </div>
                          )}
                          <span>
                            {vendor.name} {vendor.verified && <span className="verified-badge">✔ Vérifié</span>}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {hasMore && <div ref={sentinelRef} className="load-sentinel" aria-hidden />}
              </>
            )}
          </div>

          <Link href="/menu" className="menu-cta-bottom">
            ☰ Accéder au menu
          </Link>
        </div>
      )}

      {modalProduct && (
        <ProductModal
          product={modalProduct}
          vendor={modalVendor}
          onClose={() => setModalProduct(null)}
          onVisitShop={(id: string) => setVendorShopId(id)}
        />
      )}

      {toast}
    </div>
  );
}
