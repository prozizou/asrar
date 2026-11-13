'use client';
// Module « Visioconférence » — réunions Google Meet proposées par les
// utilisateurs et validées par l'administration, comme le Zikr collectif :
//   • chaque utilisateur crée sa réunion sur Google Meet, puis colle le lien
//     ici avec un titre, une date et une durée ;
//   • la réunion reste « En attente » (visible de son créateur seulement)
//     jusqu'à ce que l'administrateur l'approuve ; tous les utilisateurs
//     reçoivent alors une notification et la voient dans la liste ;
//   • « Rejoindre » ouvre Google Meet (application ou navigateur).
// L'API (pages/api/visio.js) fait autorité : validation du lien, droits,
// visibilité. Voir lib/visioLogic.js pour les règles partagées.
import './visio.css';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Plus, X, Video, CalendarClock, Clock, Check, Pencil, Trash2, Shield, ExternalLink, Radio, Info,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/useToast';
import SpinnerUntyped from '@/components/Spinner';
import { startVisiblePolling } from '@/lib/visiblePolling';
import { handleExternalLinkClick } from '@/lib/externalWindow';
import { listMeetings, createMeeting, updateMeeting, deleteMeeting, approveMeeting } from '@/lib/visio';
import {
  normalizeMeetingInput, MEETING_ERRORS, meetingPhase, TITLE_MAX, DESCRIPTION_MAX,
  DURATION_DEFAULT,
} from '@/lib/visioLogic';

const Spinner = SpinnerUntyped as any;
const LIST_POLL_MS = 30000;
const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];

type Notify = (msg: string, type?: 'success' | 'error' | 'info') => void;

interface Meeting {
  id: string;
  title: string;
  description: string;
  startAt: number;
  durationMin: number;
  approved: boolean;
  ownerName: string;
  ownerEmail?: string;
  meetUrl?: string;
  mine: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
// <input type="datetime-local"> (heure locale, sans fuseau) ↔ epoch ms.
const toLocalInputValue = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmtWhen = (ms: number) =>
  new Date(ms).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const fmtDuration = (min: number) => (min < 60 ? `${min} min` : min % 60 ? `${Math.floor(min / 60)} h ${pad(min % 60)}` : `${min / 60} h`);

export default function VisioPage() {
  const { user } = useAuth() as any;
  const { notify, toast } = useToast();
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const d = await listMeetings();
      setMeetings(d.meetings || []);
      setIsAdmin(!!d.isAdmin);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement.');
    } finally {
      setNow(Date.now());
    }
  }, []);

  useEffect(() => { if (user) return startVisiblePolling(load, LIST_POLL_MS); }, [load, user]);

  const all = meetings || [];
  const toModerate = isAdmin ? all.filter((m) => !m.approved) : [];
  const mineWaiting = isAdmin ? [] : all.filter((m) => !m.approved && m.mine);
  const listed = all.filter((m) => m.approved);

  const act = async (m: Meeting, kind: 'approve' | 'reject' | 'delete') => {
    const ask = kind === 'reject' ? `Refuser « ${m.title} » ? Le créateur sera averti.`
      : kind === 'delete' ? `Supprimer « ${m.title} » ?` : '';
    if (ask && !window.confirm(ask)) return;
    setBusy(m.id);
    try {
      if (kind === 'approve') {
        await approveMeeting(m.id);
        notify(`« ${m.title} » approuvée : tous les utilisateurs sont notifiés.`, 'success');
      } else {
        await deleteMeeting(m.id);
        notify(kind === 'reject' ? `« ${m.title} » refusée.` : `« ${m.title} » supprimée.`);
      }
      await load();
    } catch (e: any) {
      notify(String(e.message || e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const card = (m: Meeting) => editing === m.id ? (
    <MeetingForm key={m.id} initial={m} notify={notify} onCancel={() => setEditing(null)}
      onSaved={(approved) => {
        setEditing(null);
        notify(approved ? 'Visioconférence mise à jour.' : 'Modifications envoyées : la visioconférence repasse en validation.', 'success');
        load();
      }} />
  ) : (
    <MeetingCard key={m.id} m={m} now={now} isAdmin={isAdmin} busy={busy === m.id}
      onApprove={() => act(m, 'approve')} onReject={() => act(m, 'reject')}
      onDelete={() => act(m, 'delete')} onEdit={() => { setCreating(false); setEditing(m.id); }} />
  );

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <Link href="/menu" className="back-btn"><ArrowLeft size={18} aria-hidden="true" /> Retour</Link>
      <div className="vi-page">
        <div className="vi-hero">
          <h1>Visioconférence</h1>
          <p>Réunions en ligne sur Google Meet, proposées par la communauté et validées par l’administration.</p>
        </div>

        {toModerate.length > 0 && (
          <section className="vi-section" aria-label="Visioconférences à valider">
            <h2 className="vi-section-title">
              <Shield size={16} strokeWidth={2.5} aria-hidden="true" /> À valider <span className="vi-pill">{toModerate.length}</span>
            </h2>
            <div className="vi-list">{toModerate.map(card)}</div>
          </section>
        )}

        <button type="button" className="vi-btn main vi-create-toggle" onClick={() => { setEditing(null); setCreating((v) => !v); }}>
          {creating
            ? <><X size={16} strokeWidth={2.5} aria-hidden="true" /> Annuler</>
            : <><Plus size={16} strokeWidth={2.5} aria-hidden="true" /> Proposer une visioconférence</>}
        </button>

        {creating && (
          <MeetingForm notify={notify} onCancel={() => setCreating(false)} onSaved={() => {
            setCreating(false);
            notify(isAdmin ? 'Visioconférence créée : approuvez-la pour la publier.' : 'Visioconférence envoyée : elle sera visible de tous après validation par l’administration.', 'success');
            load();
          }} />
        )}

        {mineWaiting.length > 0 && (
          <section className="vi-section" aria-label="Mes propositions en attente">
            <h2 className="vi-section-title">
              <Clock size={16} strokeWidth={2.5} aria-hidden="true" /> En attente de validation <span className="vi-pill">{mineWaiting.length}</span>
            </h2>
            <div className="vi-list">{mineWaiting.map(card)}</div>
          </section>
        )}

        {meetings === null ? (
          error
            ? <p className="vi-error">{error} <button type="button" className="vi-mini" onClick={load}>Réessayer</button></p>
            : <div className="vi-loading"><Spinner /> Chargement…</div>
        ) : (
          <section className="vi-section" aria-label="Visioconférences programmées">
            <h2 className="vi-section-title">
              <CalendarClock size={16} strokeWidth={2.5} aria-hidden="true" /> Programmées <span className="vi-pill">{listed.length}</span>
            </h2>
            {error && <p className="vi-error">{error}</p>}
            {listed.length === 0
              ? <p className="vi-empty">Aucune visioconférence programmée pour l’instant.</p>
              : <div className="vi-list">{listed.map(card)}</div>}
          </section>
        )}
      </div>
      {toast}
    </div>
  );
}

function PhaseBadge({ m, now }: { m: Meeting; now: number }) {
  if (!m.approved) return <span className="vi-badge pending"><Clock size={11} strokeWidth={2.5} aria-hidden="true" /> En attente</span>;
  const phase = meetingPhase(m, now);
  if (phase === 'live') return <span className="vi-badge live"><Radio size={11} strokeWidth={2.5} aria-hidden="true" /> En cours</span>;
  if (phase === 'soon') return <span className="vi-badge soon">Bientôt</span>;
  if (phase === 'ended') return <span className="vi-badge ended">Terminée</span>;
  return null;
}

function MeetingCard({ m, now, isAdmin, busy, onApprove, onReject, onDelete, onEdit }: {
  m: Meeting; now: number; isAdmin: boolean; busy: boolean;
  onApprove: () => void; onReject: () => void; onDelete: () => void; onEdit: () => void;
}) {
  const phase = meetingPhase(m, now);
  const live = m.approved && phase === 'live';
  const canJoin = !!m.meetUrl && phase !== 'ended';
  const owner = m.mine ? 'Vous' : m.ownerName || 'Un membre';
  return (
    <article className={'vi-card' + (live ? ' live' : '') + (m.approved ? '' : ' pending')} aria-label={m.title}>
      <div className="vi-card-top">
        <span className="vi-card-icon" aria-hidden="true"><Video size={20} strokeWidth={2} /></span>
        <div className="vi-card-head">
          <span className="vi-card-title">{m.title}</span>
          <span className="vi-card-when">
            <CalendarClock size={13} strokeWidth={2.2} aria-hidden="true" /> {fmtWhen(m.startAt)} · {fmtDuration(m.durationMin)}
          </span>
          <span className="vi-card-owner">Proposée par {owner}{isAdmin && m.ownerEmail ? ` (${m.ownerEmail})` : ''}</span>
        </div>
        <PhaseBadge m={m} now={now} />
      </div>
      {m.description && <p className="vi-card-desc">{m.description}</p>}
      <div className="vi-card-actions">
        {canJoin && (
          <a className={'vi-btn vi-join' + (m.approved ? ' main' : '')} href={m.meetUrl} target="_blank" rel="noopener noreferrer"
            onClick={(event) => handleExternalLinkClick(event, m.meetUrl)}>
            <ExternalLink size={16} aria-hidden="true" /> {m.approved ? 'Rejoindre sur Google Meet' : 'Tester le lien'}
          </a>
        )}
        {isAdmin && !m.approved && (
          <>
            <button type="button" className="vi-mini ok" disabled={busy} onClick={onApprove}>
              <Check size={14} strokeWidth={2.5} aria-hidden="true" /> Approuver
            </button>
            <button type="button" className="vi-mini no" disabled={busy} onClick={onReject}>
              <X size={14} strokeWidth={2.5} aria-hidden="true" /> Refuser
            </button>
          </>
        )}
        {(m.mine || isAdmin) && phase !== 'ended' && (
          <button type="button" className="vi-mini" disabled={busy} onClick={onEdit}>
            <Pencil size={14} aria-hidden="true" /> Modifier
          </button>
        )}
        {(m.mine || (isAdmin && m.approved)) && (
          <button type="button" className="vi-mini no" disabled={busy} onClick={onDelete}>
            <Trash2 size={14} aria-hidden="true" /> Supprimer
          </button>
        )}
      </div>
    </article>
  );
}

function MeetingForm({ initial, notify, onCancel, onSaved }: {
  initial?: Meeting; notify: Notify; onCancel: () => void; onSaved: (approved: boolean) => void;
}) {
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [meetUrl, setMeetUrl] = useState(initial?.meetUrl || '');
  const [startAt, setStartAt] = useState(initial ? toLocalInputValue(initial.startAt) : '');
  const [durationMin, setDurationMin] = useState(initial?.durationMin || DURATION_DEFAULT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const durations = DURATIONS.includes(durationMin) ? DURATIONS : [...DURATIONS, durationMin].sort((a, b) => a - b);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const input = { title, description, meetUrl, startAt: startAt ? new Date(startAt).getTime() : NaN, durationMin };
    const norm = normalizeMeetingInput(input, Date.now());
    if (norm.error) { setError(MEETING_ERRORS[norm.error]); return; }
    setBusy(true); setError('');
    try {
      const r = initial ? await updateMeeting(initial.id, norm.value) : await createMeeting(norm.value);
      onSaved(!!r?.approved);
    } catch (e: any) {
      setError(String(e.message || e));
      notify(String(e.message || e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="vi-form" onSubmit={submit} noValidate>
      <p className="vi-help">
        1. Ouvrez <a href="https://meet.google.com/" target="_blank" rel="noopener noreferrer"
          onClick={(event) => handleExternalLinkClick(event, 'https://meet.google.com/')}>Google Meet</a>, choisissez
        « Nouvelle réunion » puis « Créer une réunion pour une date ultérieure » et copiez le lien.
        2. Collez-le ci-dessous avec la date et l’heure.
      </p>
      <label className="vi-field">
        <span>Titre</span>
        <input type="text" maxLength={TITLE_MAX} value={title} required placeholder="Ex. Cours sur les Noms divins"
          onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="vi-field">
        <span>Lien Google Meet</span>
        <input type="url" inputMode="url" value={meetUrl} required placeholder="https://meet.google.com/abc-defg-hij"
          autoCapitalize="none" spellCheck={false} onChange={(e) => setMeetUrl(e.target.value)} />
      </label>
      <div className="vi-row">
        <label className="vi-field">
          <span>Début</span>
          <input type="datetime-local" value={startAt} required onChange={(e) => setStartAt(e.target.value)} />
        </label>
        <label className="vi-field">
          <span>Durée</span>
          <select value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))}>
            {durations.map((d) => <option key={d} value={d}>{fmtDuration(d)}</option>)}
          </select>
        </label>
      </div>
      <label className="vi-field">
        <span>Description <em className="vi-optional">optionnel</em></span>
        <textarea maxLength={DESCRIPTION_MAX} value={description} rows={3} placeholder="Sujet, intervenant, programme…"
          onChange={(e) => setDescription(e.target.value)} />
      </label>
      <p className="vi-note">
        <Info size={14} aria-hidden="true" />
        <span>{initial ? 'Après modification, la visioconférence repasse en validation par l’administration.' : 'L’administration valide chaque visioconférence avant qu’elle soit visible de tous.'}</span>
      </p>
      {error && <p className="vi-error" role="alert">{error}</p>}
      <div className="vi-form-actions">
        {initial && <button type="button" className="vi-btn ghost" onClick={onCancel} disabled={busy}>Annuler</button>}
        <button type="submit" className="vi-btn main" disabled={busy}>
          {busy ? 'Envoi…' : initial ? 'Enregistrer' : 'Envoyer pour validation'}
        </button>
      </div>
    </form>
  );
}
