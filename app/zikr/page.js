'use client';
// Module « Zikr collectif » — objectif de dhikr COMMUN, réparti en PARTS entre
// plusieurs comptes (même logique que le ZIP « mon-chapelet » : part = objectif
// / parts, la dernière absorbant le reste). Chaque participant n'égrène QUE sa
// part ; son avancement remonte au groupe EN TEMPS RÉEL, sans validation
// manuelle (chaque frappe compte ; l'envoi au serveur est simplement regroupé
// ~800 ms après la dernière frappe, et le groupe est resondé toutes les 4 s).
//
// Tout via /api/zikr (HTTPS/Admin SDK — jamais de RTDB client direct, cf.
// l'historique /api/check-access, /api/social : ce canal WebSocket peut rester
// bloqué en silence sur certains réseaux ; d'où le sondage court plutôt qu'un
// abonnement RTDB temps réel).
import './zikr.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/useToast';
import Spinner from '@/components/Spinner';
import { playBeadSound, playGoalSound } from '@/lib/audio';
import { progressPct, partSize, NAME_MAX, PHRASE_MAX, TARGET_MAX, PARTS_MAX } from '@/lib/zikrLogic';
import {
  listGroups, createGroup, getGroup, joinGroup,
  approveMember, rejectMember, saveProgress, leaveGroup, deleteGroup,
} from '@/lib/zikrCollectif';

const vibrate = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch {} };
const fmt = (n) => (Number(n) || 0).toLocaleString('fr-FR');
const SAVE_DEBOUNCE = 800;  // regroupe les frappes avant l'envoi (comme le ZIP)
const POLL_MS = 4000;       // « temps réel » : resonde le groupe régulièrement

export default function ZikrCollectifPage() {
  const { user } = useAuth();
  const { notify, toast } = useToast();
  const [selected, setSelected] = useState(null); // groupId ou null (= liste)

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <Link href="/menu" className="back-btn">← Retour</Link>
      {selected ? (
        <GroupDetail groupId={selected} user={user} notify={notify} onBack={() => setSelected(null)} />
      ) : (
        <GroupList notify={notify} onOpen={setSelected} />
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
        <p>Réciter un dhikr ensemble vers un objectif commun, réparti en parts. Créez le vôtre ou rejoignez un groupe.</p>
      </div>

      <button className="zk-btn main zk-create-toggle" onClick={() => setCreating((v) => !v)}>
        {creating ? '✕ Annuler' : '➕ Créer un zikr collectif'}
      </button>

      {creating && (
        <CreateForm notify={notify} onCreated={(id) => { setCreating(false); load(); onOpen(id); }} />
      )}

      {groups === null ? (
        <div className="zk-loading"><Spinner /> Chargement…</div>
      ) : error ? (
        <p className="zk-error">{error} <button className="zk-link" onClick={load}>Réessayer</button></p>
      ) : groups.length === 0 ? (
        <p className="zk-empty">Aucun zikr collectif pour l’instant. Soyez le premier à en créer un 🌙</p>
      ) : (
        <div className="zk-list">
          {groups.map((g) => <GroupCard key={g.id} g={g} onOpen={() => onOpen(g.id)} />)}
        </div>
      )}
    </div>
  );
}

function GroupCard({ g, onOpen }) {
  const pct = progressPct(g.total, g.target);
  const full = g.membersCount >= g.parts && g.status === 'none';
  const statusLabel = {
    owner: '👑 Créateur',
    member: '✓ Membre',
    pending: '⏳ En attente',
    none: full ? 'Complet' : 'Voir',
  }[g.status] || 'Voir';

  return (
    <button className="zk-card" onClick={onOpen}>
      <div className="zk-card-top">
        <span className="zk-card-name">{g.name}</span>
        <span className={'zk-badge zk-badge-' + (full ? 'full' : g.status)}>{statusLabel}</span>
      </div>
      <div className="zk-card-phrase" dir="auto">{g.phrase}</div>
      <div className="zk-bar"><span style={{ width: pct + '%' }} /></div>
      <div className="zk-card-meta">
        <span>{fmt(g.total)} / {fmt(g.target)}</span>
        <span>👥 {fmt(g.membersCount)} / {fmt(g.parts)} parts</span>
      </div>
    </button>
  );
}

function CreateForm({ notify, onCreated }) {
  const [name, setName] = useState('');
  const [phrase, setPhrase] = useState('');
  const [target, setTarget] = useState('');
  const [parts, setParts] = useState('');
  const [busy, setBusy] = useState(false);

  const objectifNum = parseInt(target, 10) || 0;
  const partsNum = parseInt(parts, 10) || 0;
  const preview = objectifNum > 0 && partsNum > 0 ? partSize(objectifNum, partsNum, 0) : 0;

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const d = await createGroup({ name, phrase, target, parts });
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
        <input type="text" maxLength={NAME_MAX} value={name}
          placeholder="Ex. Salawat du vendredi" onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="zk-field">
        <span>Formule à réciter</span>
        <input type="text" maxLength={PHRASE_MAX} value={phrase} dir="auto"
          placeholder="Ex. يا لطيف / Astaghfiroullah" onChange={(e) => setPhrase(e.target.value)} />
      </label>
      <div className="zk-field-row">
        <label className="zk-field">
          <span>Objectif total</span>
          <input type="number" min="1" max={TARGET_MAX} value={target}
            placeholder="100000" onChange={(e) => setTarget(e.target.value)} />
        </label>
        <label className="zk-field">
          <span>Participants</span>
          <input type="number" min="1" max={PARTS_MAX} value={parts}
            placeholder="10" onChange={(e) => setParts(e.target.value)} />
        </label>
      </div>
      {preview > 0 && (
        <p className="zk-preview">Part de chacun : <strong>{fmt(preview)}</strong> grains (la dernière absorbe le reste).</p>
      )}
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

  const load = useCallback(async () => {
    try {
      const d = await getGroup(groupId);
      setG(d);
      setError('');
      return d;
    } catch (e) {
      setError(e.message || 'Erreur de chargement.');
      return null;
    }
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  const doJoin = async () => {
    try {
      const d = await joinGroup(groupId);
      notify(d.status === 'pending' ? '⏳ Demande envoyée au créateur.' : '✓ Vous avez rejoint le groupe.');
      load();
    } catch (e) { notify('❌ ' + (e.message || e)); }
  };
  const doLeave = async () => {
    if (!window.confirm('Quitter ce zikr collectif ? Votre part sera libérée pour quelqu’un d’autre.')) return;
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

  if (error) return (
    <div className="glass-panel">
      <button className="zk-link" onClick={onBack}>← Liste</button>
      <p className="zk-error">{error}</p>
    </div>
  );
  if (!g) return <div className="glass-panel zk-loading"><Spinner /> Chargement…</div>;

  const isMember = g.status === 'member' || g.status === 'owner';

  return (
    <div className="glass-panel">
      <button className="zk-link" onClick={onBack}>← Liste des zikr</button>

      <div className="zk-detail-head">
        <h1>{g.name}</h1>
        <div className="zk-phrase-big" dir="auto">{g.phrase}</div>
        <div className="zk-owner">Créé par {g.ownerEmail} · {fmt(g.membersCount)}/{fmt(g.parts)} parts</div>
      </div>

      {isMember ? (
        <MemberCounter groupId={groupId} initial={g} notify={notify} onRefresh={load} />
      ) : (
        <>
          <StaticProgress total={g.total} target={g.target} />
          {g.status === 'pending' ? (
            <div className="zk-join-state">⏳ Votre demande est en attente de validation par le créateur.</div>
          ) : g.full ? (
            <div className="zk-join-state">Ce zikr collectif est complet — toutes les parts sont prises.</div>
          ) : (
            <button className="zk-btn main" onClick={doJoin}>🤝 Demander à rejoindre</button>
          )}
        </>
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

      {/* Classement des contributeurs (part de chacun) */}
      <div className="zk-board">
        <h3>Parts des membres</h3>
        <div className="zk-board-list">
          {g.members.map((m, i) => (
            <div key={m.uid} className={'zk-board-row' + (m.uid === user?.uid ? ' me' : '')}>
              <span className="zk-rank">{i + 1}</span>
              <span className="zk-board-email">{m.email || 'Membre'}{m.uid === user?.uid ? ' (vous)' : ''}</span>
              <span className="zk-board-count">{fmt(m.fait)} / {fmt(m.part)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="zk-footer-actions">
        {g.status === 'member' && <button className="zk-btn ghost" onClick={doLeave}>Quitter le groupe</button>}
        {g.status === 'owner' && <button className="zk-btn danger" onClick={doDelete}>Supprimer le zikr collectif</button>}
      </div>
    </div>
  );
}

function StaticProgress({ total, target }) {
  const pct = progressPct(total, target);
  const reached = target > 0 && total >= target;
  return (
    <div className="zk-progress-block">
      <div className="zk-bar big"><span style={{ width: pct + '%' }} className={reached ? 'done' : ''} /></div>
      <div className="zk-progress-meta">
        <strong>{fmt(total)}</strong> / {fmt(target)} ({Math.floor(pct)}%)
        {reached && <span className="zk-reached"> 🎉 Objectif atteint !</span>}
      </div>
    </div>
  );
}

// Compteur d'un participant — égrène SA part, en temps réel, sans validation.
// Chaque frappe compte immédiatement en local ; l'envoi au serveur est
// regroupé (SAVE_DEBOUNCE) et le groupe est resondé (POLL_MS) pour refléter
// l'avancement des autres membres.
function MemberCounter({ groupId, initial, notify, onRefresh }) {
  const myPart = Number(initial.myPart) || 0;
  const [localFait, setLocalFait] = useState(Number(initial.myFait) || 0);
  const [serverTotal, setServerTotal] = useState(Number(initial.total) || 0);
  // fait déjà connu du serveur pour MOI : sert à corriger le total affiché
  // pendant que des frappes locales ne sont pas encore synchronisées.
  const syncedFait = useRef(Number(initial.myFait) || 0);
  const localFaitRef = useRef(localFait);
  const saveTimer = useRef(null);
  const reachedRef = useRef((Number(initial.myFait) || 0) >= myPart && myPart > 0);
  localFaitRef.current = localFait;

  const target = Number(initial.target) || 0;

  const flush = useCallback(async () => {
    const val = localFaitRef.current;
    if (val === syncedFait.current) return;
    try {
      const d = await saveProgress(groupId, val);
      syncedFait.current = Number(d.fait) || 0;
      setServerTotal(Number(d.total) || 0);
    } catch {
      // best-effort : on garde localFait, la prochaine frappe/flush réessaiera
    }
  }, [groupId]);

  const tap = () => {
    setLocalFait((n) => {
      if (n >= myPart) return n; // sa part est déjà terminée
      const next = n + 1;
      if (next >= myPart && !reachedRef.current) {
        reachedRef.current = true;
        playGoalSound();
        vibrate([90, 40, 120]);
      } else {
        playBeadSound();
        vibrate([16, 10, 20]);
      }
      return next;
    });
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, SAVE_DEBOUNCE);
  };

  // Sondage régulier : reflète l'avancement des AUTRES membres et le total.
  // Ne fait jamais RECULER mon compteur local (mes frappes en cours priment) ;
  // il ne peut que le rattraper si un autre appareil a avancé ma part.
  useEffect(() => {
    const poll = async () => {
      const d = await onRefresh();
      if (!d) return;
      setServerTotal(Number(d.total) || 0);
      const remoteFait = Number(d.myFait) || 0;
      if (remoteFait > localFaitRef.current) {
        syncedFait.current = remoteFait;
        setLocalFait(remoteFait);
      }
    };
    const id = setInterval(poll, POLL_MS);
    return () => {
      clearInterval(id);
      clearTimeout(saveTimer.current);
      flush(); // envoie les frappes restantes en quittant la vue
    };
  }, [onRefresh, flush]);

  // Total du groupe affiché : total serveur corrigé de mes frappes non encore
  // synchronisées, pour que la barre collective bouge dès que j'égrène.
  const groupTotal = Math.min(target || Infinity, serverTotal + (localFait - syncedFait.current));
  const groupPct = progressPct(groupTotal, target);
  const myPct = myPart > 0 ? Math.min(100, (localFait / myPart) * 100) : 0;
  const myDone = myPart > 0 && localFait >= myPart;

  return (
    <>
      <div className="zk-progress-block">
        <div className="zk-progress-meta"><span>Progression du groupe</span></div>
        <div className="zk-bar big"><span style={{ width: groupPct + '%' }} className={groupTotal >= target && target > 0 ? 'done' : ''} /></div>
        <div className="zk-progress-meta"><strong>{fmt(groupTotal)}</strong> / {fmt(target)} ({Math.floor(groupPct)}%)</div>

        <div className="zk-progress-meta" style={{ marginTop: 10 }}><span>Ma part</span></div>
        <div className="zk-bar big"><span className="gold" style={{ width: myPct + '%' }} /></div>
        <div className="zk-progress-meta"><strong>{fmt(localFait)}</strong> / {fmt(myPart)} grains</div>
      </div>

      <div className="zk-contribute">
        <button className="zk-bead-btn" onClick={tap} disabled={myDone} aria-label="Égrainer un grain">
          <span className="zk-bead-count">{fmt(localFait)}</span>
          <span className="zk-bead-hint">{myDone ? 'Part terminée 🌙' : 'Appuyez pour égrainer'}</span>
        </button>
      </div>
    </>
  );
}
