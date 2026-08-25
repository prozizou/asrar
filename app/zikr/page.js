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
import TasbihChapelet from '@/components/TasbihChapelet';
import { useTasbih } from '@/components/useTasbih';
import { progressPct, partSize, NAME_MAX, PHRASE_MAX, TARGET_MAX, PARTS_MAX } from '@/lib/zikrLogic';
import {
  listGroups, createGroup, getGroup, joinGroup,
  approveMember, rejectMember, saveProgress, leaveGroup, deleteGroup,
} from '@/lib/zikrCollectif';

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
        <MemberCounter groupId={groupId} initial={g} onRefresh={load} />
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

// Compteur d'un participant — il égrène SA part avec le MÊME chapelet que
// « Noms d'Allah » (components/TasbihChapelet.js), en temps réel et sans
// validation : chaque grain compte immédiatement, l'envoi au serveur est
// simplement regroupé SAVE_DEBOUNCE ms après la dernière frappe (comme le ZIP
// de référence), et le groupe est resondé (POLL_MS) pour refléter l'avancement
// des autres membres.
//
// La clé de persistance est propre à CE zikr collectif (`collectif_{gid}`) :
// sans cela, égrener ici ferait aussi avancer le compteur personnel de la même
// formule dans « Noms d'Allah ».
function MemberCounter({ groupId, initial, onRefresh }) {
  const myPart = Number(initial.myPart) || 0;
  const target = Number(initial.target) || 0;

  const t = useTasbih(`collectif_${groupId}`, myPart);

  // Avancement déduit du compteur, borné à la part (même calcul que le ZIP :
  // séries bouclées × base + série en cours). `t.total` ne convient pas ici,
  // il se cale sur l'objectif SAISI, alors que la référence est la part.
  const { count, loopCur, series } = t;
  const seriesCount = parseInt(series, 10) || 0;
  const base = seriesCount > 0 ? Math.floor(myPart / seriesCount) : 0;
  const fait = Math.min(myPart, base * loopCur + count);

  const [serverTotal, setServerTotal] = useState(Number(initial.total) || 0);
  // Dernière valeur connue du serveur pour MOI : sert à corriger le total
  // affiché tant que des grains locaux ne sont pas encore synchronisés.
  const syncedFait = useRef(Number(initial.myFait) || 0);
  const faitRef = useRef(fait);
  faitRef.current = fait;

  const flush = useCallback(async () => {
    const val = faitRef.current;
    if (val === syncedFait.current) return;
    try {
      const d = await saveProgress(groupId, val);
      syncedFait.current = Number(d.fait) || 0;
      setServerTotal(Number(d.total) || 0);
    } catch {
      // best-effort : la prochaine frappe (ou le démontage) réessaiera
    }
  }, [groupId]);

  // Envoi groupé : une écriture après SAVE_DEBOUNCE ms sans nouvelle frappe,
  // plutôt qu'une par grain.
  useEffect(() => {
    if (fait === syncedFait.current) return undefined;
    const timer = setTimeout(flush, SAVE_DEBOUNCE);
    return () => clearTimeout(timer);
  }, [fait, flush]);

  // Sondage régulier : reflète l'avancement des AUTRES membres et le total du
  // groupe (le « temps réel » passe par là, faute d'abonnement RTDB direct).
  useEffect(() => {
    const id = setInterval(async () => {
      const d = await onRefresh();
      if (!d) return;
      setServerTotal(Number(d.total) || 0);
      // Ma part a pu avancer ailleurs (autre appareil) : on recale la
      // référence, sinon la correction ci-dessous compterait ces grains en
      // double dans le total affiché.
      const remote = Number(d.myFait) || 0;
      if (remote > syncedFait.current) syncedFait.current = remote;
    }, POLL_MS);
    return () => {
      clearInterval(id);
      flush(); // n'abandonne pas les grains en attente si on quitte la vue
    };
  }, [onRefresh, flush]);

  // Total du groupe affiché = total serveur corrigé de mes grains non encore
  // synchronisés, pour que la barre collective bouge dès que j'égrène.
  const pending = Math.max(0, fait - syncedFait.current);
  const groupTotal = Math.min(target || Infinity, serverTotal + pending);
  const groupPct = progressPct(groupTotal, target);
  // L'avancement enregistré fait foi s'il dépasse le compteur local (stockage
  // vidé, ou récitation faite depuis un autre appareil) — cohérent avec le
  // caractère monotone appliqué côté serveur.
  const myFait = Math.max(fait, syncedFait.current);
  const myPct = myPart > 0 ? Math.min(100, (myFait / myPart) * 100) : 0;

  return (
    <>
      <div className="zk-progress-block">
        <div className="zk-progress-meta"><span>Progression du groupe</span></div>
        <div className="zk-bar big">
          <span style={{ width: groupPct + '%' }} className={target > 0 && groupTotal >= target ? 'done' : ''} />
        </div>
        <div className="zk-progress-meta"><strong>{fmt(groupTotal)}</strong> / {fmt(target)} ({Math.floor(groupPct)}%)</div>

        <div className="zk-progress-meta" style={{ marginTop: 10 }}><span>Ma part</span></div>
        <div className="zk-bar big"><span className="gold" style={{ width: myPct + '%' }} /></div>
        <div className="zk-progress-meta"><strong>{fmt(myFait)}</strong> / {fmt(myPart)} grains</div>
      </div>

      {/* Objectif masqué dans les réglages : ici, l'objectif EST la part. */}
      <TasbihChapelet id={`collectif-${groupId}`} t={t} targetLocked />
    </>
  );
}
