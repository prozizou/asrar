'use client';
// « Demander un produit » dans une boutique du Marché (pages/api/product-requests.js).
//
// - Visiteur : formulaire de demande + SES demandes (et la réponse de la
//   boutique). Les demandes des autres clients ne lui sont jamais envoyées.
// - Propriétaire (isOwn) : toutes les demandes reçues, avec l'auteur ; il peut
//   répondre (intervenir) et supprimer chaque demande.
import { useCallback, useEffect, useState } from 'react';
import { apiPost } from '@/lib/api';
import { REQUEST_TEXT_MAX, REPLY_TEXT_MAX } from '@/lib/productRequests';

function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' · ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function RequestItem({ item, isOwn, busy, onReply, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.reply ? item.reply.text : '');

  const save = async () => {
    if (await onReply(item.id, draft.trim())) setEditing(false);
  };

  return (
    <div className="sr-item pr-item">
      <div className="sr-item-head pr-item-head">
        {isOwn ? (
          <span className="pr-author">{item.name || 'Client'}{item.email ? <span className="sr-item-email"> · {item.email}</span> : null}</span>
        ) : (
          <span className="pr-author">Ma demande</span>
        )}
        <span className="sr-item-email pr-date">{fmtDate(item.at)}</span>
      </div>
      <p className="sr-item-text">{item.text}</p>

      {item.reply && !editing && (
        <div className="pr-reply">
          <span className="pr-reply-label">{isOwn ? 'Votre réponse' : 'Réponse de la boutique'}</span>
          <p className="sr-item-text">{item.reply.text}</p>
        </div>
      )}
      {!isOwn && !item.reply && <p className="pr-pending">En attente de réponse de la boutique.</p>}

      {isOwn && editing && (
        <div className="sr-form pr-reply-form">
          <textarea
            aria-label="Votre réponse"
            rows={2}
            maxLength={REPLY_TEXT_MAX}
            disabled={busy}
            placeholder="Disponibilité, prix, délai…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="pr-actions">
            <button type="button" className="sr-submit" onClick={save} disabled={busy}>
              {busy ? 'Envoi…' : 'Envoyer la réponse'}
            </button>
            <button type="button" className="pr-link" onClick={() => setEditing(false)} disabled={busy}>Annuler</button>
          </div>
        </div>
      )}

      <div className="pr-actions">
        {isOwn && !editing && (
          <button type="button" className="pr-link" onClick={() => { setDraft(item.reply ? item.reply.text : ''); setEditing(true); }} disabled={busy}>
            {item.reply ? 'Modifier la réponse' : 'Répondre'}
          </button>
        )}
        <button type="button" className="pr-link pr-danger" onClick={() => onDelete(item.id)} disabled={busy}>
          {isOwn ? 'Supprimer' : 'Retirer ma demande'}
        </button>
      </div>
    </div>
  );
}

export default function ProductRequests({ vendorId, isOwn }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const data = await apiPost('product-requests', { action: 'list', vendorId });
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setLoadError(e.message || 'Demandes indisponibles.');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    const t = text.trim();
    if (t.length < 3 || busy) return;
    setBusy(true); setError(''); setSent(false);
    try {
      const data = await apiPost('product-requests', { action: 'create', vendorId, text: t });
      if (data.item) setItems((prev) => [data.item, ...prev]);
      setText(''); setSent(true);
    } catch (e) {
      setError(e.message || 'Demande non envoyée. Réessayez.');
    } finally {
      setBusy(false);
    }
  };

  const reply = async (id, replyText) => {
    setBusyId(id); setError('');
    try {
      const data = await apiPost('product-requests', { action: 'reply', vendorId, id, text: replyText });
      if (data.item) setItems((prev) => prev.map((it) => (it.id === id ? data.item : it)));
      return true;
    } catch (e) {
      setError(e.message || 'Réponse non envoyée. Réessayez.');
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id) => {
    if (!window.confirm(isOwn ? 'Supprimer cette demande ?' : 'Retirer votre demande ?')) return;
    setBusyId(id); setError('');
    try {
      await apiPost('product-requests', { action: 'delete', vendorId, id });
      setItems((prev) => prev.filter((it) => it.id !== id));
    } catch (e) {
      setError(e.message || 'Suppression impossible. Réessayez.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="sr-section pr-section">
      <div className="sr-section-head">
        <h3>{isOwn ? 'Demandes de produits reçues' : 'Demander un produit'}</h3>
        {isOwn && items.length > 0 && <span className="pr-count">{items.length}</span>}
      </div>

      {isOwn ? (
        <p className="pr-hint">Vous seul voyez ces demandes. Répondez au client ou supprimez la demande.</p>
      ) : (
        <div className="sr-form">
          <p className="pr-hint">Vous ne trouvez pas ce que vous cherchez ? Décrivez le produit : seul le propriétaire de la boutique verra votre demande.</p>
          <textarea
            aria-label="Produit recherché"
            rows={2}
            maxLength={REQUEST_TEXT_MAX}
            disabled={busy}
            placeholder="Ex. : bague en argent pour la protection, taille 58…"
            value={text}
            onChange={(e) => { setText(e.target.value); setSent(false); }}
          />
          <button type="button" className="sr-submit" onClick={submit} disabled={busy || text.trim().length < 3}>
            {busy ? 'Envoi…' : 'Envoyer la demande'}
          </button>
          {sent && <p role="status" className="view-feedback">Demande envoyée au propriétaire de la boutique.</p>}
        </div>
      )}

      {error && <p role="alert" className="view-feedback view-feedback-error">{error}</p>}
      {loadError && (
        <p role="alert" className="view-feedback view-feedback-error">
          {loadError} <button type="button" className="pr-link" onClick={load}>Réessayer</button>
        </p>
      )}
      {loading && <p className="pr-hint">Chargement des demandes…</p>}
      {!loading && !loadError && isOwn && items.length === 0 && <p className="pr-hint">Aucune demande pour le moment.</p>}

      {items.length > 0 && (
        <div className="sr-list">
          {!isOwn && <h4 className="pr-subtitle">Mes demandes</h4>}
          {items.map((it) => (
            <RequestItem key={it.id} item={it} isOwn={isOwn} busy={busyId === it.id} onReply={reply} onDelete={remove} />
          ))}
        </div>
      )}
    </div>
  );
}
