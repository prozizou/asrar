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
import { deepLink, cleanUrl, share as shareLink } from '@/lib/share';
import { DHIKR_PRESETS, LIBRE_PRESET_ID } from '@/lib/dhikrPresets';
import { progressPct, NAME_MAX, ARABIC_MAX, TARGET_MIN, TARGET_MAX, WISH_MAX, CHAT_MESSAGE_MAX, RYTHME_SUSPECT } from '@/lib/zikrLogic';
import {
  listGroups, createGroup, getGroup, joinGroup,
  approveMember, rejectMember, saveProgress, warnMember, dismissWarning,
  excludeMember, leaveGroup, deleteGroup, restoreLocalCount,
  openWishes, closeWishes, submitWish,
  sendMessage, getMessages, approveZikr,
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
  private?: boolean;
  approved?: boolean;
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

interface Wish {
  uid: string;
  email: string;
  text: string;
  at: number;
}

interface ChatMessage {
  id: string;
  uid: string;
  email: string;
  text: string;
  at: number;
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
  wishesOpen?: boolean;
  wishes?: Wish[];
  myWish?: string;
  isAdmin?: boolean;
}

const fmt = (n: number) => (Number(n) || 0).toLocaleString('fr-FR');
const SAVE_DEBOUNCE = 1500; // regroupe les frappes avant l'envoi (comme la référence)
const POLL_MS = 4000;       // « temps réel » : resonde le groupe régulièrement
const LIST_POLL_MS = 6000;  // sondage de la liste (moins fréquent : pas de compteur en direct dessus)

export default function ZikrCollectifPage() {
  const { user } = useAuth() as any;
  const { notify, toast } = useToast();
  const [selected, setSelected] = useState<string | null>(null); // groupId ou null (= liste)

  // Deep link partagé sur les réseaux (/s?k=zikr&i=<gid>, voir GroupDetail
  // « Partager ») : ouvre directement le zikr collectif visé, comme les
  // autres modules (app/asrar/page.tsx, app/bibliotheque/page.tsx…).
  const bootRef = useRef(false);
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    const deep = deepLink();
    if (deep && deep.key) {
      cleanUrl();
      setSelected(deep.key);
    }
  }, []);

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
  // Détecte une demande d'adhésion tranchée (acceptée ou refusée) entre deux
  // sondages, pour NOTIFIER l'utilisateur sans qu'il ait besoin de rouvrir le
  // détail du groupe pour s'en apercevoir — comparé au statut du sondage
  // précédent, jamais à un état initial (undefined la première fois = pas de
  // notification au premier chargement).
  const prevStatusRef = useRef<Record<string, GroupStatus>>({});

  const load = useCallback(async () => {
    try {
      const d = await listGroups();
      const next: Group[] = d.groups || [];
      const prevStatus = prevStatusRef.current;
      for (const grp of next) {
        const before = prevStatus[grp.id];
        if (before === 'pending' && grp.status === 'member') {
          notify(`✅ Votre demande pour « ${grp.name} » a été acceptée !`);
        } else if (before === 'pending' && grp.status === 'none') {
          notify(`Votre demande pour « ${grp.name} » a été refusée.`);
        }
      }
      prevStatusRef.current = Object.fromEntries(next.map((grp) => [grp.id, grp.status]));
      setGroups(next);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement.');
    }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  // Sondage régulier : révèle une acceptation/refus de demande même si
  // l'utilisateur reste sur la liste sans jamais rouvrir un groupe.
  useEffect(() => {
    const id = setInterval(load, LIST_POLL_MS);
    return () => clearInterval(id);
  }, [load]);

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
        <span className="zk-card-name">
          {g.private && <span title="Zikr privé">🔒 </span>}
          {g.approved === false && <span title="En attente de validation par l'administrateur">⏳ </span>}
          {g.name}
        </span>
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
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const isLibre = presetId === LIBRE_PRESET_ID;

  // L'objectif est OBLIGATOIRE pour créer un zikr collectif (pas de groupe
  // sans but commun défini) — validé ici pour désactiver « Créer » avant même
  // l'envoi, en plus de la validation serveur qui fait autorité (lib/zikrLogic.js
  // normalizeGroupInput, toujours appliquée côté pages/api/zikr.js).
  const targetNum = Math.floor(Number(target));
  const targetValid = target !== '' && Number.isFinite(targetNum) && targetNum >= TARGET_MIN && targetNum <= TARGET_MAX;
  const canSubmit = !busy && !!name.trim() && (!isLibre || !!customArabic.trim()) && targetValid;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const d = await createGroup({ name, presetId, arabic: isLibre ? customArabic : undefined, target, private: isPrivate });
      notify('✅ Zikr collectif créé — en attente de validation par l’administrateur avant d’apparaître dans la liste publique.');
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
        <span>Objectif total <em className="zk-required">obligatoire</em></span>
        <input type="number" min={TARGET_MIN} max={TARGET_MAX} value={target} required
          placeholder="100000" onChange={(e) => setTarget(e.target.value)} />
      </label>
      <label className="zk-checkbox-field">
        <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
        <span>🔒 Zikr privé — invisible dans la liste publique, partageable uniquement par lien</span>
      </label>
      <p className="zk-preview">
        Il n’y a pas de part fixée à l’avance : ce qu’il reste à faire à
        chacun diminue automatiquement au fil des récitations de tout le groupe.
      </p>
      <button className="zk-btn main" onClick={submit} disabled={!canSubmit}>
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
  // Même détection d'acceptation/refus que GroupList (voir son commentaire) —
  // utile ici pour l'utilisateur qui reste sur CETTE page en attendant.
  const prevStatusRef = useRef<GroupStatus | null>(null);

  // Détecte qu'un AUTRE membre vient de passer hors-ligne → en ligne (donc
  // très probablement en train de réciter) entre deux sondages, pour le
  // notifier — jamais au premier chargement (pas de base de comparaison),
  // jamais pour soi-même. Réservé aux membres du groupe (isMember, plus bas).
  const prevOnlineRef = useRef<Record<string, boolean> | null>(null);

  // Discussion du groupe façon WhatsApp — chargée seulement quand le
  // panneau est ouvert (pas de sondage inutile en arrière-plan).
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const chatListRef = useRef<HTMLDivElement>(null);

  // Vœu (dua) : champ local préchargé UNE SEULE FOIS avec `myWish` (sinon le
  // sondage régulier écraserait une saisie en cours toutes les POLL_MS ms —
  // même précaution que syncedFait dans MemberCounter).
  const [wishText, setWishText] = useState('');
  const [wishBusy, setWishBusy] = useState(false);
  const wishSyncedRef = useRef(false);
  useEffect(() => {
    if (!wishSyncedRef.current && g && typeof g.myWish === 'string') {
      setWishText(g.myWish);
      wishSyncedRef.current = true;
    }
  }, [g]);

  const load = useCallback(async () => {
    try {
      const d = await getGroup(groupId);
      const before = prevStatusRef.current;
      if (before === 'pending' && d.status === 'member') {
        notify(`✅ Vous avez été accepté(e) dans « ${d.name} » !`);
      } else if (before === 'pending' && d.status === 'none') {
        notify(`Votre demande pour « ${d.name} » a été refusée.`);
      }
      prevStatusRef.current = d.status;

      // Un AUTRE membre vient de passer en ligne (donc très probablement en
      // train de réciter) : notifie, avec sa progression actuelle — réservé
      // aux membres (voir le commentaire de prevOnlineRef plus haut).
      const isMemberNow = d.status === 'member' || d.status === 'owner';
      if (isMemberNow && prevOnlineRef.current) {
        const prevOnline = prevOnlineRef.current;
        for (const m of d.members || []) {
          if (m.uid === uid) continue;
          if (!prevOnline[m.uid] && m.online) {
            notify(`🟢 ${m.email || 'Un membre'} est en train de réciter — ${fmt(m.fait)} grains.`);
          }
        }
      }
      prevOnlineRef.current = Object.fromEntries((d.members || []).map((m: Member) => [m.uid, m.online]));

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
  }, [groupId, notify, uid]);

  useEffect(() => { load(); }, [load]);

  // Sondage régulier de TOUT le détail (membres, présence, demandes,
  // objectif restant) — remplace l'abonnement RTDB temps réel de la
  // référence, faute d'accès direct au client (voir l'en-tête du fichier).
  useEffect(() => {
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Discussion : chargée et sondée SEULEMENT pendant que le panneau est
  // ouvert — pas de requête inutile en arrière-plan quand personne ne lit.
  const loadMessages = useCallback(async () => {
    try {
      const d = await getMessages(groupId);
      setMessages(d.messages || []);
    } catch {
      // Sondage best-effort : une lecture ratée ne doit pas casser le panneau.
    }
  }, [groupId]);

  useEffect(() => {
    if (!showChat) return undefined;
    loadMessages();
    const id = setInterval(loadMessages, POLL_MS);
    return () => clearInterval(id);
  }, [showChat, loadMessages]);

  useEffect(() => {
    if (chatListRef.current) chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
  }, [messages, showChat]);

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
    // Deux points d'entrée : le créateur (bouton en pied de page, seulement
    // s'il est seul) et l'administrateur (panneau admin, n'importe quel zikr —
    // voir handleDelete, pages/api/zikr.js) ; message adapté au cas.
    const msg = g && g.status !== 'owner'
      ? `Supprimer définitivement « ${g.name} » en tant qu’administrateur (${g.membersCount} participant${g.membersCount > 1 ? 's' : ''}) ?`
      : 'Supprimer définitivement ce zikr collectif ?';
    if (!window.confirm(msg)) return;
    try { await deleteGroup(groupId); notify('Zikr collectif supprimé.'); onBack(); }
    catch (e: any) { notify('❌ ' + (e.message || e)); }
  };
  const doApproveZikr = async () => {
    try { await approveZikr(groupId); notify('✅ Zikr collectif approuvé — visible dans la liste publique.'); load(); }
    catch (e: any) { notify('❌ ' + (e.message || e)); }
  };
  const doSendMessage = async () => {
    const t = chatText.trim();
    if (!t || chatBusy) return;
    setChatBusy(true);
    try { await sendMessage(groupId, t); setChatText(''); loadMessages(); }
    catch (e: any) { notify('❌ ' + (e.message || e)); }
    finally { setChatBusy(false); }
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
  const doShare = () => {
    if (!g) return;
    shareLink({
      kind: 'zikr',
      key: groupId,
      title: g.name || 'Zikr collectif',
      text: `🤲 Rejoignez « ${g.name} » — un zikr collectif sur ASRAR PRO !`,
    });
  };
  const doOpenWishes = async () => {
    try { await openWishes(groupId); notify('🤲 Les vœux sont maintenant ouverts aux participants.'); load(); }
    catch (e: any) { notify('❌ ' + (e.message || e)); }
  };
  const doCloseWishes = async () => {
    try { await closeWishes(groupId); notify('Les vœux sont refermés.'); load(); }
    catch (e: any) { notify('❌ ' + (e.message || e)); }
  };
  const doSubmitWish = async () => {
    const t = wishText.trim();
    if (!t || wishBusy) return;
    setWishBusy(true);
    try { await submitWish(groupId, t); notify('🤲 Vœu envoyé.'); load(); }
    catch (e: any) { notify('❌ ' + (e.message || e)); }
    finally { setWishBusy(false); }
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
      <div className="zk-detail-topbar">
        <button className="zk-link" onClick={onBack}>← Liste des zikr</button>
        <span className="zk-topbar-actions">
          {isMember && (
            <button type="button" className="zk-share-btn" onClick={() => setShowChat((v) => !v)}
              title="Discussion du groupe" aria-label="Discussion du groupe">
              💬 {showChat ? 'Fermer' : 'Discussion'}
            </button>
          )}
          <button type="button" className="zk-share-btn" onClick={doShare}
            title="Partager ce zikr collectif" aria-label="Partager ce zikr collectif">📤 Partager</button>
        </span>
      </div>

      <div className="zk-detail-head">
        <h1>{g.name}</h1>
        {g.arabic && <div className="zk-phrase-big" dir="rtl">{g.arabic}</div>}
        <div className="zk-phrase-translit">{g.transliteration}</div>
        <div className="zk-owner">
          Créé par {g.ownerEmail} · {fmt(g.membersCount)} participant{g.membersCount > 1 ? 's' : ''}
          {g.onlineCount > 0 && <> · <span className="zk-online-text">{g.onlineCount} en ligne</span></>}
        </div>
        {g.private && (
          <div className="zk-private-note">🔒 Zikr privé — invisible dans la liste publique, accessible uniquement via le lien partagé.</div>
        )}
        {g.approved === false && (
          <div className="zk-private-note">
            ⏳ En attente de validation par l’administrateur avant d’apparaître dans la liste publique.
            {isMember && ' Vous pouvez déjà inviter des participants via le lien de partage.'}
          </div>
        )}
      </div>

      {/* Panneau admin (prozizou298@gmail.com ou tout compte admins/{clé}) :
          approuver pour la liste publique, ou supprimer n'importe quel zikr
          collectif — voir handleApproveZikr/handleDelete, pages/api/zikr.js. */}
      {g.isAdmin && (
        <div className="zk-admin-panel">
          <span className="zk-admin-badge">🛡️ Administration</span>
          {g.approved === false && (
            <button type="button" className="zk-mini ok" onClick={doApproveZikr}>✅ Approuver</button>
          )}
          <button type="button" className="zk-mini no" onClick={doDelete}>🗑️ Supprimer</button>
        </div>
      )}

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

      {/* Discussion du groupe façon WhatsApp — réservée aux membres (voir
          handleSendMessage/handleMessages, pages/api/zikr.js). */}
      {isMember && showChat && (
        <div className="zk-chat-panel">
          <h3>💬 Discussion</h3>
          <div className="zk-chat-list" ref={chatListRef}>
            {messages.length === 0 ? (
              <p className="zk-muted">Aucun message pour l’instant — lancez la discussion !</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={'zk-chat-msg' + (m.uid === uid ? ' me' : '')}>
                  <span className="zk-chat-author">
                    {m.email || 'Membre'}{m.uid === g.ownerUid && ' 👑'}
                  </span>
                  <p className="zk-chat-text">{m.text}</p>
                </div>
              ))
            )}
          </div>
          <div className="zk-chat-input-row">
            <textarea rows={1} maxLength={CHAT_MESSAGE_MAX} value={chatText}
              placeholder="Écrire un message…" onChange={(e) => setChatText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSendMessage(); } }} />
            <button type="button" className="zk-chat-send" onClick={doSendMessage}
              disabled={chatBusy || !chatText.trim()} aria-label="Envoyer">➤</button>
          </div>
        </div>
      )}

      {/* Vœux (dua) : ouverts par le créateur une fois l'objectif ATTEINT —
          voir handleOpenWishes (pages/api/zikr.js), refusé côté serveur avant.
          Chaque vœu reste PRIVÉ : visible seulement de son auteur et du
          créateur (liste), jamais des autres membres entre eux. */}
      {isMember && g.full && (
        g.status === 'owner' ? (
          <div className="zk-owner-panel">
            <h3>🤲 Vœux des participants {g.wishes && g.wishes.length > 0 && <span className="zk-pill">{g.wishes.length}</span>}</h3>
            {!g.wishesOpen ? (
              <>
                <p className="zk-muted">
                  Une fois ouverts, chaque participant pourra laisser un vœu (dua) après ce
                  dhikr accompli ensemble — visible seulement de vous, jamais des autres membres.
                </p>
                <button className="zk-btn main" onClick={doOpenWishes}>🤲 Ouvrir les vœux</button>
              </>
            ) : (
              <>
                <button className="zk-btn ghost" onClick={doCloseWishes}>Fermer les vœux</button>
                {(!g.wishes || g.wishes.length === 0) ? (
                  <p className="zk-muted">Aucun vœu reçu pour l’instant.</p>
                ) : (
                  <div className="zk-wish-list">
                    {g.wishes.map((w) => (
                      <div key={w.uid} className="zk-wish-item">
                        <span className="zk-wish-email">{w.email}</span>
                        <p className="zk-wish-text">{w.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ) : g.wishesOpen ? (
          <div className="zk-owner-panel">
            <h3>🤲 Faites un vœu</h3>
            <p className="zk-muted">
              Le créateur a ouvert la possibilité de faire un vœu (dua) maintenant que
              l’objectif est atteint — visible seulement de vous et du créateur.
            </p>
            <textarea className="zk-wish-input" maxLength={WISH_MAX} rows={3} value={wishText}
              placeholder="Votre vœu…" onChange={(e) => setWishText(e.target.value)} />
            <button className="zk-btn main" onClick={doSubmitWish} disabled={wishBusy || !wishText.trim()}>
              {wishBusy ? 'Envoi…' : g.myWish ? 'Mettre à jour mon vœu' : 'Envoyer mon vœu'}
            </button>
          </div>
        ) : null
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
