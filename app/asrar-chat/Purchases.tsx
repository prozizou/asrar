'use client';
// Onglet « Achats » : bibliothèque des contenus achetés, commandes (avec
// reprise du paiement) et favoris.
import { useCallback, useEffect, useState } from 'react';
import { Library, Receipt, Heart } from 'lucide-react';
import { ac } from '@/lib/asrarChat/client';
import { fcfa, METHOD_LABELS, ORDER_LABELS } from '@/lib/asrarChat/logic';
import { useAc } from './context';
import { Loading, ErrorState, Empty, PostCard, timeShort, dateTime } from './ui';

export default function Purchases() {
  const [view, setView] = useState<'library' | 'orders' | 'favorites'>('library');
  return (
    <section className="ac-tab" aria-label="Achats">
      <div className="ac-tabs" role="tablist">
        {[['library', 'Bibliothèque', Library], ['orders', 'Commandes', Receipt], ['favorites', 'Favoris', Heart]].map(([id, label, Icon]: any) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? 'on' : ''} onClick={() => setView(id)}><Icon size={16} aria-hidden="true" /> {label}</button>
        ))}
      </div>
      {view === 'library' && <LibraryView />}
      {view === 'orders' && <OrdersView />}
      {view === 'favorites' && <FavoritesView />}
    </section>
  );
}

function useLoad(action: string) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setData(await ac(action)); setError(''); } catch (e: any) { setError(e.message); }
  }, [action]);
  useEffect(() => { load(); }, [load]);
  return { data, error, load };
}

function LibraryView() {
  const { openPost } = useAc();
  const { data, error, load } = useLoad('library');
  if (!data) return error ? <ErrorState error={error} onRetry={load} /> : <Loading />;
  if (!data.items.length) return <Empty icon={Library} title="Bibliothèque vide">Les contenus achetés apparaissent ici dès que le vendeur a confirmé votre paiement.</Empty>;
  return (
    <div className="ac-grid">
      {data.items.map((p: any) => (
        <div key={p.id} className="ac-lib-item">
          <PostCard post={{ ...p, unlocked: p.active }} onOpen={() => openPost(p.id)} />
          <span className={'ac-hint' + (p.active ? '' : ' warn')}>{p.active ? (p.expiresAt ? `Accès jusqu’au ${dateTime(p.expiresAt)}` : 'Accès illimité') : 'Accès expiré'}</span>
        </div>
      ))}
    </div>
  );
}

function OrdersView() {
  const { openOrder } = useAc();
  const { data, error, load } = useLoad('order.mine');
  if (!data) return error ? <ErrorState error={error} onRetry={load} /> : <Loading />;
  if (!data.orders.length) return <Empty icon={Receipt} title="Aucune commande">Déverrouillez un contenu payant pour créer une commande.</Empty>;
  return (
    <ul className="ac-list">
      {data.orders.map((o: any) => (
        <li key={o.id}><button type="button" className="ac-row" onClick={() => openOrder(o.id)}>
          <span className="ac-row-main">
            <span className="ac-row-top"><span className="ac-row-title">{o.postTitle}</span><span className="ac-row-time">{timeShort(o.updatedAt)}</span></span>
            <span className="ac-row-bottom"><span className="ac-row-sub">{o.ref} · {fcfa(o.amount)} · {METHOD_LABELS[o.method]}</span><span className={'ac-status s-' + o.status}>{ORDER_LABELS[o.status]}</span></span>
          </span>
        </button></li>
      ))}
    </ul>
  );
}

function FavoritesView() {
  const { openPost } = useAc();
  const { data, error, load } = useLoad('post.favorites');
  if (!data) return error ? <ErrorState error={error} onRetry={load} /> : <Loading />;
  if (!data.posts.length) return <Empty icon={Heart} title="Aucun favori">Ajoutez des publications à vos favoris depuis leur fiche.</Empty>;
  return <div className="ac-grid">{data.posts.map((p: any) => <PostCard key={p.id} post={p} onOpen={() => openPost(p.id)} />)}</div>;
}
