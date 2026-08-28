'use client';
// Module « Zikr collectif » — objectif de dhikr COMMUN et PARTAGÉ (pas de
// part individuelle fixée à l'avance) : l'objectif restant (target - total)
// est LE MÊME nombre pour tout le monde, mis à jour en direct à chaque
// grain égrené par n'importe quel participant. Chacun égrène sans plafond
// ni série qui lui soit propre (components/useTasbih.js, `uncapped`).
//
// Port du modèle de référence (dépôt prozizou/mon-chapelet, ZIP fourni :
// « Mon chapelet Ma solution — Zikr collectif ») adapté à l'architecture
// d'ASRAR PRO : leur version écrit directement dans Firebase RTDB depuis le
// navigateur (SDK client) et utilise `onDisconnect()` pour la présence ; ici
// tout reste derrière /api/zikr (Admin SDK — jamais de RTDB client direct,
// cf. l'historique /api/check-access, /api/social : ce canal peut rester
// bloqué en silence sur certains réseaux), et la présence « en ligne » est
// approximée par un battement de cœur posé à chaque sondage (voir
// pages/api/zikr.js, ONLINE_WINDOW_MS).
//
// Fonctionnalités ajoutées avec ce port : formules prédéfinies (ou « Zikr
// libre »), présence en ligne, rythme instantané (repère anti-tapotement
// mécanique, jamais bloquant), modération par le créateur (avertissement
// privé à un clic, exclusion), succession automatique de créateur s'il
// quitte alors que d'autres membres restent.
import './zikr.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/useToast';
import SpinnerUntyped from '@/components/Spinner';
import TasbihChapelet from '@/components/TasbihChapelet';
import { useTasbih } from '@/components/useTasbih';
import { DHIKR_PRESETS, LIBRE_PRESET_ID } from '@/lib/dhikrPresets';
import { progressPct, NAME_MAX, ARABIC_MAX, TARGET_MAX, RYTHME_SUSPECT } from '@/lib/zikrLogic';
import {
  listGroups, createGroup, getGroup, joinGroup,
  approveMember, rejectMember, saveProgress, warnMember, dismissWarning,
  excludeMember, leaveGroup, deleteGroup, restoreLocalCount,
} from '@/lib/zikrCollectif';

const Spinner = SpinnerUntyped as any;

type GroupStatus = 'owner' | 'member' | 'pending' | 'none';

interface Group {
  id: string;
  name: string;
  transliteration: string;
  arabic: string;
  target: number;
  total: number;
  remaining: number;
  membersCount: number;
  ownerEmail: string;
  status: GroupStatus;
}

interface JoinRequest {
  uid: string;
  email: string;
}

interface Member {
  uid: string;
  email: string;
  fait: number;
  rythme: number;
  online: boolean;
}

interface GroupDetailData extends Group {
  ownerUid: string;
  full: boolean;
  pending: number;
  onlineCount: number;
  requests?: JoinRequest[];
  members: Member[];
  myFait?: number;
  myWarning?: string;
}

const fmt = (n: number) => (Number(n) || 0).toLocaleString('fr-FR');
const SAVE_DEBOUNCE = 1500; // regroupe les frappes avant l'envoi (comme la référence)
const POLL_MS = 4000;       // « temps réel » : resonde le groupe régulièrement

export default function ZikrCollectifPage() {
  const { user } = useAuth() as any;
  const { notify, toast } = useToast();
  const [selected, setSelected] = useState<string | null>(null); // groupId ou null (= liste)

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <Link href="/menu" className="back-btn">← Retour</Link>
      {selected ? (
        <GroupDetail groupId={selected} uid={user?.uid || ''} notify={notify} onBack={() => setSelected(null)} />
      ) : (
        <GroupList notify={notify} onOpen={setSelected} />
      )}
      {toast}
    </div>
  );
}

// ─────────────────────────── LISTE + CRÉATION ───────────────────────────
function GroupList({ notify, onOpen }: { notify: (msg: string) => void; onOpen: (id: string) => void }) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await listGroups();
      setGroups(d.groups || []);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="glass-panel">
      <div className="zk-hero">
        <div style={{ fontSize: '2.6rem' }}>🤲</div>
        <h1>Zikr collectif</h1>
        <p>
          Réciter un dhikr ensemble vers un objectif commun et partagé — pas de
          part fixée à l’avance : ce qu’il reste à faire diminue pour tout le
          monde au fil des récitations du groupe. Créez le vôtre ou rejoignez-en un.
        </p>
      </div>

      <button className="zk-btn main zk-create-toggle" onClick={() => setCreating((v) => !v)}>
        {creating ? '✕ Annuler' : '➕ Lancer un zikr collectif'}
      </button>

      {creating && (
        <CreateForm notify={notify} onCreated={(id: string) => { setCreating(false); load(); onOpen(id); }} />
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

function GroupCard({ g, onOpen }: { g: Group; onOpen: () => void }) {
  const pct = progressPct(g.total, g.target);
  const full = g.remaining <= 0 && g.status === 'none';
  const statusLabel = ({
    owner: '👑 Créateur',
    member: '✓ Membre',
    pending: '⏳ En attente',
    none: full ? 'Complet' : 'Voir',
  } as Record<GroupStatus, string>)[g.status] || 'Voir';

  return (
    <button className="zk-card" onClick={onOpen}>
      <div className="zk-card-top">
        <span className="zk-card-name">{g.name}</span>
        <span className={'zk-badge zk-badge-' + (full ? 'full' : g.status)}>{statusLabel}</span>
      </div>
      <div className="zk-card-phrase" dir="auto">{g.arabic || g.transliteration}</div>
      <div className="zk-bar"><span style={{ width: pct + '%' }} /></div>
      <div className="zk-card-meta">
        <span>{fmt(g.total)} / {fmt(g.target)}</span>
        <span>👥 {fmt(g.membersCount)} participant{g.membersCount > 1 ? 's' : ''}</span>
      </div>
    </button>
  );
}

function CreateForm({ notify, onCreated }: { notify: (msg: string) => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [presetId, setPresetId] = useState(DHIKR_PRESETS[0].id);
  const [customArabic, setCustomArabic] = useState('');
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const isLibre = presetId === LIBRE_PRESET_ID;

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const d = await createGroup({ name, presetId, arabic: isLibre ? customArabic : undefined, target });
      notify('✅ Zikr collectif créé.');
      onCreated(d.id);
    } catch (e: any) {
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
        <select value={presetId} onChange={(e) => setPresetId(e.target.value)}>
          {DHIKR_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.transliteration}</option>
          ))}
        </select>
      </label>
      {isLibre && (
        <label className="zk-field">
          <span>Zikr à réciter (arabe)</span>
          <input type="text" dir="rtl" maxLength={ARABIC_MAX} value={customArabic}
            placeholder="اكتب هنا" onChange={(e) => setCustomArabic(e.target.value)} />
        </label>
      )}
      <label className="zk-field">
        <span>Objectif total</span>
        <input type="number" min="1" max={TARGET_MAX} value={target}
          placeholder="100000" onChange={(e) => setTarget(e.target.value)} />
      </label>
      <p className="zk-preview">
        Il n’y a pas de part fixée à l’avance : ce qu’il reste à faire à
        chacun diminue automatiquement au fil des récitations de tout le groupe.
      </p>
      <button className="zk-btn main" onClick={submit} disabled={busy}>
        {busy ? 'Création…' : 'Créer'}
      </button>
    </div>
  );
}

// ─────────────────────────────── DÉTAIL ─────────────────────────────────
function GroupDetail({ groupId, uid, notify, onBack }: { groupId: string; uid: string; notify: (msg: string) => void; onBack: () => void }) {
  const [g, setG] = useState<GroupDetailData | null>(null);
  const [error, setError] = useState('');
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    try {
      const d = await getGroup(groupId);
      setG(d);
      setError('');
      loadedOnce.current = true;
      return d;
    } catch (e: any) {
      // Un sondage régulier qui échoue une fois ne doit pas effacer l'écran
      // déjà affiché — seul un premier chargement raté est bloquant.
      if (!loadedOnce.current) setError(e.message || 'Erreur de chargement.');
      return null;
    }
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  // Sondage régulier de TOUT le détail (membres, présence, demandes,
  // objectif restant) — remplace l'abonnement RTDB temps réel de la
  // référence, faute d'accès direct au client (voir l'en-tête du fichier).
  useEffect(() => {
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const doJoin = async () => {
    try {
      const d = await joinGroup(groupId);
      notify(d.status === 'pending' ? '⏳ Demande envoyée au créateur.' : '✓ Vous avez rejoint le groupe.');
      load();
    } catch (e: any) { notify('❌ ' + (e.message || e)); }
  };
  const doLeave = async () => {
    if (!window.confirm('Quitter ce zikr collectif ?')) return;
    try { await leaveGroup(groupId); notify('Vous avez quitté le groupe.'); onBack(); }
    catch (e: any) { notify('❌ ' + (e.message || e)); }
  };
  const doDelete = async () => {
    if (!window.confirm('Supprimer définitivement ce zikr collectif ?')) return;
    try { await deleteGroup(groupId); notify('Zikr collectif supprimé.'); onBack(); }
    catch (e: any) { notify('❌ ' + (e.message || e)); }
  };
  const doDismissWarning = async () => {
    try { await dismissWarning(groupId); load(); } catch { /* best effort */ }
  };
  const doWarn = async (targetUid: string, email: string) => {
    try { await warnMember(groupId, targetUid); notify(`Avertissement privé envoyé à ${email}.`); load(); }
    catch (e: any) { notify('❌ ' + (e.message || e)); }
  };
  const doExclude = async (targetUid: string, email: string) => {
    if (!window.confirm(`Exclure ${email} de ce zikr collectif ?`)) return;
    try { await excludeMember(groupId, targetUid); notify(`${email} a été retiré du zikr collectif.`); load(); }
    catch (e: any) { notify('❌ ' + (e.message || e)); }
  };
  const act = async (fn: (groupId: string, uid: string) => Promise<any>, targetUid: string) => {
    try { await fn(groupId, targetUid); load(); }
    catch (e: any) { notify('❌ ' + (e.message || e)); }
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
        {g.arabic && <div className="zk-phrase-big" dir="rtl">{g.arabic}</div>}
        <div className="zk-phrase-translit">{g.transliteration}</div>
        <div className="zk-owner">
          Créé par {g.ownerEmail} · {fmt(g.membersCount)} participant{g.membersCount > 1 ? 's' : ''}
          {g.onlineCount > 0 && <> · <span className="zk-online-text">{g.onlineCount} en ligne</span></>}
        </div>
      </div>

      {isMember ? (
        <>
          {g.full && (
            <p className="zk-reached-banner">🎉 Objectif atteint par le groupe — merci à tous les participants !</p>
          )}
          <MemberCounter groupId={groupId} uid={uid} g={g} onDismissWarning={doDismissWarning} />
        </>
      ) : (
        <>
          <StaticProgress total={g.total} target={g.target} />
          {g.status === 'pending' ? (
            <div className="zk-join-state">⏳ Votre demande est en attente de validation par le créateur.</div>
          ) : g.full ? (
            <div className="zk-join-state">Ce zikr collectif est complet — objectif entièrement récité.</div>
          ) : (
            <button className="zk-btn main" onClick={doJoin}>🤝 Demander à rejoindre</button>
          )}
        </>
      )}

      {/* File d'approbation : seul le créateur la voit. */}
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

      {/* Qui participe, sa progression, sa présence et son rythme — visible
          seulement des membres (pas des visiteurs qui n'ont pas encore
          rejoint), avec les outils de modération pour le créateur. */}
      {isMember && g.members.length > 0 && (
        <div className="zk-board">
          <h3>Participants ({g.members.length})</h3>
          <div className="zk-board-list">
            {g.members.map((m) => {
              const suspect = m.rythme >= RYTHME_SUSPECT;
              return (
                <div key={m.uid} className={'zk-board-row' + (m.uid === uid ? ' me' : '')}>
                  <span
                    className={'zk-online-dot' + (m.online ? ' on' : '')}
                    title={m.online ? 'En ligne' : 'Hors ligne'}
                    aria-label={m.online ? 'En ligne' : 'Hors ligne'}
                  />
                  <span className="zk-board-email">
                    {m.email || 'Membre'}
                    {m.uid === g.ownerUid && <span className="zk-muted"> (créateur)</span>}
                    {m.uid === uid && <span className="zk-muted"> (vous)</span>}
                  </span>
                  <span className="zk-board-count">{fmt(m.fait)} grains</span>
                  {m.rythme > 0 && (
                    <span className={'zk-pace' + (suspect ? ' suspect' : '')} title="Rythme instantané">
                      {suspect ? '⚠️' : '⚡'} {m.rythme}/min
                    </span>
                  )}
                  {g.status === 'owner' && m.uid !== uid && (
                    <span className="zk-mod-actions">
                      <button type="button" className="zk-mini warn" title="Avertir en privé"
                        aria-label={`Avertir ${m.email} en privé`} onClick={() => doWarn(m.uid, m.email)}>⚠️</button>
                      <button type="button" className="zk-mini no" title="Exclure"
                        aria-label={`Exclure ${m.email}`} onClick={() => doExclude(m.uid, m.email)}>✕</button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="zk-footer-actions">
        {isMember && <button className="zk-btn ghost" onClick={doLeave}>Quitter le groupe</button>}
        {g.status === 'owner' && g.membersCount <= 1 && (
          <button className="zk-btn danger" onClick={doDelete}>Supprimer le zikr collectif</button>
        )}
      </div>
    </div>
  );
}

function StaticProgress({ total, target }: { total: number; target: number }) {
  const pct = progressPct(total, target);
  const reached = target > 0 && total >= target;
  return (
    <div className="zk-progress-block">
      <div className="zk-bar big"><span style={{ width: pct + '%' }} className={reached ? 'done' : ''} /></div>
      <div className="zk-progress-meta">
        <strong>{fmt(total)}</strong> / {fmt(target)} ({Math.floor(pct)}%)
      </div>
    </div>
  );
}

// Compteur d'un participant — il égrène SANS PLAFOND (pas de part
// individuelle : l'objectif partagé du groupe diminue en direct pour TOUT
// le monde à la fois, cf. TasbihChapelet prop `collectifRestant`) avec le
// MÊME chapelet que « Noms d'Allah » (components/TasbihChapelet.js).
//
// La clé de persistance locale est propre à CE zikr collectif ET à CE
// COMPTE (`collectif_{gid}_{uid}`) : sans le `_{uid}`, deux comptes Google
// ouverts sur le même appareil/navigateur partageraient le même compteur
// local pour ce zikr, et le second hériterait des grains du premier.
function MemberCounter({ groupId, uid, g, onDismissWarning }: {
  groupId: string; uid: string; g: GroupDetailData; onDismissWarning: () => void;
}) {
  // Aligne le compteur LOCAL sur ce que le compte a déjà enregistré, s'il est
  // en retard — utile en particulier sur un second appareil pour ce même
  // compte, pour ne pas repartir de zéro localement (le garde-fou
  // anti-régression côté serveur bloquerait sinon toute nouvelle frappe
  // tant que le compteur local n'a pas rattrapé le retard).
  restoreLocalCount(groupId, uid, Number(g.myFait) || 0);

  const target = Number(g.target) || 0;
  const t = useTasbih(`collectif_${groupId}_${uid}`, undefined, true);

  // Rythme instantané (grains/minute), sur les tapotements des dix dernières
  // secondes — remis à zéro après six secondes sans tap plutôt que de rester
  // figé (repos, pas triche). Aucune API web ne mesure fiablement la
  // pression du pouce : c'est le seul indice mesurable pour repérer un
  // tapotement mécanique plutôt qu'une récitation avec intention.
  const [rythme, setRythme] = useState(0);
  const tapTimesRef = useRef<number[]>([]);
  const prevTotalRef = useRef(t.total);

  useEffect(() => {
    if (t.total > prevTotalRef.current) {
      const now = Date.now();
      const times = tapTimesRef.current;
      times.push(now);
      const cutoff = now - 10_000;
      while (times.length > 1 && times[0] < cutoff) times.shift();
      if (times.length > 12) times.splice(0, times.length - 12);
      const spanSec = times.length >= 2 ? (times[times.length - 1] - times[0]) / 1000 : 0;
      setRythme(spanSec > 0 ? Math.round(((times.length - 1) / spanSec) * 60) : 0);
    }
    prevTotalRef.current = t.total;

    const decay = setTimeout(() => setRythme(0), 6000);
    return () => clearTimeout(decay);
  }, [t.total]);

  // Dernière valeur connue du serveur pour MOI : sert à corriger le total du
  // groupe affiché tant que des grains locaux ne sont pas encore synchronisés.
  const syncedFait = useRef(Number(g.myFait) || 0);
  const faitRef = useRef(t.total);
  faitRef.current = t.total;
  const rythmeRef = useRef(rythme);
  rythmeRef.current = rythme;
  const lastSaved = useRef({ fait: Number(g.myFait) || 0, rythme: 0 });

  const flush = useCallback(async () => {
    const fait = faitRef.current;
    const r = rythmeRef.current;
    if (fait === lastSaved.current.fait && r === lastSaved.current.rythme) return;
    lastSaved.current = { fait, rythme: r };
    try {
      const d = await saveProgress(groupId, fait, r);
      syncedFait.current = Number(d.fait) || 0;
    } catch {
      // best-effort : la prochaine frappe (ou le démontage) réessaiera
    }
  }, [groupId]);

  // Envoi groupé : une écriture après SAVE_DEBOUNCE ms sans nouvelle frappe
  // NI changement de rythme (le rythme retombant à 0 après une pause doit
  // aussi se propager, pour que les autres voient l'alerte se lever).
  useEffect(() => {
    if (t.total === lastSaved.current.fait && rythme === lastSaved.current.rythme) return undefined;
    const timer = setTimeout(flush, SAVE_DEBOUNCE);
    return () => clearTimeout(timer);
  }, [t.total, rythme, flush]);

  useEffect(() => () => { flush(); }, [flush]); // n'abandonne pas les grains en attente au démontage

  // Ma part a pu avancer ailleurs (autre appareil) : le sondage régulier du
  // parent (GroupDetail) le révèle via `g.myFait` — on recale la référence,
  // sinon la correction ci-dessous compterait ces grains en double.
  useEffect(() => {
    const remote = Number(g.myFait) || 0;
    if (remote > syncedFait.current) syncedFait.current = remote;
  }, [g.myFait]);

  const pending = Math.max(0, t.total - syncedFait.current);
  const groupTotal = Math.min(target || Infinity, (Number(g.total) || 0) + pending);
  const groupPct = progressPct(groupTotal, target);
  const restant = Math.max(0, target - groupTotal);
  // L'avancement enregistré fait foi s'il dépasse le compteur local (stockage
  // vidé, ou récitation faite depuis un autre appareil) — cohérent avec le
  // caractère monotone appliqué côté serveur.
  const myFait = Math.max(t.total, syncedFait.current);

  return (
    <>
      {/* Avertissement privé du créateur — visible seulement de la personne
          concernée, jamais des autres participants. */}
      {g.myWarning && (
        <div className="zk-warning">
          <p>⚠️ {g.myWarning}</p>
          <button type="button" className="zk-link" onClick={onDismissWarning}>C’est noté</button>
        </div>
      )}

      <div className="zk-progress-block">
        <div className="zk-progress-meta"><span>Progression du groupe</span></div>
        <div className="zk-bar big">
          <span style={{ width: groupPct + '%' }} className={target > 0 && groupTotal >= target ? 'done' : ''} />
        </div>
        <div className="zk-progress-meta"><strong>{fmt(groupTotal)}</strong> / {fmt(target)} ({Math.floor(groupPct)}%)</div>

        <div className="zk-progress-meta" style={{ marginTop: 10 }}><span>Mes grains récités</span></div>
        <strong className="zk-my-fait">{fmt(myFait)}</strong>
      </div>

      {/* Réglages masqués : pas de part personnelle en Zikr collectif,
          l'objectif restant affiché EST celui du groupe entier. */}
      <TasbihChapelet id={`collectif-${groupId}-${uid}`} t={t} collectifRestant={restant} />
    </>
  );
}
