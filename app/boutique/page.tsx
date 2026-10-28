'use client';
// Module « Ma Boutique » — port de boutique.html/boutique.js en React.
// Flux : (1) pas vendeur actif → demande d'ouverture via WhatsApp ;
//        (2) vendeur actif → édition de la boutique + CRUD produits via /api/shop.
// Toutes les écritures passent par le serveur (Admin SDK) : le client n'impose
// jamais l'uid/email — ils viennent du jeton vérifié côté serveur.
//
// TypeScript (batch 4/7, cf. tsconfig.json) : Seller/Product/Stats sont des
// types locaux reflétant la forme réellement manipulée ici (réponses de
// /api/shop, cf. pages/api/shop.js). ProductForm.js et SmartImage.js/
// Spinner.js restent en .js (composants partagés, hors scope de ce batch) —
// mêmes principes que dans les batches précédents (#114, #116, #118).
import './boutique.css';
import ModalUntyped from '@/components/Modal';
import ViewState from '@/components/ViewState';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiPost } from '@/lib/api';
import { uploadImage } from '@/lib/cloudinary';
import { optimImg } from '@/lib/img';
import SmartImageUntyped from '@/components/SmartImage';
import { openAccess } from '@/lib/whatsapp';
import { formatCount } from '@/lib/market';
import { useToast } from '@/components/useToast';
import SpinnerUntyped from '@/components/Spinner';
import ProductForm from './ProductForm';

const Modal = ModalUntyped as any;
const SmartImage = SmartImageUntyped as any;
const Spinner = SpinnerUntyped as any;

type View = 'loading' | 'gate' | 'shop' | 'error';

interface Seller {
  email?: string;
  expiresAt?: number;
  shop?: { name?: string; description?: string; phone?: string; logo?: string };
  [k: string]: any;
}

interface Product {
  _key: string;
  Image?: string;
  produit?: string;
  Prix?: number;
  devise?: string;
  chain?: string;
  [k: string]: any;
}

interface Stats {
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalOrders: number;
  perProduct: Record<string, { views: number; likes: number; comments: number; orders: number }>;
}

const PLANS = [
  { id: 'boutique_1m', dur: '1 Mois', price: '10 000' },
  { id: 'boutique_3m', dur: '3 Mois', price: '25 000', best: true, badge: 'Économique' },
];

export default function BoutiquePage() {
  const { notify, toast } = useToast();
  const [savingShop, setSavingShop] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [view, setView] = useState<View>('loading');
  const [seller, setSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  // Champs de la fiche boutique
  const [shopName, setShopName] = useState('');
  const [shopDesc, setShopDesc] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({}); // { [productKey]: true } — image indisponible → repli 🔮
  const markImgError = useCallback((key: string) => setImgErrors((prev) => (prev[key] ? prev : { ...prev, [key]: true })), []);

  // Formulaire produit (null = fermé)
  const [formProduct, setFormProduct] = useState<Product | null | undefined>(undefined); // undefined=fermé, null=ajout, obj=édition

  // Statistiques (propriétaire seulement) : vues/likes/commentaires/commandes
  const [stats, setStats] = useState<Stats | null>(null);

  const bootRef = useRef(false);

  const loadStatus = useCallback(async () => {
    setView('loading');
    try {
      const data = await apiPost('shop', { action: 'me' });
      if (data.active) {
        const shop = (data.seller && data.seller.shop) || {};
        setSeller(data.seller);
        setProducts(data.products || []);
        setShopName(shop.name || '');
        setShopDesc(shop.description || '');
        setShopPhone(shop.phone || '');
        setLogoFile(null);
        setLogoPreview(shop.logo || '');
        setView('shop');
      } else {
        setView('gate');
      }
    } catch (e: any) {
      setView('error');
    }
  }, []);

  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    // Compat : nettoie d'anciens ?token=/?canceled= d'URL (plus de paiement en ligne).
    try {
      const params = new URLSearchParams(location.search);
      if (params.has('token') || params.has('canceled')) {
        history.replaceState({}, document.title, location.pathname);
      }
    } catch {}
    loadStatus();
  }, [loadStatus]);

  // Statistiques : agrégées côté serveur (Admin SDK, api/shop.js action="stats")
  // — pas de lecture RTDB directe côté client, donc aucune dépendance à des
  // règles de sécurité pour un nœud comme views/product.
  useEffect(() => {
    if (view !== 'shop' || products.length === 0) {
      setStats(null);
      return undefined;
    }
    let cancelled = false;
    apiPost('shop', { action: 'stats' })
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        /* statistiques non bloquantes */
      });
    return () => {
      cancelled = true;
    };
  }, [products, view]);

  const souscrire = (planId: string) => {
    const email = seller?.email;
    openAccess({ planId, email, section: 'Boutique vendeur (Marché)' });
  };

  const onLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  useEffect(() => () => { if (logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview); }, [logoPreview]);

  const saveShop = async () => {
    if (savingShop) return;
    if (!shopName.trim()) {
      notify('Le nom de la boutique est requis.');
      return;
    }
    setSavingShop(true); setActionError('');
    try {
      let logoUrl;
      if (logoFile) logoUrl = await uploadImage(logoFile, 'shop_logos');
      await apiPost('shop', { action: 'save-shop', shop: { name: shopName.trim(), description: shopDesc.trim(), phone: shopPhone.trim() }, logoUrl });
      notify('✅ Boutique enregistrée.');
      await loadStatus();
    } catch (e: any) {
      setActionError('La boutique n’a pas été enregistrée. Vos modifications sont conservées ; réessayez.');
    } finally { setSavingShop(false); }
  };

  const deleteProduct = async () => {
    if (!deletingKey || deleteBusy) return;
    setDeleteBusy(true); setActionError('');
    try {
      await apiPost('shop', { action: 'delete-product', key: deletingKey });
      setDeletingKey(null);
      await loadStatus();
    } catch {
      setActionError('La suppression n’a pas été confirmée. Le produit est conservé ; réessayez.');
    } finally { setDeleteBusy(false); }
  };

  const expiry =
    seller && typeof seller.expiresAt === 'number'
      ? new Date(seller.expiresAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
      : null;

  return (
    <div className="container boutique-page">
      <Link href="/" className="back-btn" aria-label="Retour au marché">
        ← Marché
      </Link>

      <div className="glass-panel">
        <h1 className="module-title">🏪 Ma Boutique</h1>
        <p className="subtitle">Vendez vos produits sur le Marché Mystique.</p>

        {view === 'loading' && (
          <div className="bq-loading">
            <Spinner size={20} /> Chargement…
          </div>
        )}

        {view === 'error' && <ViewState kind="error" title="Boutique indisponible" description="Vos informations n’ont pas pu être chargées. Réessayez dans un instant."
          action={<button type="button" className="view-button" onClick={loadStatus}>Réessayer</button>} />}
        {actionError && !deletingKey && <p role="alert" className="view-feedback view-feedback-error">{actionError}</p>}

        {view === 'gate' && (
          <div>
            <p className="bq-intro">
              Pour ouvrir votre boutique, choisissez une formule. Chaque boutique est liée à votre compte Google (un
              compte = une boutique unique).
            </p>
            <div className="bq-plans">
              {PLANS.map((p) => (
                <div key={p.id} className={'bq-plan' + (p.best ? ' best' : '')}>
                  {p.badge && <span className="bq-badge">{p.badge}</span>}
                  <div className="bq-plan-dur">{p.dur}</div>
                  <div className="bq-plan-price">
                    {p.price} <small>FCFA</small>
                  </div>
                  <button type="button" className="bq-plan-btn" onClick={() => souscrire(p.id)} aria-label={"Choisir la formule " + p.dur}>Choisir</button>
                </div>
              ))}
            </div>
            <p className="bq-note">
              💬 Cliquez sur une formule pour envoyer votre demande via WhatsApp. L'administration activera votre
              boutique.
            </p>
          </div>
        )}

        {view === 'shop' && (
          <div>
            <div className="bq-status">
              <span className="bq-dot" /> Boutique active{expiry && ' · expire le ' + expiry}
              <button type="button" className="bq-renew" onClick={() => setView('gate')}>Prolonger</button>
            </div>

            {stats && (
              <div className="bq-stats">
                <h3>📊 Statistiques de la boutique</h3>
                <div className="bq-stats-grid">
                  <div className="bq-stat">
                    <span className="bq-stat-num">{formatCount(stats.totalViews)}</span>
                    <span className="bq-stat-label">👁 Vues</span>
                  </div>
                  <div className="bq-stat">
                    <span className="bq-stat-num">{formatCount(stats.totalLikes)}</span>
                    <span className="bq-stat-label">❤️ Likes</span>
                  </div>
                  <div className="bq-stat">
                    <span className="bq-stat-num">{formatCount(stats.totalComments)}</span>
                    <span className="bq-stat-label">💬 Commentaires</span>
                  </div>
                  <div className="bq-stat">
                    <span className="bq-stat-num">{formatCount(stats.totalOrders)}</span>
                    <span className="bq-stat-label">🛍️ Commandes confirmées</span>
                  </div>
                </div>
              </div>
            )}

            <h3>Informations de la boutique</h3>
            <div className="bq-form">
              <label>
                Logo de la boutique
                <input disabled={savingShop} type="file" accept="image/*" onChange={onLogoChange} />
                <div className="bq-logo-preview">
                  {logoPreview ? (
                    <SmartImage src={logoPreview} alt="" fill sizes="110px" style={{ objectFit: 'cover' }} />
                  ) : (
                    <span>Aucun logo</span>
                  )}
                </div>
              </label>
              <label>
                Nom de la boutique
                <input type="text" maxLength={80} placeholder="Ex : Boutique Al-Baraka" disabled={savingShop} value={shopName} onChange={(e) => setShopName(e.target.value)} />
              </label>
              <label>
                Description
                <textarea maxLength={600} rows={3} placeholder="Présentez votre boutique…" disabled={savingShop} value={shopDesc} onChange={(e) => setShopDesc(e.target.value)} />
              </label>
              <label>
                Téléphone / WhatsApp
                <input type="tel" maxLength={20} placeholder="221770000000" disabled={savingShop} value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} />
              </label>
              <button type="button" className="bq-btn" onClick={saveShop} disabled={savingShop}>
                {savingShop ? "Enregistrement…" : "Enregistrer la boutique"}
              </button>
            </div>

            <div className="bq-products-head">
              <h3>Mes produits ({products.length})</h3>
              <button className="bq-btn small" onClick={() => setFormProduct(null)}>
                ＋ Ajouter un produit
              </button>
            </div>
            <div className="bq-products">
              {products.length === 0 ? (
                <p className="bq-empty">Aucun produit. Cliquez sur « Ajouter un produit ».</p>
              ) : (
                products.map((p) => (
                  <div key={p._key} className="bq-prod">
                    <div className="bq-prod-img">
                      {p.Image && !imgErrors[p._key] ? (
                        <SmartImage
                          src={optimImg(p.Image, 300)}
                          alt=""
                          fill
                          sizes="56px"
                          style={{ objectFit: 'cover' }}
                          onError={() => markImgError(p._key)}
                        />
                      ) : (
                        '🔮'
                      )}
                    </div>
                    <div className="bq-prod-body">
                      <div className="bq-prod-name">{p.produit || 'Produit'}</div>
                      <div className="bq-prod-price">
                        {Number(p.Prix || 0).toLocaleString('fr-FR')} {p.devise || 'FCFA'}
                      </div>
                      <div className="bq-prod-chain">{p.chain || ''}</div>
                      {stats && stats.perProduct[p._key] && (
                        <div className="bq-prod-stats">
                          👁 {formatCount(stats.perProduct[p._key].views)} · ❤️ {formatCount(stats.perProduct[p._key].likes)} · 💬{' '}
                          {formatCount(stats.perProduct[p._key].comments)} · 🛍️ {formatCount(stats.perProduct[p._key].orders)}
                        </div>
                      )}
                    </div>
                    <div className="bq-prod-actions">
                      <button type="button" aria-label={"Modifier « " + (p.produit || "Produit") + " »"} onClick={() => setFormProduct(p)}>✏️</button>
                      <button type="button" aria-label={"Supprimer « " + (p.produit || "Produit") + " »"} onClick={() => { setActionError(''); setDeletingKey(p._key); }}>🗑️</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {deletingKey && <Modal className="bq-modal-overlay open" onClose={deleteBusy ? undefined : () => setDeletingKey(null)} label="Supprimer le produit">
        <div className="bq-delete-dialog">
          <h2>Supprimer le produit ?</h2>
          <p>« {products.find((p) => p._key === deletingKey)?.produit || 'Produit'} » sera retiré du marché.</p>
          {actionError && <p role="alert" className="view-feedback view-feedback-error">{actionError}</p>}
          <div className="bq-delete-actions">
            <button type="button" className="view-button" onClick={() => setDeletingKey(null)} disabled={deleteBusy}>Conserver</button>
            <button type="button" className="view-button view-button-danger" onClick={deleteProduct} disabled={deleteBusy}>{deleteBusy ? 'Suppression…' : 'Supprimer'}</button>
          </div>
        </div>
      </Modal>}
      {formProduct !== undefined && (
        <ProductForm
          product={formProduct}
          notify={notify}
          onClose={() => setFormProduct(undefined)}
          onSaved={() => {
            setFormProduct(undefined);
            loadStatus();
          }}
        />
      )}

      <Link href="/commandes?vue=boutique" className="back-btn">Gérer les demandes et commandes reçues →</Link>
      {toast}
    </div>
  );
}
