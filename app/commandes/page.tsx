'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiPost } from '@/lib/api';
import { ORDER_LABELS, ORDER_TRANSITIONS, formatOrderPrice } from '@/lib/orderStatus';
import { reserveExternalWindow } from '@/lib/externalWindow';
import ModalUntyped from '@/components/Modal';
import '../compte/compte.css';
const Modal = ModalUntyped as any;

function OrdersContent() {
  const mode = useSearchParams()?.get('vue');
  const seller = mode === 'boutique', administrator = mode === 'administration';
  const [items, setItems] = useState<any[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [change, setChange] = useState<any>(null), [note, setNote] = useState('');
  const load = useCallback(async (next?: string) => {
    setLoading(true); setError('');
    try {
      const result = await apiPost('orders', { action: administrator ? 'admin-list' : seller ? 'seller-list' : 'list', ...(next ? { cursor: next } : {}) });
      setItems((old) => next ? [...old, ...result.items] : result.items); setCursor(result.nextCursor || null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [seller, administrator]);
  useEffect(() => { void load(); }, [load]);
  const contact = async (order: any) => {
    const destination = reserveExternalWindow();
    if (!destination) { setError('Autorisez l’ouverture d’une nouvelle fenêtre pour contacter la boutique.'); return; }
    setBusy(true);
    try { destination.navigate((await apiPost('orders', { action: 'contact', orderId: order._key })).contactUrl); }
    catch (e: any) { destination.close(); setError(e.message); }
    finally { setBusy(false); }
  };
  const transition = async () => {
    setBusy(true); setError('');
    try {
      await apiPost('orders', { action: 'transition', orderId: change.order._key, status: change.status, note });
      setChange(null); setNote(''); await load();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };
  return <main className="account-page container"><Link href="/menu" className="back-btn">← Tableau de bord</Link>
    <header><p className="account-eyebrow">Marché</p><h1>{administrator ? 'Suivi des commandes — administration' : seller ? 'Demandes reçues par ma boutique' : 'Mes demandes et commandes'}</h1>
      <p>Une demande WhatsApp n’est ni une confirmation d’achat ni une preuve de paiement. La boutique confirme ensuite chaque étape.</p></header>
    <nav aria-label="Historique des commandes"><Link className="account-button" href="/commandes">Mes demandes</Link> · <Link className="account-button" href="/commandes?vue=boutique">Demandes reçues</Link> · <Link href="/compte">Mon compte</Link></nav>
    {error && <p role="alert" className="account-error">{error} <button onClick={() => load()}>Réessayer</button></p>}
    {loading && <p role="status">Chargement des demandes…</p>}
    {!loading && items.length === 0 && <p>Aucune demande {seller ? 'reçue pour le moment.' : 'enregistrée. Ouvrez une fiche produit pour contacter sa boutique.'}</p>}
    <div className="account-grid">{items.map((order) => <article key={order._key} className="account-card">
      <h2>{order.produit}</h2><strong>{formatOrderPrice(order.prix, order.devise)}</strong><p>{order.vendeur} · {new Date(order.at).toLocaleDateString('fr-FR')}</p>
      <p><strong>{(ORDER_LABELS as any)[order.status] || 'État à vérifier'}</strong></p>
      {order.schemaVersion === 1 ? <p className="account-muted">Ancienne demande : prix et vendeur historiques non vérifiés. Aucun achat ni paiement confirmé.</p> : <>
        <p className="account-muted">Référence : {order._key.slice(0, 12)}</p>
        {!seller && !administrator && order.status !== 'cancelled' && <button disabled={busy} onClick={() => contact(order)}>Contacter la boutique</button>}
        {((seller || administrator) ? (ORDER_TRANSITIONS as any)[order.status] || [] : order.status === 'whatsapp_request' ? ['cancelled'] : []).map((status: string) => <button key={status} disabled={busy} className="account-secondary" onClick={() => { setChange({ order, status }); setNote(''); }}>{status === 'confirmed' ? 'Confirmer la commande' : status === 'paid' ? 'Déclarer le paiement reçu' : status === 'delivered' ? 'Déclarer la livraison' : 'Annuler la demande'}</button>)}
        <details><summary>Historique des étapes</summary><ol>{Object.values(order.history || {}).sort((a: any, b: any) => a.at - b.at).map((event: any, i) => <li key={i}>{(ORDER_LABELS as any)[event.status]} · {new Date(event.at).toLocaleString('fr-FR')}{event.note ? ' — ' + event.note : ''}</li>)}</ol></details>
      </>}
    </article>)}</div>
    {cursor && <button className="account-button" disabled={loading} onClick={() => load(cursor)}>Afficher les demandes précédentes</button>}
    {change && <Modal className="account-modal" label="Confirmer le changement de statut" onClose={() => setChange(null)}><section className="account-card"><h2>{(ORDER_LABELS as any)[change.status]}</h2>
      {change.status === 'paid' ? <p>Confirmez uniquement après avoir vérifié que le paiement a été reçu. Cette étape enregistre votre déclaration manuelle.</p> : change.status === 'delivered' ? <p>Confirmez uniquement après la livraison effective au client.</p> : <p>Le changement sera enregistré dans l’historique de cette demande.</p>}
      <label htmlFor="order-note">Note de suivi, visible par l’acheteur</label><textarea id="order-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
      <button disabled={busy} onClick={transition}>Confirmer cette étape</button><button className="account-secondary" onClick={() => setChange(null)}>Revenir sans modifier</button>
      {error && <p role="alert">{error}</p>}
    </section></Modal>}
  </main>;
}
export default function CommandesPage() { return <Suspense fallback={<p>Chargement des demandes…</p>}><OrdersContent /></Suspense>; }
