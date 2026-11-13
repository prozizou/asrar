'use client';
// Onglet « Discussions » : liste (non-lus, dernier message), recherche
// globale (comptes, groupes/chaînes publics, publications) et création.
import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Users, Megaphone, UserPlus, Link2, MessagesSquare, Lock, Globe, BellOff, X } from 'lucide-react';
import { ac } from '@/lib/asrarChat/client';
import { subscribeInbox } from '@/lib/asrarChat/live';
import { startVisiblePolling } from '@/lib/visiblePolling';
import { useAc } from './context';
import { Avatar, Loading, ErrorState, Empty, Sheet, timeShort, PostCard } from './ui';

export default function Chats() {
  const { me, openChat } = useAc();
  const [convs, setConvs] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState<null | 'menu' | 'dm' | 'group' | 'channel' | 'join'>(null);

  const load = useCallback(async () => {
    try { setConvs((await ac('conv.list')).convs); setError(''); }
    catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => startVisiblePolling(load, 30000), [load]);
  useEffect(() => subscribeInbox(me.uid, load), [me.uid, load]);

  return (
    <section className="ac-tab" aria-label="Discussions">
      <div className="ac-search">
        <Search size={18} aria-hidden="true" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher personnes, groupes, publications" aria-label="Recherche globale" />
        {q && <button type="button" className="ac-icon-btn" aria-label="Effacer" onClick={() => setQ('')}><X size={16} /></button>}
      </div>
      {q.trim().length >= 2 ? <GlobalSearch q={q.trim()} /> : convs === null ? (error ? <ErrorState error={error} onRetry={load} /> : <Loading />) : convs.length === 0 ? (
        <Empty icon={MessagesSquare} title="Aucune discussion">Écrivez à un vendeur, créez un groupe ou rejoignez une chaîne depuis l’Explorer.</Empty>
      ) : (
        <ul className="ac-list" aria-label="Vos discussions">
          {convs.map((c) => (
            <li key={c.id}>
              <button type="button" className="ac-row" onClick={() => openChat(c.id)}>
                <Avatar name={c.title} photo={c.photo} seed={c.id} />
                <span className="ac-row-main">
                  <span className="ac-row-top">
                    <span className="ac-row-title">
                      {c.type === 'channel' && <Megaphone size={14} aria-label="Chaîne" />}
                      {c.type === 'group' && <Users size={14} aria-label="Groupe" />}
                      {c.title}
                    </span>
                    <span className={'ac-row-time' + (c.unread ? ' unread' : '')}>{timeShort(c.lastAt)}</span>
                  </span>
                  <span className="ac-row-bottom">
                    <span className="ac-row-sub">{c.blocked ? 'Compte bloqué' : c.lastPreview || (c.type === 'dm' ? 'Nouvelle discussion' : `${c.membersCount} membre${c.membersCount > 1 ? 's' : ''}`)}</span>
                    {c.muted && <BellOff size={14} aria-label="Notifications coupées" />}
                    {c.unread > 0 && <span className="ac-badge" aria-label={`${c.unread} non lus`}>{c.unread > 99 ? '99+' : c.unread}</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="ac-fab" aria-label="Nouvelle discussion" onClick={() => setCreating('menu')}><Plus size={24} /></button>
      {creating === 'menu' && (
        <Sheet title="Nouvelle discussion" onClose={() => setCreating(null)}>
          <div className="ac-menu-list">
            <button type="button" onClick={() => setCreating('dm')}><UserPlus size={20} aria-hidden="true" /> Discussion privée</button>
            <button type="button" onClick={() => setCreating('group')}><Users size={20} aria-hidden="true" /> Nouveau groupe</button>
            <button type="button" onClick={() => setCreating('channel')}><Megaphone size={20} aria-hidden="true" /> Nouvelle chaîne</button>
            <button type="button" onClick={() => setCreating('join')}><Link2 size={20} aria-hidden="true" /> Rejoindre avec un lien</button>
          </div>
        </Sheet>
      )}
      {creating === 'dm' && <NewDm onClose={() => setCreating(null)} />}
      {(creating === 'group' || creating === 'channel') && <NewConv type={creating} onClose={() => setCreating(null)} />}
      {creating === 'join' && <JoinByLink onClose={() => setCreating(null)} />}
    </section>
  );
}

function GlobalSearch({ q }: { q: string }) {
  const { openChat, openPost, openProfile, notify } = useAc();
  const [res, setRes] = useState<any>(null);
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const [users, convs, posts] = await Promise.all([ac('explore.users', { q }), ac('explore.convs', { q }), ac('explore.posts', { q })]);
        if (alive) setRes({ users: users.users, convs: convs.convs, posts: posts.posts.slice(0, 12) });
      } catch (e: any) { if (alive) notify(e.message, 'error'); }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [q, notify]);
  if (!res) return <Loading label="Recherche…" />;
  const join = async (cid: string) => {
    try { await ac('conv.join', { cid }); openChat(cid); } catch (e: any) { notify(e.message, 'error'); }
  };
  if (!res.users.length && !res.convs.length && !res.posts.length) return <Empty icon={Search} title="Aucun résultat">Essayez un pseudonyme (sans @) ou un autre mot.</Empty>;
  return (
    <div className="ac-results">
      {res.users.length > 0 && <h3 className="ac-h3">Personnes</h3>}
      <ul className="ac-list">
        {res.users.map((u: any) => (
          <li key={u.uid}><button type="button" className="ac-row" onClick={() => openProfile(u.uid)}>
            <Avatar name={u.displayName} photo={u.photo} seed={u.uid} />
            <span className="ac-row-main"><span className="ac-row-title">{u.displayName}</span><span className="ac-row-sub">@{u.handle}{u.seller ? ' · Vendeur' : ''}</span></span>
          </button></li>
        ))}
      </ul>
      {res.convs.length > 0 && <h3 className="ac-h3">Groupes et chaînes</h3>}
      <ul className="ac-list">
        {res.convs.map((c: any) => (
          <li key={c.id}><button type="button" className="ac-row" onClick={() => join(c.id)}>
            <Avatar name={c.title} photo={c.photo} seed={c.id} />
            <span className="ac-row-main"><span className="ac-row-title">{c.type === 'channel' ? <Megaphone size={14} aria-hidden="true" /> : <Users size={14} aria-hidden="true" />} {c.title}</span><span className="ac-row-sub">{c.membersCount} membre{c.membersCount > 1 ? 's' : ''}</span></span>
          </button></li>
        ))}
      </ul>
      {res.posts.length > 0 && <h3 className="ac-h3">Publications</h3>}
      <div className="ac-grid">{res.posts.map((p: any) => <PostCard key={p.id} post={p} onOpen={() => openPost(p.id)} />)}</div>
    </div>
  );
}

function NewDm({ onClose }: { onClose: () => void }) {
  const { openChat, notify } = useAc();
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) { setUsers([]); return; }
    const t = setTimeout(() => ac('explore.users', { q: q.trim() }).then((r) => setUsers(r.users)).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [q]);
  const start = async (uid: string) => {
    try { const r = await ac('conv.dm', { uid }); onClose(); openChat(r.id); } catch (e: any) { notify(e.message, 'error'); }
  };
  return (
    <Sheet title="Discussion privée" onClose={onClose}>
      <label className="ac-field"><span>Pseudonyme</span>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="ex. vendeur_dakar" autoCapitalize="none" spellCheck={false} />
      </label>
      <ul className="ac-list">
        {users.map((u) => (
          <li key={u.uid}><button type="button" className="ac-row" onClick={() => start(u.uid)}>
            <Avatar name={u.displayName} photo={u.photo} seed={u.uid} />
            <span className="ac-row-main"><span className="ac-row-title">{u.displayName}</span><span className="ac-row-sub">@{u.handle}</span></span>
          </button></li>
        ))}
      </ul>
      {q.trim().length >= 2 && !users.length && <p className="ac-hint">Aucun compte trouvé pour ce pseudonyme.</p>}
    </Sheet>
  );
}

function NewConv({ type, onClose }: { type: 'group' | 'channel'; onClose: () => void }) {
  const { openChat, notify } = useAc();
  const [title, setTitle] = useState('');
  const [about, setAbout] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [busy, setBusy] = useState(false);
  const submit = async (e: any) => {
    e.preventDefault();
    setBusy(true);
    try { const r = await ac('conv.create', { type, title, about, visibility }); onClose(); openChat(r.id); }
    catch (err: any) { notify(err.message, 'error'); }
    finally { setBusy(false); }
  };
  return (
    <Sheet title={type === 'channel' ? 'Nouvelle chaîne' : 'Nouveau groupe'} onClose={onClose}>
      <form className="ac-form" onSubmit={submit}>
        <p className="ac-hint">{type === 'channel' ? 'Dans une chaîne, seuls vous et les administrateurs publiez ; les abonnés lisent et réagissent.' : 'Dans un groupe, tous les membres peuvent écrire.'}</p>
        <label className="ac-field"><span>Nom</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required /></label>
        <label className="ac-field"><span>Description</span><textarea value={about} onChange={(e) => setAbout(e.target.value)} maxLength={300} rows={2} /></label>
        <div className="ac-segmented" role="radiogroup" aria-label="Visibilité">
          <button type="button" role="radio" aria-checked={visibility === 'public'} className={visibility === 'public' ? 'on' : ''} onClick={() => setVisibility('public')}><Globe size={16} aria-hidden="true" /> Public</button>
          <button type="button" role="radio" aria-checked={visibility === 'private'} className={visibility === 'private' ? 'on' : ''} onClick={() => setVisibility('private')}><Lock size={16} aria-hidden="true" /> Privé</button>
        </div>
        <p className="ac-hint">{visibility === 'public' ? 'Visible dans l’Explorer : tout le monde peut rejoindre.' : 'Invisible dans l’Explorer : on rejoint uniquement avec votre lien d’invitation.'}</p>
        <button type="submit" className="ac-btn filled" disabled={busy || title.trim().length < 2}>{busy ? 'Création…' : 'Créer'}</button>
      </form>
    </Sheet>
  );
}

function JoinByLink({ onClose }: { onClose: () => void }) {
  const { openChat, notify } = useAc();
  const [link, setLink] = useState('');
  const submit = async (e: any) => {
    e.preventDefault();
    let code = link.trim();
    try { const u = new URL(code); code = u.searchParams.get('join') || code; } catch {}
    try { const r = await ac('conv.join', { inviteCode: code }); onClose(); openChat(r.id); }
    catch (err: any) { notify(err.message, 'error'); }
  };
  return (
    <Sheet title="Rejoindre avec un lien" onClose={onClose}>
      <form className="ac-form" onSubmit={submit}>
        <label className="ac-field"><span>Lien ou code d’invitation</span><input value={link} onChange={(e) => setLink(e.target.value)} autoCapitalize="none" spellCheck={false} required /></label>
        <button type="submit" className="ac-btn filled">Rejoindre</button>
      </form>
    </Sheet>
  );
}
