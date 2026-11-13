'use client';
// Vitrine d'un compte : profil, statistiques, note moyenne, publications,
// contact (message privé), partage, blocage et signalement.
import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Share2, Flag, Ban, Store } from 'lucide-react';
import { ac } from '@/lib/asrarChat/client';
import { useAc } from './context';
import { Sheet, Loading, ErrorState, Avatar, Empty, PostCard, Stars } from './ui';
import ReportSheet from './ReportSheet';

export default function Storefront({ uid, onClose }: { uid: string; onClose: () => void }) {
  const { me, notify, openChat, openPost } = useAc();
  const [data, setData] = useState<any>(null);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState('');
  const [reporting, setReporting] = useState(false);
  const load = useCallback(async () => {
    try {
      const [store, prof] = await Promise.all([ac('storefront', { uid }), ac('profile.get', { uid })]);
      setData(store); setBlocked(prof.blocked); setError('');
    } catch (e: any) { setError(e.message); }
  }, [uid]);
  useEffect(() => { load(); }, [load]);

  const p = data?.profile;
  const mine = uid === me.uid;
  const message = async () => { try { const r = await ac('conv.dm', { uid }); openChat(r.id); } catch (e: any) { notify(e.message, 'error'); } };
  const share = async () => {
    const url = `${window.location.origin}/asrar-chat?u=${encodeURIComponent(p.handle)}`;
    try { if (navigator.share) await navigator.share({ title: p.displayName, url }); else { await navigator.clipboard.writeText(url); notify('Lien du profil copié.', 'success'); } } catch {}
  };
  const toggleBlock = async () => {
    if (!blocked && !window.confirm(`Bloquer ${p.displayName} ?`)) return;
    try { await ac('block.set', { uid, blocked: !blocked }); setBlocked(!blocked); notify(blocked ? 'Compte débloqué.' : 'Compte bloqué.', 'success'); } catch (e: any) { notify(e.message, 'error'); }
  };
  return (
    <Sheet title={p ? p.displayName : 'Profil'} onClose={onClose} wide>
      {!data ? (error ? <ErrorState error={error} onRetry={load} /> : <Loading />) : (
        <div className="ac-store">
          <div className="ac-info-head">
            <Avatar name={p.displayName} photo={p.photo} seed={uid} size={84} />
            <strong>{p.displayName}</strong>
            <span className="ac-hint">@{p.handle}{p.seller ? ' · Vendeur' : ''}</span>
            {p.bio && <p className="ac-about">{p.bio}</p>}
            <div className="ac-stats">
              <span><strong>{data.posts.length}</strong> publication{data.posts.length > 1 ? 's' : ''}</span>
              <span><strong>{p.stats?.sales || 0}</strong> vente{(p.stats?.sales || 0) > 1 ? 's' : ''}</span>
              {p.rating > 0 && <Stars value={p.rating} />}
            </div>
          </div>
          <div className="ac-row-actions center">
            {!mine && <button type="button" className="ac-btn filled" onClick={message} disabled={blocked}><MessageCircle size={16} aria-hidden="true" /> Message</button>}
            <button type="button" className="ac-btn tonal" onClick={share}><Share2 size={16} aria-hidden="true" /> Partager</button>
            {!mine && <button type="button" className="ac-btn text" onClick={toggleBlock}><Ban size={16} aria-hidden="true" /> {blocked ? 'Débloquer' : 'Bloquer'}</button>}
            {!mine && <button type="button" className="ac-btn text" onClick={() => setReporting(true)}><Flag size={16} aria-hidden="true" /> Signaler</button>}
          </div>
          <h3 className="ac-h3">Publications et services</h3>
          {data.posts.length === 0 ? <Empty icon={Store} title="Aucune publication" /> : (
            <div className="ac-grid">{data.posts.map((x: any) => <PostCard key={x.id} post={x} onOpen={() => openPost(x.id)} />)}</div>
          )}
        </div>
      )}
      {reporting && <ReportSheet target={{ target: 'user', uid }} onClose={() => setReporting(false)} />}
    </Sheet>
  );
}
