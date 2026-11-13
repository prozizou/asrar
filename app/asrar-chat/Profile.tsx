'use client';
// Onglet « Profil » : profil public, vente (moyens de paiement), mes
// publications, ventes et revenus, confidentialité, administration.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pencil, Share2, Store, Wallet, BarChart3, ShieldCheck, Ban, Gavel, Camera, ChevronRight, AlertTriangle, Info,
} from 'lucide-react';
import { ac } from '@/lib/asrarChat/client';
import { uploadAsset } from '@/lib/asrarChat/upload';
import { normalizeSellerInput, SELLER_ERRORS, fcfa, METHOD_LABELS, ORDER_LABELS } from '@/lib/asrarChat/logic';
import { useAc } from './context';
import { Avatar, Sheet, Loading, ErrorState, Empty, PostCard, timeShort } from './ui';
import Admin from './Admin';

export default function Profile() {
  const { me, notify, reloadMe, openProfile } = useAc();
  const [sheet, setSheet] = useState<null | 'edit' | 'seller' | 'posts' | 'sales' | 'privacy' | 'admin'>(null);
  const p = me.profile;
  const share = async () => {
    const url = `${window.location.origin}/asrar-chat?u=${encodeURIComponent(p.handle)}`;
    try { if (navigator.share) await navigator.share({ title: p.displayName, url }); else { await navigator.clipboard.writeText(url); notify('Lien du profil copié.', 'success'); } } catch {}
  };
  const items = [
    { id: 'seller', Icon: Wallet, label: p.seller ? 'Vente et moyens de paiement' : 'Devenir vendeur', sub: p.seller ? 'Wave, PI-SPI, WhatsApp' : 'Vendez vos contenus et services' },
    { id: 'posts', Icon: Store, label: 'Mes publications', sub: 'Gratuites et payantes' },
    { id: 'sales', Icon: BarChart3, label: 'Ventes et revenus', sub: 'Paiements à vérifier, commandes, revenus' },
    { id: 'privacy', Icon: ShieldCheck, label: 'Confidentialité et sécurité', sub: 'Comptes bloqués, données' },
    ...(me.isAdmin ? [{ id: 'admin', Icon: Gavel, label: 'Administration Asrar-chat', sub: 'Signalements, litiges, commissions' }] : []),
  ] as const;
  return (
    <section className="ac-tab" aria-label="Profil">
      <div className="ac-profile-card">
        <Avatar name={p.displayName} photo={p.photo} seed={me.uid} size={72} />
        <div>
          <strong>{p.displayName}</strong>
          <span className="ac-hint">@{p.handle}</span>
          {p.bio && <p className="ac-about">{p.bio}</p>}
        </div>
      </div>
      <div className="ac-row-actions">
        <button type="button" className="ac-btn tonal" onClick={() => setSheet('edit')}><Pencil size={16} aria-hidden="true" /> Modifier</button>
        <button type="button" className="ac-btn tonal" onClick={share}><Share2 size={16} aria-hidden="true" /> Partager mon profil</button>
        <button type="button" className="ac-btn text" onClick={() => openProfile(me.uid)}>Voir ma vitrine</button>
      </div>
      <ul className="ac-list ac-settings">
        {items.map(({ id, Icon, label, sub }) => (
          <li key={id}><button type="button" className="ac-row" onClick={() => setSheet(id as any)}>
            <span className="ac-settings-icon" aria-hidden="true"><Icon size={20} /></span>
            <span className="ac-row-main"><span className="ac-row-title">{label}</span><span className="ac-row-sub">{sub}</span></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button></li>
        ))}
      </ul>
      {sheet === 'edit' && <Sheet title="Modifier le profil" onClose={() => setSheet(null)}><ProfileForm initial={p} onSaved={async () => { await reloadMe(); setSheet(null); }} /></Sheet>}
      {sheet === 'seller' && <SellerSheet onClose={() => setSheet(null)} />}
      {sheet === 'posts' && <MyPosts onClose={() => setSheet(null)} />}
      {sheet === 'sales' && <Sales onClose={() => setSheet(null)} />}
      {sheet === 'privacy' && <Privacy onClose={() => setSheet(null)} />}
      {sheet === 'admin' && <Admin onClose={() => setSheet(null)} />}
    </section>
  );
}

export function ProfileForm({ initial, onSaved }: { initial?: any; onSaved: () => Promise<void> | void }) {
  const { notify } = useAc() || ({} as any);
  const [handle, setHandle] = useState(initial?.handle || '');
  const [displayName, setDisplayName] = useState(initial?.displayName || '');
  const [bio, setBio] = useState(initial?.bio || '');
  const [photo, setPhoto] = useState<any>(undefined);
  const [preview, setPreview] = useState(initial?.photo || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true); setError('');
    try { const asset = await uploadAsset(file, { visibility: 'public', rt: 'image' }); setPhoto(asset); setPreview(URL.createObjectURL(file)); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };
  const submit = async (e: any) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await ac('profile.save', { handle, displayName, bio, ...(photo !== undefined ? { photo } : {}) });
      notify?.('Profil enregistré.', 'success');
      await onSaved();
    } catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };
  return (
    <form className="ac-form" onSubmit={submit}>
      <div className="ac-photo-pick">
        <Avatar name={displayName || handle} photo={preview} seed={handle} size={80} />
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <button type="button" className="ac-btn tonal small" onClick={() => fileRef.current?.click()} disabled={busy}><Camera size={15} aria-hidden="true" /> Photo</button>
      </div>
      <label className="ac-field"><span>Pseudonyme</span>
        <span className="ac-prefix"><span aria-hidden="true">@</span><input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} maxLength={24} minLength={3} autoCapitalize="none" spellCheck={false} required placeholder="mon_pseudo" /></span>
      </label>
      <label className="ac-field"><span>Nom affiché</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} required /></label>
      <label className="ac-field"><span>Biographie <em>facultatif</em></span><textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={3} /></label>
      {error && <p className="ac-error" role="alert">{error}</p>}
      <button type="submit" className="ac-btn filled" disabled={busy || handle.length < 3 || !displayName.trim()}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
      <p className="ac-hint">Votre adresse e-mail n’est jamais affichée. Seuls votre pseudonyme, votre nom, votre photo et votre biographie sont publics.</p>
    </form>
  );
}

function SellerSheet({ onClose }: { onClose: () => void }) {
  const { me, notify, reloadMe } = useAc();
  const pay = me.profile.payment || {};
  const [waveLink, setWaveLink] = useState(pay.waveLink || '');
  const [wavePhone, setWavePhone] = useState(pay.wavePhone || '');
  const [pispiAlias, setPispiAlias] = useState(pay.pispiAlias || '');
  const [whatsapp, setWhatsapp] = useState(pay.whatsapp || '');
  const [accept, setAccept] = useState(!!me.profile.seller);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: any) => {
    e.preventDefault();
    const input = { waveLink, wavePhone, pispiAlias, whatsapp, acceptTerms: accept };
    const check = normalizeSellerInput(input);
    if (check.error) { setError(SELLER_ERRORS[check.error]); return; }
    setBusy(true); setError('');
    try { await ac('seller.save', input); await reloadMe(); notify('Vente activée.', 'success'); onClose(); }
    catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };
  const disable = async () => {
    if (!window.confirm('Désactiver la vente ? Vos publications payantes ne pourront plus être achetées.')) return;
    try { await ac('seller.save', { enabled: false }); await reloadMe(); notify('Vente désactivée.', 'success'); onClose(); } catch (err: any) { notify(err.message, 'error'); }
  };
  return (
    <Sheet title="Vente et moyens de paiement" onClose={onClose}>
      <form className="ac-form" onSubmit={submit}>
        <p className="ac-note"><Info size={15} aria-hidden="true" /> <span>Les acheteurs vous paient <strong>directement</strong>. Vous confirmez chaque paiement après l’avoir vu arriver sur votre compte : c’est ce qui déverrouille le contenu.</span></p>
        <label className="ac-field"><span>Lien marchand Wave <em>recommandé</em></span><input value={waveLink} onChange={(e) => setWaveLink(e.target.value)} placeholder="https://pay.wave.com/m/…" autoCapitalize="none" spellCheck={false} /></label>
        <label className="ac-field"><span>ou numéro Wave</span><input value={wavePhone} onChange={(e) => setWavePhone(e.target.value)} inputMode="tel" placeholder="221770000000" /></label>
        <label className="ac-field"><span>Alias PI-SPI</span><input value={pispiAlias} onChange={(e) => setPispiAlias(e.target.value)} autoCapitalize="none" spellCheck={false} /></label>
        <label className="ac-field"><span>WhatsApp (contact acheteurs)</span><input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" placeholder="221770000000" /></label>
        <label className="ac-check"><input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} /> Je m’engage à ne vendre que des contenus dont je détiens les droits, à livrer ce qui est annoncé, à ne confirmer un paiement qu’après réception effective et à rembourser en cas de litige justifié. La commission éventuelle de la plateforme reste due sur chaque vente confirmée.</label>
        {error && <p className="ac-error" role="alert">{error}</p>}
        <button type="submit" className="ac-btn filled" disabled={busy}>{busy ? 'Enregistrement…' : me.profile.seller ? 'Enregistrer' : 'Activer la vente'}</button>
        {me.profile.seller && <button type="button" className="ac-btn text danger" onClick={disable}>Désactiver la vente</button>}
      </form>
    </Sheet>
  );
}

function MyPosts({ onClose }: { onClose: () => void }) {
  const { openPost, setTab } = useAc();
  const [posts, setPosts] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => { try { setPosts((await ac('post.mine')).posts); } catch (e: any) { setError(e.message); } }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <Sheet title="Mes publications" onClose={onClose} wide>
      {!posts ? (error ? <ErrorState error={error} onRetry={load} /> : <Loading />) : posts.length === 0 ? (
        <Empty icon={Store} title="Aucune publication"><button type="button" className="ac-btn filled" onClick={() => { onClose(); setTab('publish'); }}>Publier</button></Empty>
      ) : (
        <div className="ac-grid">{posts.map((p) => (
          <div key={p.id} className="ac-lib-item">
            <PostCard post={p} onOpen={() => openPost(p.id)} />
            <span className="ac-hint">{p.status === 'hidden' ? 'Retirée de la vente' : `${p.sales} vente${p.sales > 1 ? 's' : ''} · ${p.favorites} favori${p.favorites > 1 ? 's' : ''}`}</span>
          </div>
        ))}</div>
      )}
    </Sheet>
  );
}

function Sales({ onClose }: { onClose: () => void }) {
  const { openOrder } = useAc();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => { try { setData(await ac('order.sales')); } catch (e: any) { setError(e.message); } }, []);
  useEffect(() => { load(); }, [load]);
  const order = ['declared', 'disputed', 'pending', 'rejected', 'paid', 'refunded', 'cancelled'];
  return (
    <Sheet title="Ventes et revenus" onClose={onClose} wide>
      {!data ? (error ? <ErrorState error={error} onRetry={load} /> : <Loading />) : (
        <>
          <div className="ac-kpis">
            <div><span>Revenus confirmés</span><strong>{fcfa(data.summary.gross)}</strong></div>
            <div><span>30 derniers jours</span><strong>{fcfa(data.summary.gross30)}</strong></div>
            <div><span>Ventes</span><strong>{data.summary.salesCount}</strong></div>
            <div><span>Commission due</span><strong>{fcfa(data.summary.commissionDue)}</strong></div>
            <div><span>Net estimé</span><strong>{fcfa(data.summary.net)}</strong></div>
            <div className={data.summary.toVerify ? 'alert' : ''}><span>À vérifier</span><strong>{data.summary.toVerify}</strong></div>
          </div>
          {data.summary.disputes > 0 && <p className="ac-note warn"><AlertTriangle size={15} aria-hidden="true" /> {data.summary.disputes} litige{data.summary.disputes > 1 ? 's' : ''} en cours.</p>}
          <p className="ac-hint">Les paiements arrivent directement sur vos comptes Wave ou PI-SPI : il n’y a pas de retrait à demander. La commission de la plateforme, si elle est appliquée, se règle auprès de l’administration.</p>
          {data.orders.length === 0 ? <Empty icon={BarChart3} title="Aucune commande pour l’instant" /> : (
            <ul className="ac-list">
              {[...data.orders].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || b.updatedAt - a.updatedAt).map((o: any) => (
                <li key={o.id}><button type="button" className="ac-row" onClick={() => openOrder(o.id)}>
                  <span className="ac-row-main">
                    <span className="ac-row-top"><span className="ac-row-title">{o.postTitle}</span><span className="ac-row-time">{timeShort(o.updatedAt)}</span></span>
                    <span className="ac-row-bottom">
                      <span className="ac-row-sub">{o.ref} · {fcfa(o.amount)} · {METHOD_LABELS[o.method]} · {o.buyer?.displayName || ''}</span>
                      <span className={'ac-status s-' + o.status}>{ORDER_LABELS[o.status]}</span>
                    </span>
                  </span>
                </button></li>
              ))}
            </ul>
          )}
        </>
      )}
    </Sheet>
  );
}

function Privacy({ onClose }: { onClose: () => void }) {
  const { notify } = useAc();
  const [blocked, setBlocked] = useState<any[] | null>(null);
  const load = useCallback(async () => { try { setBlocked((await ac('block.list')).blocked); } catch (e: any) { notify(e.message, 'error'); } }, [notify]);
  useEffect(() => { load(); }, [load]);
  const unblock = async (uid: string) => { try { await ac('block.set', { uid, blocked: false }); await load(); } catch (e: any) { notify(e.message, 'error'); } };
  return (
    <Sheet title="Confidentialité et sécurité" onClose={onClose}>
      <ul className="ac-bullets">
        <li>Votre e-mail et votre numéro ne sont jamais affichés aux autres utilisateurs.</li>
        <li>Les fichiers des discussions et des contenus payants sont stockés en privé et servis par des liens temporaires (15 min).</li>
        <li>Un compte bloqué ne peut plus vous écrire ni commander vos contenus.</li>
        <li>L’administration ne lit pas vos discussions : elle ne voit que les éléments signalés.</li>
        <li>Ne communiquez jamais vos codes secrets Wave, PI-SPI ou bancaires.</li>
      </ul>
      <h3 className="ac-h3"><Ban size={16} aria-hidden="true" /> Comptes bloqués</h3>
      {!blocked ? <Loading /> : blocked.length === 0 ? <p className="ac-hint">Aucun compte bloqué.</p> : (
        <ul className="ac-list">
          {blocked.map((u) => (
            <li key={u.uid} className="ac-member">
              <span className="ac-row"><Avatar name={u.displayName} photo={u.photo} seed={u.uid} size={36} /><span className="ac-row-main"><span className="ac-row-title">{u.displayName}</span><span className="ac-row-sub">@{u.handle}</span></span></span>
              <button type="button" className="ac-btn tonal small" onClick={() => unblock(u.uid)}>Débloquer</button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
