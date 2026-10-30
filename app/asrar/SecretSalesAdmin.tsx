'use client';
import { useEffect, useState } from 'react';
import { apiPost } from '@/lib/api';
import ModalUntyped from '@/components/Modal';
const Modal = ModalUntyped as any;
export default function SecretSalesAdmin({ cat, secretKey }: { cat: string; secretKey: string }) {
  const [admin, setAdmin] = useState(false), [open, setOpen] = useState(false), [product, setProduct] = useState('');
  const [fixed, setFixed] = useState(false), [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [confirm, setConfirm] = useState(false);
  useEffect(() => { let live = true; apiPost('check-access').then((value) => { if (live) setAdmin(value.admin === true); }).catch(() => {}); return () => { live = false; }; }, []);
  useEffect(() => {
    if (!open) return;
    let live = true; setBusy(true); setMessage('');
    apiPost('secret-purchases', { action: 'configuration', cat, key: secretKey }).then((config) => {
      if (!live) return;
      setProduct(config.productId); setFixed(config.fixed); setTitle(config.title);
    }).catch((error) => { if (live) setMessage(error.message); }).finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [open, cat, secretKey]);
  if (!admin) return null;
  const execute = async (action: 'configure' | 'activate') => {
    setBusy(true); setMessage('');
    try {
      await apiPost('secret-purchases', { action, cat, key: secretKey, productId: product.trim() });
      setMessage(action === 'configure' ? 'Produit Google Play associé au secret.' : 'Achats individuels activés. Rechargez la page.');
    } catch (error: any) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  return <div className="secret-sales-admin"><button type="button" onClick={() => setOpen(true)}>Configurer l’achat de ce secret</button>
    {open && <Modal className="secret-purchase-dialog" label="Vente individuelle du secret" onClose={busy ? undefined : () => setOpen(false)}><div className="secret-purchase-panel">
      <h2>Achat Android par secret</h2>
      {title && <p>Secret : <strong>{title}</strong></p>}
      <p>Créez un produit ponctuel non consommable dans Google Play, avec le prix de ce secret, puis associez son identifiant ici.</p>
      <label htmlFor="secret-product-id">Identifiant Google Play</label>
      <input id="secret-product-id" value={product} readOnly={fixed} maxLength={149} placeholder="secret_protection_001" onChange={(e) => setProduct(e.target.value)} disabled={busy} />
      <button type="button" onClick={() => execute('configure')} disabled={busy || fixed || !product.trim()}>{fixed ? 'Association enregistrée' : 'Associer ce produit'}</button>
      <hr /><p>La bascule concerne tous les secrets. Préparez leurs produits et testez les achats sur la piste interne avant de l’activer. Les abonnés actuels conserveront leur accès jusqu’à leur échéance actuelle.</p>
      <label><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} disabled={busy} /> Profil marchand validé, produits prêts et achats testés.</label>
      <button type="button" disabled={busy || !confirm} onClick={() => execute('activate')}>Activer la vente par secret</button>
      {message && <p role="status">{message}</p>}
      <button type="button" disabled={busy} onClick={() => setOpen(false)}>Fermer</button>
    </div></Modal>}
  </div>;
}
