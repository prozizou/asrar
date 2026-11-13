'use client';
// Administration Asrar-chat : statistiques, commission, signalements,
// commandes et litiges, utilisateurs (suspension), journal d'audit.
import { useCallback, useEffect, useState } from 'react';
import { Flag, Gavel, Users, ScrollText, LayoutDashboard, Search } from 'lucide-react';
import { ac } from '@/lib/asrarChat/client';
import { fcfa, ORDER_LABELS, METHOD_LABELS, REPORT_REASONS, COMMISSION_MAX } from '@/lib/asrarChat/logic';
import { useAc } from './context';
import { Sheet, Loading, ErrorState, Empty, Avatar, timeShort, dateTime } from './ui';

type View = 'overview' | 'reports' | 'orders' | 'users' | 'audit';

export default function Admin({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<View>('overview');
  const TABS: [View, string, any][] = [
    ['overview', 'Vue d’ensemble', LayoutDashboard], ['reports', 'Signalements', Flag], ['orders', 'Litiges', Gavel], ['users', 'Utilisateurs', Users], ['audit', 'Journal', ScrollText],
  ];
  return (
    <Sheet title="Administration Asrar-chat" onClose={onClose} wide>
      <div className="ac-tabs scroll" role="tablist">
        {TABS.map(([id, label, Icon]) => <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? 'on' : ''} onClick={() => setView(id)}><Icon size={15} aria-hidden="true" /> {label}</button>)}
      </div>
      {view === 'overview' && <Overview />}
      {view === 'reports' && <Reports />}
      {view === 'orders' && <Orders />}
      {view === 'users' && <UsersView />}
      {view === 'audit' && <Audit />}
    </Sheet>
  );
}

function useAdmin(action: string, body: any = {}) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const key = JSON.stringify(body);
  const load = useCallback(async () => {
    try { setData(await ac(action, JSON.parse(key))); setError(''); } catch (e: any) { setError(e.message); }
  }, [action, key]);
  useEffect(() => { setData(null); load(); }, [load]);
  return { data, error, load };
}

function Overview() {
  const { notify } = useAc();
  const { data, error, load } = useAdmin('admin.overview');
  const [rate, setRate] = useState('');
  useEffect(() => { if (data) setRate(String(data.commissionRate)); }, [data]);
  if (!data) return error ? <ErrorState error={error} onRetry={load} /> : <Loading />;
  const s = data.stats;
  const save = async () => {
    try { await ac('admin.commission', { rate: Number(rate) }); notify('Commission enregistrée (nouvelles commandes).', 'success'); await load(); } catch (e: any) { notify(e.message, 'error'); }
  };
  return (
    <>
      <div className="ac-kpis">
        <div><span>Comptes</span><strong>{s.users}</strong></div>
        <div><span>Vendeurs</span><strong>{s.sellers}</strong></div>
        <div><span>Publications</span><strong>{s.posts}</strong></div>
        <div><span>Payantes</span><strong>{s.paidPosts}</strong></div>
        <div><span>Ventes</span><strong>{s.sales}</strong></div>
        <div><span>Volume</span><strong>{fcfa(s.volume)}</strong></div>
        <div><span>Commissions dues</span><strong>{fcfa(s.commission)}</strong></div>
        <div className={s.disputes ? 'alert' : ''}><span>Litiges</span><strong>{s.disputes}</strong></div>
        <div className={s.openReports ? 'alert' : ''}><span>Signalements</span><strong>{s.openReports}</strong></div>
        <div><span>Paiements à vérifier</span><strong>{s.toVerify}</strong></div>
        <div><span>Suspendus</span><strong>{s.suspended}</strong></div>
      </div>
      <form className="ac-form ac-inline-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label className="ac-field"><span>Commission de la plateforme (%)</span>
          <input type="number" min={0} max={COMMISSION_MAX} step={0.5} value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
        <p className="ac-hint">S’applique aux nouvelles commandes. Les paiements allant directement aux vendeurs, la commission est une somme due par le vendeur, suivie ci-dessous.</p>
        <button type="submit" className="ac-btn filled small">Enregistrer</button>
      </form>
      <h3 className="ac-h3">Vendeurs (ventes confirmées)</h3>
      {data.sellers.length === 0 ? <p className="ac-hint">Aucune vente confirmée.</p> : (
        <table className="ac-table">
          <thead><tr><th>Vendeur</th><th>Ventes</th><th>Volume</th><th>Commission</th></tr></thead>
          <tbody>{data.sellers.map((v: any) => <tr key={v.uid}><td>{v.displayName || v.uid} {v.handle && <small>@{v.handle}</small>}</td><td>{v.sales}</td><td>{fcfa(v.volume)}</td><td>{fcfa(v.commission)}</td></tr>)}</tbody>
        </table>
      )}
    </>
  );
}

function Reports() {
  const { notify, openPost } = useAc();
  const [status, setStatus] = useState('open');
  const { data, error, load } = useAdmin('admin.reports', { status });
  const decide = async (rid: string, decision: string, label: string) => {
    if (decision !== 'dismiss' && !window.confirm(label + ' ?')) return;
    try { await ac('admin.resolveReport', { rid, decision }); notify('Décision enregistrée.', 'success'); await load(); } catch (e: any) { notify(e.message, 'error'); }
  };
  const reason = (id: string) => REPORT_REASONS.find((r) => r.id === id)?.label || id;
  return (
    <>
      <div className="ac-chips">{[['open', 'À traiter'], ['closed', 'Traités']].map(([id, l]) => <button key={id} type="button" className={'ac-chip' + (status === id ? ' on' : '')} onClick={() => setStatus(id)}>{l}</button>)}</div>
      {!data ? (error ? <ErrorState error={error} onRetry={load} /> : <Loading />) : data.reports.length === 0 ? <Empty icon={Flag} title="Aucun signalement" /> : (
        <ul className="ac-cards">
          {data.reports.map((r: any) => (
            <li key={r.id} className="ac-report">
              <div className="ac-report-head"><strong>{reason(r.reason)}</strong> <span className="ac-hint">{{ user: 'Compte', post: 'Publication', message: 'Message', conv: 'Discussion' }[r.target as string]} · {timeShort(r.at)}</span></div>
              <p className="ac-hint">Concerne <strong>{r.user.displayName || r.user.uid}</strong>{r.user.handle ? ` (@${r.user.handle})` : ''} — signalé par {r.reporter.displayName || r.reporter.uid}</p>
              {r.note && <p className="ac-about">« {r.note} »</p>}
              {r.snapshot && (
                <div className="ac-snapshot">
                  {r.snapshot.title && <strong>{r.snapshot.title}</strong>}
                  {(r.snapshot.text || r.snapshot.description || r.snapshot.about) && <p>{r.snapshot.text || r.snapshot.description || r.snapshot.about}</p>}
                  {r.snapshot.media && <a href={r.snapshot.media.url} target="_blank" rel="noopener noreferrer" className="ac-link">Voir la pièce jointe signalée</a>}
                  {r.pid && <button type="button" className="ac-link" onClick={() => openPost(r.pid, true)}>Examiner la publication</button>}
                </div>
              )}
              {r.status === 'open' ? (
                <div className="ac-row-actions">
                  <button type="button" className="ac-btn text small" onClick={() => decide(r.id, 'dismiss', 'Classer')}>Classer sans suite</button>
                  {r.target !== 'user' && <button type="button" className="ac-btn tonal small" onClick={() => decide(r.id, 'removeContent', 'Retirer le contenu')}>Retirer le contenu</button>}
                  <button type="button" className="ac-btn tonal small danger" onClick={() => decide(r.id, r.target === 'user' ? 'suspend' : 'removeAndSuspend', r.target === 'user' ? 'Suspendre le compte' : 'Retirer et suspendre le compte')}>{r.target === 'user' ? 'Suspendre' : 'Retirer et suspendre'}</button>
                </div>
              ) : <p className="ac-hint">Décision : {r.decision}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Orders() {
  const { openOrder } = useAc();
  const [status, setStatus] = useState('disputed');
  const { data, error, load } = useAdmin('admin.orders', { status });
  return (
    <>
      <div className="ac-chips">{['disputed', 'declared', 'pending', 'paid', 'refunded'].map((id) => <button key={id} type="button" className={'ac-chip' + (status === id ? ' on' : '')} onClick={() => setStatus(id)}>{ORDER_LABELS[id]}</button>)}</div>
      {!data ? (error ? <ErrorState error={error} onRetry={load} /> : <Loading />) : data.orders.length === 0 ? <Empty icon={Gavel} title="Aucune commande" /> : (
        <ul className="ac-list">
          {data.orders.map((o: any) => (
            <li key={o.id}><button type="button" className="ac-row" onClick={() => openOrder(o.id)}>
              <span className="ac-row-main">
                <span className="ac-row-top"><span className="ac-row-title">{o.ref} · {o.postTitle}</span><span className="ac-row-time">{timeShort(o.updatedAt)}</span></span>
                <span className="ac-row-sub">{fcfa(o.amount)} · {METHOD_LABELS[o.method]} · {o.buyer?.displayName} → {o.seller?.displayName}{o.refReused ? ' · référence réutilisée' : ''}</span>
              </span>
            </button></li>
          ))}
        </ul>
      )}
    </>
  );
}

function UsersView() {
  const { notify, openProfile } = useAc();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const { data, error, load } = useAdmin('admin.users', { q: query });
  const toggle = async (u: any) => {
    const reason = u.suspended ? '' : window.prompt(`Motif de la suspension de @${u.handle} :`, 'Non-respect des règles');
    if (!u.suspended && reason === null) return;
    try { await ac('admin.suspend', { uid: u.uid, suspended: !u.suspended, reason }); notify(u.suspended ? 'Compte rétabli.' : 'Compte suspendu.', 'success'); await load(); } catch (e: any) { notify(e.message, 'error'); }
  };
  return (
    <>
      <form className="ac-search" onSubmit={(e) => { e.preventDefault(); setQuery(q); }}>
        <Search size={18} aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pseudonyme (vide : comptes suspendus)" aria-label="Rechercher un compte" />
      </form>
      {!data ? (error ? <ErrorState error={error} onRetry={load} /> : <Loading />) : data.users.length === 0 ? <Empty icon={Users} title="Aucun compte" /> : (
        <ul className="ac-list">
          {data.users.map((u: any) => (
            <li key={u.uid} className="ac-member">
              <button type="button" className="ac-row" onClick={() => openProfile(u.uid)}>
                <Avatar name={u.displayName} photo={u.photo} seed={u.uid} size={36} />
                <span className="ac-row-main"><span className="ac-row-title">{u.displayName}</span><span className="ac-row-sub">@{u.handle}{u.seller ? ' · vendeur' : ''}{u.suspended ? ` · suspendu (${u.suspendedReason})` : ''}</span></span>
              </button>
              <button type="button" className={'ac-btn small ' + (u.suspended ? 'tonal' : 'tonal danger')} onClick={() => toggle(u)}>{u.suspended ? 'Rétablir' : 'Suspendre'}</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Audit() {
  const { data, error, load } = useAdmin('admin.audit');
  if (!data) return error ? <ErrorState error={error} onRetry={load} /> : <Loading />;
  return (
    <ol className="ac-timeline">
      {data.entries.map((e: any) => (
        <li key={e.id}><strong>{e.action}</strong> <span>{dateTime(e.at)} · {e.actor}</span><em>{Object.entries(e).filter(([k]) => !['id', 'action', 'at', 'actor'].includes(k)).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ')}</em></li>
      ))}
    </ol>
  );
}
