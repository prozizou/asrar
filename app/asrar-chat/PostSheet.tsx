'use client';
// Fiche d'une publication. Verrouillée : aperçu, prix, conditions et bouton
// « Déverrouiller pour X FCFA » → paiement DIRECT au vendeur → déclaration de
// la référence → le vendeur vérifie et confirme → contenu déverrouillé.
// Déverrouillée : contenu intégral (liens signés temporaires), note, favori.
import { useCallback, useEffect, useState } from 'react';
import {
  Lock, Heart, Star, Share2, Flag, MessageCircle, Wallet, Landmark, Copy, ExternalLink, Clock, CheckCircle2, AlertTriangle,
  FileText, Download, Trash2, ShieldCheck,
} from 'lucide-react';
import { ac } from '@/lib/asrarChat/client';
import { handleExternalLinkClick } from '@/lib/externalWindow';
import { fcfa, METHOD_LABELS, ORDER_LABELS, POST_KIND_LABELS, CATEGORIES } from '@/lib/asrarChat/logic';
import { useAc } from './context';
import { Sheet, Loading, ErrorState, Avatar, Stars, bytes, dateTime, Modal } from './ui';
import ReportSheet from './ReportSheet';

const METHOD_ICONS: Record<string, any> = { wave: Wallet, pispi: Landmark, whatsapp: MessageCircle };

export default function PostSheet({ pid, moderation = false, onClose }: { pid: string; moderation?: boolean; onClose: () => void }) {
  const { notify, openProfile, openChat, openOrder } = useAc();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [reporting, setReporting] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await ac('post.open', { pid, ...(moderation ? { moderation: true } : {}) })); setError(''); }
    catch (e: any) { setError(e.message); }
  }, [pid, moderation]);
  useEffect(() => { load(); }, [load]);

  const post = data?.post;
  const favorite = async () => {
    try { const r = await ac('post.favorite', { pid }); setData((d: any) => ({ ...d, post: { ...d.post, favorite: r.favorite } })); }
    catch (e: any) { notify(e.message, 'error'); }
  };
  const rate = async (stars: number) => {
    try { await ac('post.rate', { pid, stars }); notify('Merci pour votre note.', 'success'); await load(); }
    catch (e: any) { notify(e.message, 'error'); }
  };
  const share = async () => {
    const url = `${window.location.origin}/asrar-chat?p=${encodeURIComponent(pid)}`;
    try {
      if (navigator.share) await navigator.share({ title: post.title, url });
      else { await navigator.clipboard.writeText(url); notify('Lien copié.', 'success'); }
    } catch {}
  };
  const remove = async () => {
    if (!window.confirm('Retirer cette publication de la vente ? Les acheteurs gardent leur accès.')) return;
    try { await ac('post.delete', { pid }); notify('Publication retirée.', 'success'); onClose(); } catch (e: any) { notify(e.message, 'error'); }
  };
  const contact = async () => {
    try { const r = await ac('conv.dm', { uid: post.seller.uid }); openChat(r.id); } catch (e: any) { notify(e.message, 'error'); }
  };

  return (
    <Sheet title={post ? POST_KIND_LABELS[post.kind] : 'Publication'} onClose={onClose} wide>
      {!data ? (error ? <ErrorState error={error} onRetry={load} /> : <Loading />) : (
        <div className="ac-postsheet">
          {post.previewImage && (
            <div className={'ac-cover' + (post.price > 0 && !post.unlocked ? ' locked' : '')}>
              {/* eslint-disable-next-line @next/next/no-img-element -- aperçu public */}
              <img src={post.previewImage} alt="" />
              {post.price > 0 && !post.unlocked && <span className="ac-cover-lock"><Lock size={28} aria-hidden="true" /> Contenu verrouillé</span>}
            </div>
          )}
          <h3 className="ac-post-h">{post.title}</h3>
          <div className="ac-post-tags">
            <span className={'ac-chip static price' + (post.price ? '' : ' free')}>{post.price ? <><Lock size={13} aria-hidden="true" /> {fcfa(post.price)}</> : 'Gratuit'}</span>
            <span className="ac-chip static">{CATEGORIES.find((c) => c.id === post.category)?.label}</span>
            <Stars value={post.rating} count={post.ratingCount} />
            {post.sales > 0 && <span className="ac-hint">{post.sales} vente{post.sales > 1 ? 's' : ''}</span>}
          </div>
          {post.seller && (
            <button type="button" className="ac-seller-line" onClick={() => openProfile(post.seller.uid)}>
              <Avatar name={post.seller.displayName} photo={post.seller.photo} seed={post.seller.uid} size={34} />
              <span><strong>{post.seller.displayName}</strong><small>@{post.seller.handle}</small></span>
            </button>
          )}
          {post.description && <p className="ac-about">{post.description}</p>}
          {post.moderation && <p className="ac-note warn"><ShieldCheck size={15} aria-hidden="true" /> <span>Vue modération : contenu affiché pour examiner le signalement.</span></p>}
          {post.owner && post.price > 0 && (
            <p className="ac-note"><Lock size={15} aria-hidden="true" /> <span>Vous êtes l’auteur : vous voyez votre contenu. Les autres comptes ne voient que l’aperçu flouté, la description et le prix ({fcfa(post.price)}) tant que vous n’avez pas confirmé leur paiement.</span></p>
          )}
          {post.price > 0 && !post.unlocked && post.previewText && <blockquote className="ac-preview-text">{post.previewText}</blockquote>}

          {data.content ? (
            <Content content={data.content} onView={setViewer} />
          ) : post.price > 0 ? (
            <Unlock data={data} onChanged={load} onOrder={openOrder} />
          ) : null}

          {post.unlocked && post.expiresAt > 0 && <p className="ac-note"><Clock size={15} aria-hidden="true" /> Accès jusqu’au {dateTime(post.expiresAt)}</p>}
          {post.conditions && <p className="ac-note"><ShieldCheck size={15} aria-hidden="true" /> <span><strong>Conditions :</strong> {post.conditions}</span></p>}

          {post.unlocked && !post.owner && (
            <div className="ac-rate" role="group" aria-label="Noter">
              <span>Votre note</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" aria-label={`${n} étoile${n > 1 ? 's' : ''}`} aria-pressed={(post.myRating || 0) >= n} onClick={() => rate(n)}>
                  <Star size={22} fill={(post.myRating || 0) >= n ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
          )}
          <div className="ac-row-actions">
            {!post.owner && <button type="button" className={'ac-btn tonal' + (post.favorite ? ' on' : '')} onClick={favorite}><Heart size={16} fill={post.favorite ? 'currentColor' : 'none'} aria-hidden="true" /> {post.favorite ? 'Favori' : 'Ajouter aux favoris'}</button>}
            <button type="button" className="ac-btn tonal" onClick={share}><Share2 size={16} aria-hidden="true" /> Partager</button>
            {!post.owner && post.seller && <button type="button" className="ac-btn tonal" onClick={contact}><MessageCircle size={16} aria-hidden="true" /> Écrire au vendeur</button>}
            {post.owner && <button type="button" className="ac-btn text danger" onClick={remove}><Trash2 size={16} aria-hidden="true" /> Retirer</button>}
            {!post.owner && <button type="button" className="ac-btn text" onClick={() => setReporting(true)}><Flag size={16} aria-hidden="true" /> Signaler</button>}
          </div>
        </div>
      )}
      {reporting && <ReportSheet target={{ target: 'post', pid }} onClose={() => setReporting(false)} />}
      {viewer && (
        <Modal className="ac-viewer" label="Image" onClose={() => setViewer(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- lien signé temporaire */}
          <img src={viewer} alt="" onContextMenu={(e) => e.preventDefault()} onClick={() => setViewer(null)} />
        </Modal>
      )}
    </Sheet>
  );
}

function Content({ content, onView }: { content: any; onView: (url: string) => void }) {
  return (
    <div className="ac-content" onContextMenu={(e) => e.preventDefault()}>
      <p className="ac-unlocked-badge"><CheckCircle2 size={16} aria-hidden="true" /> Contenu déverrouillé</p>
      {content.assets.map((a: any, i: number) => (
        a.kind === 'image' ? (
          <button key={i} type="button" className="ac-media-img" onClick={() => onView(a.url)} aria-label="Agrandir">
            {/* eslint-disable-next-line @next/next/no-img-element -- lien signé temporaire */}
            <img src={a.url} alt="" loading="lazy" />
          </button>
        ) : a.kind === 'video' ? (
          <video key={i} className="ac-media-video" src={a.url} controls playsInline preload="metadata" controlsList="nodownload" disablePictureInPicture />
        ) : a.kind === 'audio' ? (
          <audio key={i} className="ac-media-audio" src={a.url} controls preload="metadata" controlsList="nodownload" />
        ) : (
          <a key={i} className="ac-media-doc" href={a.url} target="_blank" rel="noopener noreferrer">
            <FileText size={26} aria-hidden="true" />
            <span><strong>{a.name || 'Document'}</strong><small>{[a.fmt?.toUpperCase(), bytes(a.bytes)].filter(Boolean).join(' · ')} · lien valable 15 min</small></span>
            <Download size={18} aria-hidden="true" />
          </a>
        )
      ))}
      {content.text && <div className="ac-content-text" dir="auto">{content.text}</div>}
    </div>
  );
}

/** Parcours de déverrouillage d'un contenu payant. */
function Unlock({ data, onChanged, onOrder }: { data: any; onChanged: () => Promise<void>; onOrder: (oid: string) => void }) {
  const { notify } = useAc();
  const post = data.post;
  const [method, setMethod] = useState<string>(data.order?.method || data.paymentMethods?.[0] || '');
  const [pay, setPay] = useState<any>(null);
  const [order, setOrder] = useState<any>(data.order || null);
  const [paymentRef, setPaymentRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const r = await ac('order.create', { pid: post.id, method });
      setOrder(r.order); setPay(r.pay);
    } catch (e: any) { notify(e.message, 'error'); }
    finally { setBusy(false); }
  };
  // Données relues (après déclaration, confirmation…) : état de commande à jour.
  useEffect(() => { if (data.order) setOrder(data.order); }, [data.order]);
  // Reprise d'une commande déjà ouverte : instructions à jour.
  useEffect(() => {
    if (data.order && ['pending', 'rejected'].includes(data.order.status)) ac('order.get', { oid: data.order.id }).then((r) => setPay(r.order.pay)).catch(() => {});
  }, [data.order]);

  const declare = async (e: any) => {
    e.preventDefault();
    setBusy(true);
    try {
      await ac('order.declare', { oid: order.id, paymentRef });
      setOrder((o: any) => ({ ...o, status: 'declared' }));
      notify('Paiement déclaré : le vendeur va vérifier sa réception.', 'success');
      setConfirmOpen(false);
      await onChanged();
    } catch (err: any) { notify(err.message, 'error'); }
    finally { setBusy(false); }
  };
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); notify('Copié.', 'success'); } catch { window.prompt('Copiez :', value); }
  };

  if (post.owner) return null;
  if (!data.paymentMethods?.length) return <p className="ac-note"><AlertTriangle size={15} aria-hidden="true" /> Ce vendeur n’accepte pas de paiement pour le moment.</p>;

  if (order && ['declared', 'disputed'].includes(order.status)) {
    return (
      <div className="ac-unlock-box waiting">
        <Clock size={22} aria-hidden="true" />
        <div>
          <strong>{ORDER_LABELS[order.status]}</strong>
          <p>{order.status === 'declared' ? 'Le vendeur vérifie la réception de votre paiement. Le contenu se déverrouille dès sa confirmation ; vous serez notifié.' : 'L’administration examine votre litige.'}</p>
          <button type="button" className="ac-btn text small" onClick={() => onOrder(order.id)}>Suivre la commande {order.ref}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ac-unlock-box">
      {!order || !pay ? (
        <>
          <p className="ac-unlock-title"><Lock size={18} aria-hidden="true" /> Déverrouiller pour <strong>{fcfa(post.price)}</strong></p>
          {post.accessDays > 0 && <p className="ac-hint">Accès pendant {post.accessDays} jour{post.accessDays > 1 ? 's' : ''} après validation.</p>}
          <div className="ac-methods" role="radiogroup" aria-label="Moyen de paiement">
            {data.paymentMethods.map((m: string) => {
              const Icon = METHOD_ICONS[m];
              return (
                <label key={m} className={'ac-method' + (method === m ? ' on' : '')}>
                  <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} />
                  <Icon size={22} aria-hidden="true" /> {METHOD_LABELS[m]}
                </label>
              );
            })}
          </div>
          <button type="button" className="ac-btn filled" disabled={!method || busy} onClick={start}>{busy ? 'Préparation…' : `Déverrouiller pour ${fcfa(post.price)}`}</button>
          <p className="ac-hint">Vous payez directement le vendeur. Le contenu s’ouvre uniquement quand il a constaté la réception du paiement.</p>
        </>
      ) : (
        <>
          <p className="ac-unlock-title">Commande <strong>{pay.ref}</strong> · {fcfa(pay.amount)}</p>
          {order.status === 'rejected' && <p className="ac-note warn"><AlertTriangle size={15} aria-hidden="true" /> Le vendeur n’a pas trouvé votre paiement. Vérifiez la référence, ou ouvrez un litige depuis la commande.</p>}
          <ol className="ac-steps">
            <li>
              {order.method === 'wave' && (pay.waveUrl
                ? <a className="ac-btn filled wave" href={pay.waveUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => handleExternalLinkClick(e, pay.waveUrl)}><Wallet size={17} aria-hidden="true" /> Payer {fcfa(pay.amount)} avec Wave <ExternalLink size={14} aria-hidden="true" /></a>
                : <span>Envoyez <strong>{fcfa(pay.amount)}</strong> par Wave au <strong>+{pay.wavePhone}</strong> <button type="button" className="ac-icon-btn" aria-label="Copier le numéro" onClick={() => copy('+' + pay.wavePhone)}><Copy size={15} /></button></span>)}
              {order.method === 'pispi' && <span>Envoyez <strong>{fcfa(pay.amount)}</strong> à l’alias PI-SPI <code>{pay.pispiAlias}</code> <button type="button" className="ac-icon-btn" aria-label="Copier l’alias" onClick={() => copy(pay.pispiAlias)}><Copy size={15} /></button></span>}
              {order.method === 'whatsapp' && <span>Contactez le vendeur : il vous transmettra son lien ou ses coordonnées de paiement.</span>}
            </li>
            <li>Indiquez la référence <strong>{pay.ref}</strong> en motif si possible.</li>
            {pay.whatsappUrl && <li><a href={pay.whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => handleExternalLinkClick(e, pay.whatsappUrl)} className="ac-link"><MessageCircle size={14} aria-hidden="true" /> Écrire au vendeur sur WhatsApp</a></li>}
            <li>Après paiement, déclarez la référence de transaction :</li>
          </ol>
          <button type="button" className="ac-btn filled" onClick={() => setConfirmOpen(true)}><CheckCircle2 size={17} aria-hidden="true" /> J’ai payé</button>
          <button type="button" className="ac-btn text small" onClick={() => onOrder(order.id)}>Détails de la commande</button>
        </>
      )}
      {confirmOpen && (
        <Sheet title="Déclarer le paiement" onClose={() => setConfirmOpen(false)} compact>
          <form className="ac-form" onSubmit={declare}>
            <label className="ac-field"><span>Référence de la transaction</span>
              <input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} maxLength={80} placeholder="Reçue par SMS ou dans l’application" required autoFocus />
            </label>
            <p className="ac-hint">Une capture d’écran ne suffit pas : le vendeur vérifie la réception sur son propre compte avant de déverrouiller.</p>
            <button type="submit" className="ac-btn filled" disabled={busy || paymentRef.trim().length < 4}>{busy ? 'Envoi…' : 'Envoyer au vendeur'}</button>
          </form>
        </Sheet>
      )}
    </div>
  );
}
