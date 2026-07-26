'use client';
// Module « Ma Boutique » — port de boutique.html/boutique.js en React.
// Flux : (1) pas vendeur actif → demande d'ouverture via WhatsApp ;
//        (2) vendeur actif → édition de la boutique + CRUD produits via /api/shop.
// Toutes les écritures passent par le serveur (Admin SDK) : le client n'impose
// jamais l'uid/email — ils viennent du jeton vérifié côté serveur.
import './boutique.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiPost } from '@/lib/api';
import { uploadImage } from '@/lib/cloudinary';
import { optimImg } from '@/lib/img';
import { openAccess } from '@/lib/whatsapp';
import { useToast } from '@/components/useToast';
import ProductForm from './ProductForm';

const PLANS = [
  { id: 'boutique_1m', dur: '1 Mois', price: '10 000' },
  { id: 'boutique_3m', dur: '3 Mois', price: '25 000', best: true, badge: 'Économique' },
];

export default function BoutiquePage() {
  const { notify, toast } = useToast();
  const [view, setView] = useState('loading'); // loading | gate | shop | error
  const [errorMsg, setErrorMsg] = useState('');
  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);

  // Champs de la fiche boutique
  const [shopName, setShopName] = useState('');
  const [shopDesc, setShopDesc] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');

  // Formulaire produit (null = fermé)
  const [formProduct, setFormProduct] = useState(undefined); // undefined=fermé, null=ajout, obj=édition

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
    } catch (e) {
      setErrorMsg(e.message || String(e));
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

  const souscrire = (planId) => {
    const email = seller?.email;
    openAccess({ planId, email, section: 'Boutique vendeur (Marché)' });
  };

  const onLogoChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  const saveShop = async () => {
    if (!shopName.trim()) {
      notify('Le nom de la boutique est requis.');
      return;
    }
    try {
      let logoUrl;
      if (logoFile) logoUrl = await uploadImage(logoFile, 'shop_logos');
      await apiPost('shop', { action: 'save-shop', shop: { name: shopName.trim(), description: shopDesc.trim(), phone: shopPhone.trim() }, logoUrl });
      notify('✅ Boutique enregistrée.');
      await loadStatus();
    } catch (e) {
      notify('Erreur : ' + (e.message || e));
    }
  };

  const deleteProduct = async (key) => {
    if (!confirm('Supprimer ce produit ?')) return;
    try {
      await apiPost('shop', { action: 'delete-product', key });
      await loadStatus();
    } catch (e) {
      notify('Erreur : ' + (e.message || e));
    }
  };

  const expiry =
    seller && typeof seller.expiresAt === 'number'
      ? new Date(seller.expiresAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
      : null;

  return (
    <div className="container">
      <Link href="/marche" className="back-btn">
        ← Marché
      </Link>

      <div className="glass-panel">
        <h2>🏪 Ma Boutique</h2>
        <p className="subtitle">Vendez vos produits sur le Marché Mystique.</p>

        {view === 'loading' && <div className="bq-loading">Chargement…</div>}

        {view === 'error' && <p className="bq-error">Erreur : {errorMsg}</p>}

        {view === 'gate' && (
          <div>
            <p className="bq-intro">
              Pour ouvrir votre boutique, choisissez une formule. Chaque boutique est liée à votre compte Google (un
              compte = une boutique unique).
            </p>
            <div className="bq-plans">
              {PLANS.map((p) => (
                <div key={p.id} className={'bq-plan' + (p.best ? ' best' : '')} onClick={() => souscrire(p.id)}>
                  {p.badge && <span className="bq-badge">{p.badge}</span>}
                  <div className="bq-plan-dur">{p.dur}</div>
                  <div className="bq-plan-price">
                    {p.price} <small>FCFA</small>
                  </div>
                  <button className="bq-plan-btn">Choisir</button>
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
              <a className="bq-renew" onClick={() => setView('gate')}>
                Prolonger
              </a>
            </div>

            <h3>Informations de la boutique</h3>
            <div className="bq-form">
              <label>
                Logo de la boutique
                <input type="file" accept="image/*" onChange={onLogoChange} />
                <div className="bq-logo-preview">
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span>Aucun logo</span>
                  )}
                </div>
              </label>
              <label>
                Nom de la boutique
                <input type="text" maxLength={80} placeholder="Ex : Boutique Al-Baraka" value={shopName} onChange={(e) => setShopName(e.target.value)} />
              </label>
              <label>
                Description
                <textarea maxLength={600} rows={3} placeholder="Présentez votre boutique…" value={shopDesc} onChange={(e) => setShopDesc(e.target.value)} />
              </label>
              <label>
                Téléphone / WhatsApp
                <input type="tel" maxLength={20} placeholder="221770000000" value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} />
              </label>
              <button className="bq-btn" onClick={saveShop}>
                💾 Enregistrer la boutique
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
                      {p.Image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={optimImg(p.Image, 300)} alt="" loading="lazy" decoding="async" onError={(e) => (e.currentTarget.parentElement.innerHTML = '🔮')} />
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
                    </div>
                    <div className="bq-prod-actions">
                      <button onClick={() => setFormProduct(p)}>✏️</button>
                      <button onClick={() => deleteProduct(p._key)}>🗑️</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

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

      {toast}
    </div>
  );
}
