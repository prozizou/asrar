'use client';
// Module « Zikr collectif » — objectif de dhikr COMMUN, cumulé entre plusieurs
// comptes. Liste publique des zikr collectifs, création (texte libre), adhésion
// validée par le créateur, contribution au total commun et classement des
// membres. Tout via /api/zikr (HTTPS/Admin SDK — jamais de RTDB client direct,
// cf. l'historique /api/check-access, /api/social).
import './zikr.css';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/useToast';
import Spinner from '@/components/Spinner';
import { playBeadSound, playGoalSound } from '@/lib/audio';
import { progressPct, NAME_MAX, PHRASE_MAX, TARGET_MAX } from '@/lib/zikrLogic';
import {
  listGroups, createGroup, getGroup, joinGroup,
  approveMember, rejectMember, contribute, leaveGroup, deleteGroup,
} from '@/lib/zikrCollectif';

const vibrate = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch {} };
const fmt = (n) => (Number(n) || 0).toLocaleString('fr-FR');

export default function ZikrCollectifPage() {
  const { user } = useAuth();
  const { notify, toast } = useToast();
  const [selected, setSelected] = useState(null); // groupId ou null (= liste)

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <Link href="/menu" className="back-btn">← Retour</Link>
      {selected ? (
        <GroupDetail
          groupId={selected}
          user={user}
          notify={notify}
          onBack={() => setSelected(null)}
        />
      ) : (
        <GroupList user={user} notify={notify} onOpen={setSelected} />
      )}
      {toast}
    </div>
  );
}

// ─────────────────────────── LISTE + CRÉATION ───────────────────────────
function GroupList({ notify, onOpen }) {
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await listGroups();
      setGroups(d.groups || []);
      setError('');
    } catch (e) {
      setError(e.message || 'Erreur de chargement.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="glass-panel">
      <div className="zk-hero">
        <div style={{ fontSize: '2.6rem' }}>🤲</div>
        <h1>Zikr collectif</h1>
        <p>Réciter un dhikr ensemble vers un objectif commun. Créez le vôtre ou rejoignez un groupe existant.</p>
      </div>

      <button className="zk-btn main zk-create-toggle" onClick={() => setCreating((v) => !v)}>
        {creating ? '✕ Annuler' : '➕ Créer un zikr collectif'}
      </button>

      {creating && (
        <CreateForm
          notify={notify}
          onCreated={(id) => { setCreating(false); load(); onOpen(id); }}
        />
      )}

      {groups === null ? (
        <div className="zk-loading"><Spinner /> Chargement…</div>
      ) : error ? (
        <p className="zk-error">{error} <button className="zk-link" onClick={load}>Réessayer</button></p>
      ) : groups.length === 0 ? (
        <p className="zk-empty">Aucun zikr collectif pour l’instant. Soyez le premier à en créer un 🌙</p>
      ) : (
        <div className="zk-list">
          {groups.map((g) => (
            <GroupCard key={g.id} g={g} onOpen={() => onOpen(g.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupCard({ g, onOpen }) {
  const pct = progressPct(g.total, g.target);
  const statusLabel = {
    owner: '👑 Créateur',
    member: '✓ Membre',
    pending: '⏳ En attente',
    none: 'Voir',
  }[g.status] || 'Voir';

  return (
    <button className="zk-card" onClick={onOpen}>
      <div className="zk-card-top">
        <span className="zk-card-name">{g.name}</span>
        <span className={'zk-badge zk-badge-' + g.status}>{statusLabel}</span>
      </div>
      <div className="zk-card-phrase">{g.phrase}</div>
      <div className="zk-bar"><span style={{ width: pct + '%' }} /></div>
      <div className="zk-card-meta">
        <span>{fmt(g.total)} / {fmt(g.target)}</span>
        <span>👥 {fmt(g.membersCount)}</span>
      </div>
    </button>
  );
}

function CreateForm({ notify, onCreated }) {
  const [name, setName] = useState('');
  const [phrase, setPhrase] = useState('');
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const d = await createGroup({ name, phrase, target });
      notify('✅ Zikr collectif créé.');
      onCreated(d.id);
    } catch (e) {
      notify('❌ ' + (e.message || e));
      setBusy(false);
    }
  };

  return (
    <div className="zk-form">
      <label className="zk-field">
        <span>Titre</span>
        <input
          type="text" maxLength={NAME_MAX} value={name}
          placeholder="Ex. Khatm Yâ Latîf"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="zk-field">
        <span>Formule à réciter</span>
        <input
          type="text" maxLength={PHRASE_MAX} value={phrase}
          placeholder="Ex. يا لطيف / Astaghfiroullah"
          onChange={(e) => setPhrase(e.target.value)}
        />
      </label>
      <label className="zk-field">
        <span>Objectif commun (nombre de récitations)</span>
        <input
          type="number" min="1" max={TARGET_MAX} value={target}
          placeholder="Ex. 100000"
          onChange={(e) => setTarget(e.target.value)}
        />
      </label>
      <button className="zk-btn main" onClick={submit} disabled={busy}>
        {busy ? 'Création…' : 'Créer'}
      </button>
    </div>
  );
}

// ─────────────────────────────── DÉTAIL ─────────────────────────────────
function GroupDetail({ groupId, user, notify, onBack }) {
  const [g, setG] = useState(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(0); // grains égrenés localement, pas encore validés
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await getGroup(groupId);
      setG(d);
      setError('');
    } catch (e) {
      setError(e.message || 'Erreur de chargement.');
    }
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  const tap = () => {
    setPending((n) => n + 1);
    playBeadSound();
    vibrate([18, 10, 20]);
  };

  const submitContribution = useCallback(async () => {
    if (submitting || pending <= 0) return;
    const amount = pending;
    setSubmitting(true);
    try {
      const d = await contribute(groupId, amount);
      setPending((n) => Math.max(0, n - amount)); // retire ce qu'on vient d'envoyer
      setG((prev) => prev && { ...prev, total: d.total, myContribution: d.myContribution });
      playGoalSound();
      vibrate([80, 40, 120]);
    } catch (e) {
      notify('❌ ' + (e.message || e)); // on GARDE `pending` : l'utilisateur peut réessayer sans reperdre ses grains
    } finally {
      setSubmitting(false);
    }
  }, [submitting, pending, groupId, notify]);

  const doJoin = async () => {
    try {
      const d = await joinGroup(groupId);
      notify(d.status === 'pending' ? '⏳ Demande envoyée au créateur.' : '✓ Vous avez rejoint le groupe.');
      load();
    } catch (e) {
      notify('❌ ' + (e.message || e));
    }
  };

  const doLeave = async () => {
    if (!window.confirm('Quitter ce zikr collectif ? Votre contribution reste comptée dans le total.')) return;
    try { await leaveGroup(groupId); notify('Vous avez quitté le groupe.'); onBack(); }
    catch (e) { notify('❌ ' + (e.message || e)); }
  };

  const doDelete = async () => {
    if (!window.confirm('Supprimer définitivement ce zikr collectif pour tous les membres ?')) return;
    try { await deleteGroup(groupId); notify('Zikr collectif supprimé.'); onBack(); }
    catch (e) { notify('❌ ' + (e.message || e)); }
  };

  const act = async (fn, uid) => {
    try { await fn(groupId, uid); load(); }
    catch (e) { notify('❌ ' + (e.message || e)); }
  };

  if (error) return <div className="glass-panel"><button className="zk-link" onClick={onBack}>← Liste</button><p className="zk-error">{error}</p></div>;
  if (!g) return <div className="glass-panel zk-loading"><Spinner /> Chargement…</div>;

  const pct = progressPct(g.total, g.target);
  const reached = g.target > 0 && g.total >= g.target;
  const isMember = g.status === 'member' || g.status === 'owner';

  return (
    <div className="glass-panel">
      <button className="zk-link" onClick={onBack}>← Liste des zikr</button>

      <div className="zk-detail-head">
        <h1>{g.name}</h1>
        <div className="zk-phrase-big" dir="auto">{g.phrase}</div>
        <div className="zk-owner">Créé par {g.ownerEmail}</div>
      </div>

      <div className="zk-progress-block">
        <div className="zk-bar big"><span style={{ width: pct + '%' }} className={reached ? 'done' : ''} /></div>
        <div className="zk-progress-meta">
          <strong>{fmt(g.total)}</strong> / {fmt(g.target)} ({Math.floor(pct)}%)
          {reached && <span className="zk-reached"> 🎉 Objectif atteint !</span>}
        </div>
        <div className="zk-stats">
          <div><b>{fmt(g.membersCount)}</b><small>membres</small></div>
          <div><b>{fmt(g.myContribution)}</b><small>ma part</small></div>
        </div>
      </div>

      {/* Zone de contribution (membres/créateur uniquement) */}
      {isMember ? (
        <div className="zk-contribute">
          <button className="zk-bead-btn" onClick={tap} aria-label="Égrainer un grain">
            <span className="zk-bead-count">{pending}</span>
            <span className="zk-bead-hint">Appuyez pour égrainer</span>
          </button>
          <button className="zk-btn main" onClick={submitContribution} disabled={submitting || pending <= 0}>
            {submitting ? 'Envoi…' : pending > 0 ? `Valider ma contribution (+${fmt(pending)})` : 'Rien à valider'}
          </button>
        </div>
      ) : g.status === 'pending' ? (
        <div className="zk-join-state">⏳ Votre demande est en attente de validation par le créateur.</div>
      ) : (
        <button className="zk-btn main" onClick={doJoin}>🤝 Demander à rejoindre</button>
      )}

      {/* Panneau créateur : demandes en attente */}
      {g.status === 'owner' && (
        <div className="zk-owner-panel">
          <h3>Demandes d’adhésion {g.pending > 0 && <span className="zk-pill">{g.pending}</span>}</h3>
          {(!g.requests || g.requests.length === 0) ? (
            <p className="zk-muted">Aucune demande en attente.</p>
          ) : (
            <div className="zk-req-list">
              {g.requests.map((r) => (
                <div key={r.uid} className="zk-req">
                  <span className="zk-req-email">{r.email}</span>
                  <span className="zk-req-actions">
                    <button className="zk-mini ok" onClick={() => act(approveMember, r.uid)}>Accepter</button>
                    <button className="zk-mini no" onClick={() => act(rejectMember, r.uid)}>Refuser</button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Classement des contributeurs */}
      <div className="zk-board">
        <h3>Classement des membres</h3>
        <div className="zk-board-list">
          {g.members.map((m, i) => (
            <div key={m.uid} className={'zk-board-row' + (m.uid === user?.uid ? ' me' : '')}>
              <span className="zk-rank">{i + 1}</span>
              <span className="zk-board-email">{m.email || 'Membre'}{m.uid === user?.uid ? ' (vous)' : ''}</span>
              <span className="zk-board-count">{fmt(m.contributed)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions de bas de page */}
      <div className="zk-footer-actions">
        {g.status === 'member' && (
          <button className="zk-btn ghost" onClick={doLeave}>Quitter le groupe</button>
        )}
        {g.status === 'owner' && (
          <button className="zk-btn danger" onClick={doDelete}>Supprimer le zikr collectif</button>
        )}
      </div>
    </div>
  );
}
