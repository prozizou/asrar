'use client';
// Fiche d'une commande : historique et actions selon le rôle.
//   acheteur : déclarer le paiement, annuler, ouvrir un litige ;
//   vendeur  : confirmer la réception (après vérification), refuser, rembourser ;
//   administration : trancher un litige.
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, RotateCcw, Ban, Eye, Gavel } from 'lucide-react';
import { ac } from '@/lib/asrarChat/client';
import { fcfa, METHOD_LABELS, ORDER_LABELS, canTransition } from '@/lib/asrarChat/logic';
import { useAc } from './context';
import { Sheet, Loading, ErrorState, Avatar, dateTime } from './ui';

const ROLE_LABELS: Record<string, string> = { buyer: 'Acheteur', seller: 'Vendeur', admin: 'Administration' };

export default function OrderSheet({ oid, onClose }: { oid: string; onClose: () => void }) {
  const { notify, openPost } = useAc();
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState<null | 'declare' | 'confirm' | 'reject' | 'dispute' | 'refund'>(null);
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setOrder((await ac('order.get', { oid })).order); setError(''); }
    catch (e: any) { setError(e.message); }
  }, [oid]);
  useEffect(() => { load(); }, [load]);

  const run = async (action: string, body: any, msg: string) => {
    setBusy(true);
    try { await ac(action, { oid, ...body }); notify(msg, 'success'); setForm(null); setValue(''); setChecked(false); await load(); }
    catch (e: any) { notify(e.message, 'error'); }
    finally { setBusy(false); }
  };

  if (!order) return <Sheet title="Commande" onClose={onClose}>{error ? <ErrorState error={error} onRetry={load} /> : <Loading />}</Sheet>;
  const role = order.role;
  const can = (to: string) => canTransition(role, order.status, to) || (role === 'admin' && canTransition('admin', order.status, to));
  const other = role === 'seller' ? order.buyer : order.seller;

  return (
    <Sheet title={`Commande ${order.ref}`} onClose={onClose}>
      <div className={'ac-order-status s-' + order.status}>{ORDER_LABELS[order.status]}</div>
      <dl className="ac-dl">
        <dt>Contenu</dt><dd><button type="button" className="ac-link" onClick={() => openPost(order.postId)}>{order.postTitle}</button></dd>
        <dt>Montant</dt><dd><strong>{fcfa(order.amount)}</strong></dd>
        <dt>Moyen</dt><dd>{METHOD_LABELS[order.method]}</dd>
        {order.paymentRef && <><dt>Référence déclarée</dt><dd><code>{order.paymentRef}</code></dd></>}
        {role !== 'buyer' && order.commission > 0 && <><dt>Commission plateforme</dt><dd>{fcfa(order.commission)}</dd></>}
        <dt>{role === 'seller' ? 'Acheteur' : 'Vendeur'}</dt>
        <dd className="ac-dd-user">{other && <><Avatar name={other.displayName} photo={other.photo} seed={other.uid} size={24} /> {other.displayName} (@{other.handle})</>}</dd>
        {role === 'admin' && order.buyer && <><dt>Acheteur</dt><dd>{order.buyer.displayName} (@{order.buyer.handle})</dd></>}
      </dl>
      {order.refReused && role !== 'buyer' && <p className="ac-note warn"><AlertTriangle size={15} aria-hidden="true" /> Cette référence a déjà été déclarée pour une autre commande chez ce vendeur. Vérifiez attentivement.</p>}
      {role === 'seller' && order.status === 'declared' && (
        <p className="ac-note"><Eye size={15} aria-hidden="true" /> <span>Ouvrez votre application {METHOD_LABELS[order.method]} et vérifiez qu’un paiement de <strong>{fcfa(order.amount)}</strong> est bien arrivé avant de confirmer. Ne vous fiez jamais à une capture d’écran.</span></p>
      )}

      <div className="ac-row-actions">
        {role === 'buyer' && order.status === 'paid' && <button type="button" className="ac-btn filled" onClick={() => openPost(order.postId)}><Eye size={16} aria-hidden="true" /> Ouvrir le contenu</button>}
        {role === 'buyer' && can('declared') && <button type="button" className="ac-btn filled" onClick={() => setForm('declare')}><CheckCircle2 size={16} aria-hidden="true" /> J’ai payé</button>}
        {can('paid') && role !== 'buyer' && order.status !== 'disputed' && <button type="button" className="ac-btn filled" onClick={() => setForm('confirm')}><CheckCircle2 size={16} aria-hidden="true" /> Paiement reçu</button>}
        {can('rejected') && role !== 'buyer' && <button type="button" className="ac-btn tonal" onClick={() => setForm('reject')}><XCircle size={16} aria-hidden="true" /> Paiement non reçu</button>}
        {role === 'buyer' && can('disputed') && <button type="button" className="ac-btn tonal" onClick={() => setForm('dispute')}><AlertTriangle size={16} aria-hidden="true" /> Ouvrir un litige</button>}
        {role !== 'buyer' && can('refunded') && <button type="button" className="ac-btn tonal" onClick={() => setForm('refund')}><RotateCcw size={16} aria-hidden="true" /> Rembourser</button>}
        {role === 'buyer' && can('cancelled') && <button type="button" className="ac-btn text" onClick={() => { if (window.confirm('Annuler cette commande ?')) run('order.cancel', {}, 'Commande annulée.'); }}><Ban size={16} aria-hidden="true" /> Annuler</button>}
      </div>
      {role === 'admin' && order.status === 'disputed' && (
        <div className="ac-admin-resolve">
          <p><Gavel size={16} aria-hidden="true" /> Trancher le litige (après vérification auprès des deux parties) :</p>
          <div className="ac-row-actions">
            <button type="button" className="ac-btn filled" disabled={busy} onClick={() => { if (window.confirm('Accorder l’accès : le paiement a été vérifié ?')) run('order.resolve', { decision: 'paid' }, 'Accès accordé.'); }}>Accorder l’accès</button>
            <button type="button" className="ac-btn tonal" disabled={busy} onClick={() => run('order.resolve', { decision: 'refunded', note: 'Remboursement décidé par l’administration' }, 'Remboursement enregistré.')}>Remboursé</button>
            <button type="button" className="ac-btn text" disabled={busy} onClick={() => run('order.resolve', { decision: 'cancelled', note: 'Annulée par l’administration' }, 'Commande annulée.')}>Annuler</button>
          </div>
        </div>
      )}

      {form && (
        <form className="ac-form ac-inline-form" onSubmit={(e) => {
          e.preventDefault();
          if (form === 'declare') run('order.declare', { paymentRef: value }, 'Paiement déclaré au vendeur.');
          if (form === 'confirm') run('order.confirm', { checked }, 'Paiement confirmé : contenu déverrouillé pour l’acheteur.');
          if (form === 'reject') run('order.reject', { note: value }, 'Acheteur informé.');
          if (form === 'dispute') run('order.dispute', { note: value }, 'Litige ouvert : l’administration va l’examiner.');
          if (form === 'refund') run('order.refund', { note: value }, 'Remboursement enregistré, accès retiré.');
        }}>
          {form === 'confirm' ? (
            <label className="ac-check"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} /> J’ai vérifié sur mon compte {METHOD_LABELS[order.method]} la réception effective de {fcfa(order.amount)}.</label>
          ) : (
            <label className="ac-field"><span>{{ declare: 'Référence de la transaction', reject: 'Message à l’acheteur', dispute: 'Décrivez le problème', refund: 'Moyen et référence du remboursement' }[form]}</span>
              {form === 'declare' ? <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={80} required autoFocus /> : <textarea value={value} onChange={(e) => setValue(e.target.value)} maxLength={500} rows={3} autoFocus />}
            </label>
          )}
          <div className="ac-row-actions">
            <button type="button" className="ac-btn text" onClick={() => setForm(null)}>Annuler</button>
            <button type="submit" className="ac-btn filled" disabled={busy || (form === 'confirm' && !checked)}>{busy ? 'Envoi…' : 'Valider'}</button>
          </div>
        </form>
      )}

      <h3 className="ac-h3">Historique</h3>
      <ol className="ac-timeline">
        {order.history.map((h: any, i: number) => (
          <li key={i}><strong>{ORDER_LABELS[h.status]}</strong> <span>{ROLE_LABELS[h.role]} · {dateTime(h.at)}</span>{h.note && <em>{h.note}</em>}</li>
        ))}
      </ol>
    </Sheet>
  );
}
