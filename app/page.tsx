'use client';
// Page d'accueil = Marché Mystique (décision produit : le module le plus
// utilisé devient la porte d'entrée de l'app). Le tableau de bord — la liste
// des autres modules — est déplacé sur /menu, accessible depuis la
// navigation fixe en bas de page (compte/thème/déconnexion ont suivi sur
// /menu, cf. app/menu/page.tsx). Port de marche.html/marche.js en React.
// Produits (via /api/list-content kind=product), vendeurs reconstruits depuis
// les métadonnées, tri par popularité, modale produit et boutique vendeur.
// Recherche (matchesSearch) et filtre par catégorie (CHAINS, lib/market.js)
// au-dessus de la liste des vendeurs puis des produits — réintroduits par
// une revue design ultérieure après avoir été volontairement retirés lors
// d'un nettoyage antérieur (voir git blame) : cette fois demandés
// explicitement comme outils de découverte d'un vrai marketplace.
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
import { Search, Package, Heart, MessageCircle, Crown } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { apiPost } from '@/lib/api';
import { deepLink, cleanUrl } from '@/lib/share';
import { vendorKey, emailVendorKey, safeKey, formatCount, extractVendors, matchesSearch, displayProductName, CHAINS } from '@/lib/market';
import { avgStars } from '@/lib/reviews';
import { optimImg } from '@/lib/img';
import SmartImageUntyped from '@/components/SmartImage';
import { StarRatingDisplay } from '@/components/StarRating';
import { useHistoryClose } from '@/components/useHistoryClose';
import { useProgressiveList } from '@/components/useProgressiveList';
import { useToast } from '@/components/useToast';
import ProductModal from './marche/ProductModal';
import VendorShop from './marche/VendorShop';
import ProductPrice from './marche/ProductPrice';

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
  liked?: boolean; // l'utilisateur courant a-t-il mis ce produit en favori ?
}

// Engagement d'un produit : likes + commentaires — le critère de tri de
// « Produits populaires » (demandé : « triée par engagement décroissant »).
const engagement = (pop: Record<string, PopulariteEntry>, key: string) =>
  (pop[key]?.likes || 0) + (pop[key]?.comments || 0);

// Libellé d'une catégorie (CHAINS, lib/market.js) : première lettre en capitale.
const chainLabel = (c?: string) => (c ? c.charAt(0).toUpperCase() + c.slice(1) : '');

export default function Home() {
  const { notify, toast } = useToast();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allVendors, setAllVendors] = useState<Vendor[]>([]);
  const [popularite, setPopularite] = useState<Record<string, PopulariteEntry>>({});
  // Classement du carrousel : instantané pris au CHARGEMENT de la popularité.
  // Un favori posé depuis une carte met à jour ses compteurs (popularite) mais
  // pas ce classement — sinon la carte sauterait ailleurs sous le doigt.
  const [rankPop, setRankPop] = useState<Record<string, PopulariteEntry>>({});
  const [vendorLikes, setVendorLikes] = useState<Record<string, { count: number; liked: boolean }>>({});
  const [vendorReviews, setVendorReviews] = useState<Record<string, { avg: number; count: number }>>({});
  const [modalProduct, setModalProduct] = useState<any>(null);
  const [vendorShopId, setVendorShopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({}); // { [productKey]: true } — image indisponible → repli 🔮
  const markImgError = useCallback((key: string) => setImgErrors((prev) => (prev[key] ? prev : { ...prev, [key]: true })), []);
  const bootRef = useRef(false);
  // Recherche + catégorie (revue design, point 5) : réintroduites après avoir
  // été volontairement retirées lors d'un précédent nettoyage (voir
  // l'en-tête du fichier, git blame) — cette fois demandées explicitement
  // comme « outils fondamentaux de découverte » d'un marketplace. Purement
  // client (filtre sur allProducts déjà chargé), aucun nouvel appel réseau.
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(''); // '' = Tous

  // — Popularité (likes + commentaires + achats) : chargée après l'affichage —
  // via /api/social (HTTPS, Admin SDK), pas le SDK client RTDB (get() direct
  // depuis le navigateur) — voir pages/api/social.js pour l'historique : sur
  // certains réseaux ce canal restait bloqué en silence, laissant les cartes
  // produit sans likes/commentaires alors que le reste de la page (la liste
  // elle-même, via /api/list-content) s'affichait normalement.
  //
  // UN SEUL essai raté ici (délai réseau, fonction froide — apiPost n'a AUCUN
  // retry intégré, cf. lib/api.js) laissait `popularite` à `{}` pour le reste
  // de la session : `filtered` (plus bas) calcule alors un score de 0 pour
  // TOUS les produits, et son tri retombe silencieusement sur la seule date
  // — le tri par popularité semble avoir « disparu », sans la moindre erreur
  // visible, jusqu'au prochain rechargement complet de la page. Un second
  // essai après un court délai suffit à s'en remettre dans l'immense
  // majorité des cas (même logique que le reste de l'app face à un réseau
  // qui peut rester bloqué en silence — cf. lib/rouwhania.js).
  const loadPopularite = useCallback(async (products: Product[], attempt = 0) => {
    try {
      const { likes, comments: coms, orders } = await apiPost('social', { action: 'market-popularity' });
      const uid = auth.currentUser?.uid;
      const pop: Record<string, PopulariteEntry> = {};
      products.forEach((p) => {
        const productLikes = likes[p._key] || {};
        pop[p._key] = {
          likes: Object.keys(productLikes).length,
          comments: Object.keys(coms[p._key] || {}).length,
          orders: Number(orders[p._key] || 0),
          liked: !!(uid && productLikes[uid]),
        };
      });
      setPopularite(pop);
      setRankPop(pop);
    } catch {
      if (attempt < 1) setTimeout(() => loadPopularite(products, attempt + 1), 3000);
    }
  }, []);

  // — Likes des boutiques — même garde-fou (un seul retry) que ci-dessus,
  // pour la même raison (apiPost sans retry intégré).
  const loadVendorLikes = useCallback(async (vendors: Vendor[], attempt = 0) => {
    try {
      const uid = auth.currentUser?.uid;
      const { vendorLikes: val, vendorComments } = await apiPost('social', { action: 'vendor-likes' });
      const out: Record<string, { count: number; liked: boolean }> = {};
      const reviews: Record<string, { avg: number; count: number }> = {};
      vendors.forEach((v) => {
        const k = safeKey(v.id);
        const entry = val[k] || {};
        out[k] = { count: Object.keys(entry).length, liked: !!(uid && entry[uid]) };
        reviews[k] = avgStars((vendorComments && vendorComments[k]) || {});
      });
      setVendorLikes(out);
      setVendorReviews(reviews);
    } catch {
      if (attempt < 1) setTimeout(() => loadVendorLikes(vendors, attempt + 1), 3000);
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

  // Favori d'un produit depuis sa carte : même écriture que le cœur de la
  // fiche produit (ProductModal → useSocial → /api/social toggle-like).
  // Mise à jour optimiste ; la réponse du serveur fait foi ensuite.
  const toggleProductLike = (key: string, e: React.MouseEvent) => {
    e.stopPropagation(); // la carte, elle, ouvre la fiche produit
    const was = !!popularite[key]?.liked;
    setPopularite((prev) => {
      const cur = prev[key] || { likes: 0, comments: 0 };
      return { ...prev, [key]: { ...cur, liked: !was, likes: Math.max(0, cur.likes + (was ? -1 : 1)) } };
    });
    apiPost('social', { cat: 'product', key, action: 'toggle-like' })
      .then((data: any) =>
        setPopularite((prev) => ({
          ...prev,
          [key]: { ...(prev[key] || { likes: 0, comments: 0 }), liked: !!data.liked, likes: Number(data.likeCount) || 0 },
        }))
      )
      .catch(() => loadPopularite(allProducts));
  };

  // Reconnaît automatiquement « sa » boutique dans la liste des vendeurs :
  // vendorKey() (lib/market.js) vaut le vendorKey calculé côté serveur à
  // partir de l'email (jamais l'email en clair, retiré par /api/list-content) —
  // repli sur l'uid pour les produits sans email (anciens formats).
  const isOwnVendor = useCallback((v: Vendor) => {
    const me = auth.currentUser;
    if (!me) return false;
    return (!!me.email && v.id === emailVendorKey(me.email)) || v.id === me.uid;
  }, []);

  // Filtrés par recherche + catégorie, puis triés par ENGAGEMENT décroissant
  // (likes + commentaires), les plus récents d'abord à engagement égal.
  const filtered = useMemo(() => {
    return allProducts
      .filter((p) => matchesSearch(p.produit, search))
      .filter((p) => !category || p.chain === category)
      .sort((a, b) => {
        const d = engagement(rankPop, b._key) - engagement(rankPop, a._key);
        return d !== 0 ? d : Number(b.updatedAt || 0) - Number(a.updatedAt || 0);
      });
  }, [allProducts, rankPop, search, category]);

  // Rendu progressif : la grille produit ne monte plus toutes ses cartes
  // (chacune avec son image) dans la même frame.
  const { visible: visibleProducts, sentinelRef, hasMore } = useProgressiveList(filtered);

  const modalVendor = modalProduct ? allVendors.find((v) => v.id === vendorKey(modalProduct)) : null;
  const shopVendor = vendorShopId ? allVendors.find((v) => v.id === vendorShopId) : null;
  const shopProducts = vendorShopId ? allProducts.filter((p) => vendorKey(p) === vendorShopId) : [];

  // `allProducts` n'est chargé QU'UNE FOIS au montage (boot ci-dessus) : sans
  // ce rafraîchissement, un produit ajouté par N'IMPORTE QUEL vendeur depuis
  // (y compris par l'utilisateur lui-même, via /boutique, dans un onglet ou
  // une visite précédente de CETTE session) resterait invisible dans une
  // boutique tant que la page Marché n'est pas rechargée en dur — on le
  // recharge donc à chaque fois qu'on ENTRE dans une boutique, pour que ses
  // derniers produits y apparaissent vraiment.
  const openVendorShop = useCallback((id: string) => {
    setVendorShopId(id);
    (async () => {
      try {
        const { items } = await apiPost('list-content', { kind: 'product' });
        const products: Product[] = (items || []).map((v: any) => ({ _key: v._key, ...v }));
        setAllProducts(products);
        setAllVendors(extractVendors(products));
      } catch {
        // Best-effort : la liste déjà chargée (potentiellement périmée) reste affichée.
      }
    })();
  }, []);

  const closeVendorShop = useCallback(() => setVendorShopId(null), []);
  // Backpress Android : ferme la fiche boutique (pas de vraie navigation de page ici).
  const goBackFromShop = useHistoryClose(!!shopVendor, closeVendorShop);

  return (
    <div className="container market-page">
      {shopVendor ? (
        <VendorShop
          vendor={shopVendor}
          products={shopProducts}
          isOwn={isOwnVendor(shopVendor)}
          onBack={goBackFromShop}
          onOpenProduct={(key: string) => gatedOpenProduct(key)}
        />
      ) : (
        <div className="glass-panel">
          {/* En-tête : titre + sous-titre, et l'icône colis (« Mes commandes »)
              à droite — seul accès aux commandes depuis cet écran. */}
          <header className="market-header">
            <div className="market-heading">
              <h1 className="market-title">Marché ASRAR PRO</h1>
              <p className="market-subtitle">Produits spirituels et boutiques de confiance</p>
            </div>
            <Link href="/commandes" className="market-orders-icon" aria-label="Mes commandes" title="Mes commandes">
              <Package size={22} strokeWidth={2} aria-hidden="true" />
            </Link>
          </header>

          {/* Recherche + catégories — purement client (matchesSearch, CHAINS). */}
          <div className="market-search-box">
            <Search size={18} strokeWidth={2} aria-hidden="true" />
            <input
              type="search"
              className="market-search-input"
              placeholder="Rechercher un produit..."
              aria-label="Rechercher un produit"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="market-categories" role="tablist" aria-label="Filtrer par catégorie">
            <button
              type="button"
              role="tab"
              aria-selected={category === ''}
              className={'market-cat-pill' + (category === '' ? ' active' : '')}
              onClick={() => setCategory('')}
            >
              Tous
            </button>
            {CHAINS.map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={category === c}
                className={'market-cat-pill' + (category === c ? ' active' : '')}
                onClick={() => setCategory(c)}
              >
                {chainLabel(c)}
              </button>
            ))}
          </div>

          <section className="market-section" aria-labelledby="mk-vendors-title">
            <h2 id="mk-vendors-title" className="market-section-title">Boutiques populaires</h2>
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
                          sizes="48px"
                          style={{ objectFit: 'cover' }}
                          onError={(e: any) => (e.currentTarget.style.display = 'none')}
                        />
                      ) : (
                        '🔮'
                      )}
                    </div>
                    <div className="vendor-info">
                      {own && <div className="vendor-you-badge">Votre boutique</div>}
                      <div className="vendor-name">{v.name}</div>
                      <div className="vendor-specialty">{v.specialty}</div>
                      <div className="vendor-meta-row">
                        {(() => {
                          const r = vendorReviews[safeKey(v.id)];
                          return r && r.count > 0 ? <StarRatingDisplay value={r.avg} count={r.count} size="0.7rem" numeric /> : null;
                        })()}
                        {!own && (
                          // Pas de <button> sur sa propre carte : elle devient un <Link>
                          // (bouton dans un lien = HTML invalide), et « aimer sa propre
                          // boutique » n'a pas de sens.
                          <button
                            type="button"
                            className={'vendor-like' + (l.liked ? ' liked' : '')}
                            onClick={(e) => toggleVendorLike(v.id, e)}
                            aria-label={l.liked ? 'Ne plus aimer cette boutique' : 'Aimer cette boutique'}
                            aria-pressed={l.liked}
                          >
                            <Heart size={12} strokeWidth={2.2} fill={l.liked ? 'currentColor' : 'none'} aria-hidden="true" />
                            <span>{formatCount(l.count)}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                );
                // Sa propre boutique ouvre /boutique (gestion) plutôt que la vitrine.
                return own ? (
                  <Link key={v.id} href="/boutique" className="vendor-card">
                    {inner}
                  </Link>
                ) : (
                  <div key={v.id} className="vendor-card" role="button" tabIndex={0} onClick={() => openVendorShop(v.id)}
                    onKeyDown={(e) => e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openVendorShop(v.id))}>
                    {inner}
                  </div>
                );
              })}
              {!loading && !allVendors.some(isOwnVendor) && (
                <Link href="/boutique" className="vendor-card vendor-card-add">
                  <div className="vendor-avatar">＋</div>
                  <div className="vendor-info">
                    <div className="vendor-name">Ouvrir ma boutique</div>
                    <div className="vendor-specialty">Vendez vos produits</div>
                  </div>
                </Link>
              )}
            </div>
          </section>

          <section className="market-section" aria-labelledby="mk-products-title">
            <h2 id="mk-products-title" className="market-section-title">Produits populaires</h2>
            {/* Carrousel horizontal trié par engagement (likes + commentaires,
                voir `filtered`) : le premier porte le badge « Plus populaire »
                dès qu'il a un engagement réel (jamais sur une liste à zéro). */}
            <div className="prod-scroll">
              {loading ? (
                <>
                  <div className="skeleton" />
                  <div className="skeleton" />
                  <div className="skeleton" />
                </>
              ) : error ? (
                <p className="prod-empty">
                  Erreur de chargement des produits.
                  <br />
                  <small>{error}</small>
                </p>
              ) : filtered.length === 0 ? (
                <p className="prod-empty">Aucun produit trouvé.</p>
              ) : (
                <>
                  {visibleProducts.map((p, index) => {
                    const vendor = allVendors.find((v) => v.id === vendorKey(p));
                    const s = popularite[p._key] || { likes: 0, comments: 0, liked: false };
                    const top = index === 0 && engagement(rankPop, p._key) > 0;
                    const name = displayProductName(p.produit) || 'Produit';
                    return (
                      <article
                        key={p._key}
                        className="prod-card"
                        role="button"
                        tabIndex={0}
                        aria-label={name}
                        onClick={() => gatedOpenProduct(p._key)}
                        // Seulement quand la CARTE a le focus : Entrée sur le cœur
                        // (bouton enfant) ne doit pas aussi ouvrir la fiche.
                        onKeyDown={(e) => e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), gatedOpenProduct(p._key))}
                      >
                        <div className="prod-media">
                          {p.Image && !imgErrors[p._key] ? (
                            <SmartImage
                              src={optimImg(p.Image, 400)}
                              alt=""
                              fill
                              sizes="180px"
                              style={{ objectFit: 'cover' }}
                              onError={() => markImgError(p._key)}
                            />
                          ) : (
                            <span className="prod-img-placeholder" role="img" aria-label="Image indisponible">🖼️</span>
                          )}
                          {top && (
                            <span className="prod-top-badge">
                              <Crown size={12} strokeWidth={2.4} aria-hidden="true" /> Plus populaire
                            </span>
                          )}
                          <button
                            type="button"
                            className={'prod-fav' + (s.liked ? ' liked' : '')}
                            onClick={(e) => toggleProductLike(p._key, e)}
                            aria-label={s.liked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                            aria-pressed={!!s.liked}
                          >
                            <Heart size={18} strokeWidth={2.2} fill={s.liked ? 'currentColor' : 'none'} aria-hidden="true" />
                          </button>
                        </div>
                        <div className="prod-body">
                          {/* Casse normalisée à l'affichage seulement (displayProductName). */}
                          <h3 className="prod-name">{name}</h3>
                          <ProductPrice prix={p.Prix} devise={p.devise} />
                          <div className="prod-vendor-line">
                            <span>{vendor?.name || 'Boutique'}</span>
                            {vendor?.verified && <span className="verified-badge" title="Boutique vérifiée" aria-label="Boutique vérifiée">✔</span>}
                          </div>
                          <div className="prod-meta">
                            {p.chain ? <span className="prod-chain">{chainLabel(p.chain)}</span> : <span />}
                            <span className="prod-stats" aria-label={`${s.likes} j'aime, ${s.comments} commentaires`}>
                              <span><Heart size={12} strokeWidth={2.2} aria-hidden="true" /> {formatCount(s.likes)}</span>
                              <span><MessageCircle size={12} strokeWidth={2.2} aria-hidden="true" /> {formatCount(s.comments)}</span>
                            </span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                  {hasMore && <div ref={sentinelRef} className="load-sentinel" aria-hidden />}
                </>
              )}
            </div>
          </section>

          {/* Seul appel à l'action en bas de page : un grand bouton qui mène au
              menu principal (autres modules, compte, thème…). Pas de barre de
              navigation basse. */}
          <div className="market-cta">
            <Link href="/menu" className="market-cta-btn">
              Commencer
            </Link>
          </div>
        </div>
      )}

      {modalProduct && (
        <ProductModal
          product={modalProduct}
          vendor={modalVendor}
          onClose={() => setModalProduct(null)}
          onVisitShop={openVendorShop}
        />
      )}

      {toast}
    </div>
  );
}
