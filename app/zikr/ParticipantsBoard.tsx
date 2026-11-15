'use client';
// Écran « Participants » du Zikr collectif (Material 3, sombre, compact) :
// 4 indicateurs, recherche instantanée, tri, filtres (Tous / En ligne /
// Actifs / Inactifs), rappel aux inactifs avec suivi des avertissements, et
// classement des participants. Données et règles inchangées : liste et
// présence viennent du sondage de GroupDetail (pages/api/zikr.js handleGet),
// email / téléphone / rythme / avertissement ne sont fournis qu'au
// créateur et à l'administration (canModerate).
import { useMemo, useState } from 'react';
import {
  Users, CircleCheck, AlarmClockOff, Search, X, ListFilter, Bell, Zap, AlertTriangle, Crown, MessageCircle, UserX, BellRing,
} from 'lucide-react';
import MoreMenuUntyped from '@/components/MoreMenu';
import { RYTHME_SUSPECT, chatDisplayName, avatarColorFor } from '@/lib/zikrLogic';

const MoreMenu = MoreMenuUntyped as any;
const fmt = (n: number) => (Number(n) || 0).toLocaleString('fr-FR');
const DAY_MS = 86400000;

export interface BoardMember {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
  phone?: string;
  fait: number;
  rythme: number;
  online: boolean;
  warning?: { at: number; deadline: number } | null;
  dailyTotal: number;
}

type Filter = 'all' | 'online' | 'active' | 'inactive';
type Sort = 'total' | 'today' | 'online' | 'name';

const SORTS: { id: Sort; label: string }[] = [
  { id: 'total', label: 'Total de grains' },
  { id: 'today', label: 'Aujourd’hui' },
  { id: 'online', label: 'En ligne d’abord' },
  { id: 'name', label: 'Nom (A → Z)' },
];

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function ParticipantsBoard({
  members, uid, ownerUid, canModerate, full, notifyBusy, onNotifyInactive, onMessage, onExclude,
}: {
  members: BoardMember[];
  uid: string;
  ownerUid: string;
  canModerate: boolean;
  full: boolean;
  notifyBusy: boolean;
  onNotifyInactive: () => void;
  onMessage: (m: BoardMember) => void;
  onExclude: (m: BoardMember) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('total');

  // Classement fixe (total de grains décroissant), indépendant du tri et des
  // filtres : la place d'un participant ne change pas quand on filtre.
  const rank = useMemo(() => {
    const ordered = [...members].sort((a, b) => b.fait - a.fait);
    return new Map(ordered.map((m, i) => [m.uid, i + 1]));
  }, [members]);

  const counts = useMemo(() => ({
    all: members.length,
    online: members.filter((m) => m.online).length,
    active: members.filter((m) => m.fait > 0).length,
    inactive: members.filter((m) => m.fait === 0).length,
  }), [members]);

  // Rappel aux inactifs (créateur/administration) : mêmes cibles que le
  // serveur (0 grain, hors créateur et soi-même) ; ceux déjà avertis ne sont
  // pas relancés (pages/api/zikr.js handleNotifyInactive).
  const now = Date.now();
  const inactiveTargets = members.filter((m) => m.uid !== uid && m.uid !== ownerUid && m.fait === 0);
  const warned = inactiveTargets.filter((m) => m.warning && m.warning.deadline > 0);
  const toNotify = inactiveTargets.length - warned.length;
  const nextDeadline = warned.reduce((min, m) => Math.min(min, m.warning!.deadline), Infinity);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    let list = members.filter((m) => (filter === 'online' ? m.online : filter === 'active' ? m.fait > 0 : filter === 'inactive' ? m.fait === 0 : true));
    if (q) list = list.filter((m) => normalize(chatDisplayName(m.email, m.name)).includes(q) || (canModerate && normalize(m.email || '').includes(q)));
    const byName = (a: BoardMember, b: BoardMember) => chatDisplayName(a.email, a.name).localeCompare(chatDisplayName(b.email, b.name), 'fr');
    return [...list].sort((a, b) => {
      if (sort === 'name') return byName(a, b);
      if (sort === 'today') return b.dailyTotal - a.dailyTotal || b.fait - a.fait;
      if (sort === 'online') return Number(b.online) - Number(a.online) || b.fait - a.fait;
      return b.fait - a.fait;
    });
  }, [members, query, filter, sort, canModerate]);

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Tous' }, { id: 'online', label: 'En ligne' }, { id: 'active', label: 'Actifs' }, { id: 'inactive', label: 'Inactifs' },
  ];

  return (
    <section className="zp-board" aria-label="Participants">
      <div className="zp-stats" role="list">
        <Stat icon={<Users size={20} aria-hidden="true" />} label="Participants" value={counts.all} />
        <Stat icon={<CircleCheck size={20} aria-hidden="true" />} label="Ont récité" value={counts.active} />
        <Stat icon={<span className="zp-dot on" aria-hidden="true" />} label="En ligne" value={counts.online} />
        <Stat icon={<AlarmClockOff size={20} aria-hidden="true" />} label="Inactifs" value={counts.inactive} />
      </div>

      <div className="zp-tools">
        <label className="zp-search">
          <Search size={18} aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un participant…" aria-label="Rechercher un participant" />
          {query && <button type="button" className="zp-clear" aria-label="Effacer la recherche" onClick={() => setQuery('')}><X size={16} /></button>}
        </label>
        <label className="zp-sort" title="Trier">
          <ListFilter size={18} aria-hidden="true" />
          <span className="zp-sort-label">Trier</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Trier les participants">
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      </div>

      <div className="zp-chips" role="group" aria-label="Filtrer les participants">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className={'zp-chip' + (filter === f.id ? ' on' : '')} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label} ({counts[f.id]})
          </button>
        ))}
      </div>

      {canModerate && inactiveTargets.length > 0 && (
        <div className="zp-notify">
          <button type="button" className="zp-notify-btn" onClick={onNotifyInactive} disabled={notifyBusy || toNotify === 0 || full}
            title="Avertir les comptes n’ayant récité aucun grain : sans récitation sous 7 jours, ils seront retirés du groupe">
            {toNotify > 0 ? <Bell size={17} aria-hidden="true" /> : <BellRing size={17} aria-hidden="true" />}
            {notifyBusy ? 'Envoi…' : toNotify > 0 ? `Notifier les inactifs (${toNotify})` : 'Inactifs déjà avertis'}
          </button>
          {warned.length > 0 && (
            <p className="zp-notify-note">
              {warned.length} déjà averti{warned.length > 1 ? 's' : ''}
              {Number.isFinite(nextDeadline) && nextDeadline > now && ` · prochaine échéance dans ${Math.max(1, Math.ceil((nextDeadline - now) / DAY_MS))} j`}
              {' '}· pas de second rappel.
            </p>
          )}
        </div>
      )}

      {members.length === 0 ? (
        <div className="zp-empty">
          <Users size={24} strokeWidth={1.75} aria-hidden="true" />
          <strong>Personne n’a encore rejoint</strong>
          <span>Partagez le lien du zikr pour inviter des participants.</span>
        </div>
      ) : visible.length === 0 ? (
        <div className="zp-empty">
          <Search size={22} strokeWidth={1.75} aria-hidden="true" />
          <strong>Aucun participant</strong>
          <span>Modifiez la recherche ou le filtre.</span>
        </div>
      ) : (
        <ul className="zp-list">
          {visible.map((m) => (
            <Row key={m.uid} m={m} rank={rank.get(m.uid) || 0} me={m.uid === uid} owner={m.uid === ownerUid}
              canModerate={canModerate} full={full} now={now} onMessage={onMessage} onExclude={onExclude} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Stat({ icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="zp-stat" role="listitem">
      <span className="zp-stat-icon">{icon}</span>
      <span className="zp-stat-label">{label}</span>
      <strong className="zp-stat-value">{fmt(value)}</strong>
    </div>
  );
}

function Row({ m, rank, me, owner, canModerate, full, now, onMessage, onExclude }: {
  m: BoardMember; rank: number; me: boolean; owner: boolean; canModerate: boolean; full: boolean; now: number;
  onMessage: (m: BoardMember) => void; onExclude: (m: BoardMember) => void;
}) {
  const name = chatDisplayName(m.email, m.name);
  const suspect = m.rythme >= RYTHME_SUSPECT;
  const daysLeft = m.warning && m.warning.deadline > now ? Math.ceil((m.warning.deadline - now) / DAY_MS) : 0;
  const canAct = canModerate && !me && !owner;
  return (
    <li className={'zp-row' + (me ? ' me' : '')}>
      <span className={'zp-rank' + (rank <= 3 ? ' top r' + rank : '')} aria-label={`Rang ${rank}`}>{rank}</span>
      <span className="zp-avatar-wrap">
        {m.picture
          // eslint-disable-next-line @next/next/no-img-element -- avatar Google, URL dynamique
          ? <img className="zp-avatar" src={m.picture} alt="" loading="lazy" />
          : <span className="zp-avatar zp-avatar-fallback" style={{ background: avatarColorFor(m.uid) }}>{name.charAt(0).toUpperCase()}</span>}
        <span className={'zp-dot zp-avatar-dot' + (m.online ? ' on' : '')} role="img" aria-label={m.online ? 'En ligne' : 'Hors ligne'} />
      </span>
      <span className="zp-id">
        <span className="zp-name">
          <span className="zp-name-text">{name}</span>
          {owner && <Crown size={13} className="zp-owner" aria-label="Créateur du zikr" />}
          {me && <span className="zp-you">Vous</span>}
        </span>
        {canModerate && m.email && <span className="zp-sub">{m.email}</span>}
        {canModerate && m.warning && (
          <span className="zp-warned" title={m.warning.at ? `Averti le ${new Date(m.warning.at).toLocaleString('fr-FR')} · échéance ${new Date(m.warning.deadline).toLocaleString('fr-FR')}` : 'Avertissement antérieur, sans délai automatique. Renouvelez-le pour démarrer les 7 jours.'}
            aria-label={daysLeft ? `Averti, retrait dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''} sans récitation` : 'Averti'}>Averti</span>
        )}
      </span>
      <span className="zp-figures">
        <span className="zp-total">{fmt(m.fait)} <small>grains</small></span>
        {m.dailyTotal > 0 && <span className="zp-today">+{fmt(m.dailyTotal)} aujourd’hui</span>}
        {canModerate && m.rythme > 0 && (
          <span className={'zp-pace' + (suspect ? ' suspect' : '')} title={suspect ? 'Rythme inhabituel' : 'Rythme instantané'}>
            {suspect ? <AlertTriangle size={12} aria-hidden="true" /> : <Zap size={12} aria-hidden="true" />} {m.rythme}/min
          </span>
        )}
      </span>
      {canAct ? (
        <MoreMenu label={`Actions de modération pour ${m.email}`}>
          {/* Une seule entrée : la fenêtre prépare le message, l'avertissement
              et, si le numéro est connu, le lien WhatsApp. */}
          <button type="button" className="zk-attach-item" onClick={() => onMessage(m)} disabled={full}>
            {m.phone ? <MessageCircle size={16} strokeWidth={2.5} aria-hidden="true" /> : <AlertTriangle size={16} strokeWidth={2.5} aria-hidden="true" />} Message et avertissement
          </button>
          <button type="button" className="zk-attach-item zk-attach-item-danger" onClick={() => onExclude(m)}>
            <UserX size={16} strokeWidth={2.5} aria-hidden="true" /> Exclure du groupe
          </button>
        </MoreMenu>
      ) : <span className="zp-menu-placeholder" aria-hidden="true" />}
    </li>
  );
}
