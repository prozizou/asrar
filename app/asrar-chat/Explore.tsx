'use client';
// Onglet « Explorer » : créateurs, chaînes et groupes publics, publications
// (gratuites/payantes), avec recherche, filtres et tri.
import { useCallback, useEffect, useState } from 'react';
import { Search, Compass, Megaphone, Users, X, SlidersHorizontal } from 'lucide-react';
import { ac } from '@/lib/asrarChat/client';
import { CATEGORIES, POST_KINDS, POST_KIND_LABELS } from '@/lib/asrarChat/logic';
import { useAc } from './context';
import { Avatar, Loading, ErrorState, Empty, PostCard } from './ui';

export default function Explore() {
  const { openPost, openProfile, openChat, notify } = useAc();
  const [q, setQ] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [kind, setKind] = useState('');
  const [sort, setSort] = useState('new');
  const [filters, setFilters] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [posts, sellers, convs] = await Promise.all([
        ac('explore.posts', { q, price, category, kind, sort }),
        ac('explore.sellers', { q }),
        ac('explore.convs', { q }),
      ]);
      setData({ posts: posts.posts, sellers: sellers.sellers, convs: convs.convs });
      setError('');
    } catch (e: any) { setError(e.message); }
  }, [q, price, category, kind, sort]);
  useEffect(() => { const t = setTimeout(load, q ? 350 : 0); return () => clearTimeout(t); }, [load, q]);

  const join = async (cid: string) => {
    try { await ac('conv.join', { cid }); openChat(cid); } catch (e: any) { notify(e.message, 'error'); }
  };

  return (
    <section className="ac-tab" aria-label="Explorer">
      <div className="ac-search">
        <Search size={18} aria-hidden="true" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher créateurs, contenus, chaînes" aria-label="Rechercher dans l’Explorer" />
        {q && <button type="button" className="ac-icon-btn" aria-label="Effacer" onClick={() => setQ('')}><X size={16} /></button>}
        <button type="button" className={'ac-icon-btn' + (filters ? ' on' : '')} aria-label="Filtres" aria-expanded={filters} onClick={() => setFilters((v) => !v)}><SlidersHorizontal size={18} /></button>
      </div>
      <div className="ac-chips" role="group" aria-label="Prix">
        {[['', 'Tout'], ['free', 'Gratuit'], ['paid', 'Payant']].map(([id, label]) => (
          <button key={id} type="button" className={'ac-chip' + (price === id ? ' on' : '')} aria-pressed={price === id} onClick={() => setPrice(id)}>{label}</button>
        ))}
        {[['new', 'Nouveautés'], ['popular', 'Populaires'], ['rating', 'Mieux notés']].map(([id, label]) => (
          <button key={id} type="button" className={'ac-chip' + (sort === id ? ' on' : '')} aria-pressed={sort === id} onClick={() => setSort(id)}>{label}</button>
        ))}
      </div>
      {filters && (
        <div className="ac-filters">
          <label className="ac-field"><span>Catégorie</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Toutes</option>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
          </label>
          <label className="ac-field"><span>Type</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Tous</option>{POST_KINDS.map((k) => <option key={k} value={k}>{POST_KIND_LABELS[k]}</option>)}</select>
          </label>
        </div>
      )}
      {!data ? (error ? <ErrorState error={error} onRetry={load} /> : <Loading />) : (
        <>
          {data.sellers.length > 0 && !category && !kind && (
            <>
              <h3 className="ac-h3">Créateurs et vendeurs</h3>
              <div className="ac-hscroll">
                {data.sellers.map((s: any) => (
                  <button key={s.uid} type="button" className="ac-creator" onClick={() => openProfile(s.uid)}>
                    <Avatar name={s.displayName} photo={s.photo} seed={s.uid} size={56} />
                    <span className="ac-creator-name">{s.displayName}</span>
                    <span className="ac-creator-sub">{s.stats?.posts || 0} publication{(s.stats?.posts || 0) > 1 ? 's' : ''}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {data.convs.length > 0 && !category && !kind && !price && (
            <>
              <h3 className="ac-h3">Chaînes et groupes publics</h3>
              <ul className="ac-list">
                {data.convs.slice(0, 6).map((c: any) => (
                  <li key={c.id}><button type="button" className="ac-row" onClick={() => join(c.id)}>
                    <Avatar name={c.title} photo={c.photo} seed={c.id} size={42} />
                    <span className="ac-row-main">
                      <span className="ac-row-title">{c.type === 'channel' ? <Megaphone size={14} aria-hidden="true" /> : <Users size={14} aria-hidden="true" />} {c.title}</span>
                      <span className="ac-row-sub">{c.about || `${c.membersCount} membre${c.membersCount > 1 ? 's' : ''}`}</span>
                    </span>
                    <span className="ac-btn tonal small">Rejoindre</span>
                  </button></li>
                ))}
              </ul>
            </>
          )}
          <h3 className="ac-h3">Publications</h3>
          {data.posts.length === 0 ? <Empty icon={Compass} title="Aucune publication">Modifiez les filtres ou publiez le premier contenu.</Empty> : (
            <div className="ac-grid">{data.posts.map((p: any) => <PostCard key={p.id} post={p} onOpen={() => openPost(p.id)} />)}</div>
          )}
        </>
      )}
    </section>
  );
}
