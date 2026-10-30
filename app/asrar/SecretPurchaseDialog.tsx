'use client';
import { useEffect, useRef, useState } from 'react';
import ModalUntyped from '@/components/Modal';
import { apiPost } from '@/lib/api';
import { buySecret, restoreSecrets, secretProduct, secretPurchasePlatform } from '@/lib/secretBilling';
const Modal = ModalUntyped as any;
type Offer = { title: string; productId: string | null; accountId: string; allowed: boolean };
export default function SecretPurchaseDialog({ cat, secretKey, onClose, onUnlocked }: { cat: string; secretKey: string; onClose: () => void; onUnlocked: () => void }) {
  const [offer, setOffer] = useState<Offer | null>(null), [price, setPrice] = useState('');
  const [error, setError] = useState(''), [status, setStatus] = useState(''), [busy, setBusy] = useState(true);
  const alive = useRef(true), unlocked = useRef(onUnlocked); unlocked.current = onUnlocked;
  useEffect(() => {
    alive.current = true;
    (async () => {
      try {
        const result = await apiPost('secret-purchases', { action: 'offer', cat, key: secretKey });
        if (!alive.current) return;
        if (result.allowed) { unlocked.current(); return; }
        setOffer(result);
        if (await secretPurchasePlatform() !== 'android') throw new Error('Les achats sont disponibles dans l’application Android installée depuis Google Play. Vos secrets déjà achetés restent accessibles sur le site.');
        if (!result.productId) throw new Error('Ce secret n’est pas encore disponible à l’achat.');
        const product = await secretProduct(result.productId);
        if (alive.current) setPrice(product.price);
      } catch (e: any) { if (alive.current) setError(e.message); }
      finally { if (alive.current) setBusy(false); }
    })();
    return () => { alive.current = false; };
  }, [cat, secretKey]);
  const buy = async () => {
    if (busy || !offer?.productId || !price) return;
    setBusy(true); setError(''); setStatus('');
    try {
      const result = await buySecret(offer.productId, offer.accountId);
      if (!alive.current) return;
      if (result.pending) setStatus('Paiement en attente. Le secret sera accessible après confirmation et restauration de l’achat.');
      else unlocked.current();
    } catch (e: any) { if (alive.current) setError(e.message); }
    finally { if (alive.current) setBusy(false); }
  };
  const restore = async () => {
    setBusy(true); setError(''); setStatus('');
    try {
      const result = await restoreSecrets();
      if (!alive.current) return;
      const current = await apiPost('secret-purchases', { action: 'offer', cat, key: secretKey });
      if (!alive.current) return;
      if (current.allowed) unlocked.current();
      else setStatus(`${result.restored} achat(s) restauré(s). ${result.pending ? 'Des paiements sont encore en attente. ' : ''}${result.failed ? 'Certains achats n’ont pas pu être vérifiés avec ce compte ASRAR. ' : ''}Ce secret reste verrouillé.`);
    } catch (e: any) { if (alive.current) setError(e.message); }
    finally { if (alive.current) setBusy(false); }
  };
  return <Modal className="secret-purchase-dialog" label="Débloquer ce secret" onClose={busy ? undefined : onClose}>
    <div className="secret-purchase-panel">
      <button className="secret-purchase-close" type="button" disabled={busy} onClick={onClose} aria-label="Fermer">×</button>
      <span className="secret-purchase-lock" aria-hidden="true">✦</span>
      <h2>{offer?.title || 'Débloquer ce secret'}</h2>
      <p>Achat unique pour ce secret, lié à votre compte ASRAR. Aucun renouvellement automatique.</p>
      {busy && <p role="status">Vérification de l’achat…</p>}
      {error && <p className="view-feedback view-feedback-error" role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
      <button type="button" className="primary" disabled={busy || !price} onClick={buy}>{price ? `Débloquer pour ${price}` : 'Achat indisponible'}</button>
      <button type="button" disabled={busy} onClick={restore}>Restaurer mes achats</button>
    </div>
  </Modal>;
}
