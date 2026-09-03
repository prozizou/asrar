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
import {
  Plus, X, Lock, Clock, Users, Crown, Pencil, MessageCircle, Share2, Bell,
  ShieldCheck, Trash2, Check, Handshake, AlertTriangle, Send, ChevronRight, Zap,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/useToast';
import SpinnerUntyped from '@/components/Spinner';
import WirdReminderToggleUntyped from '@/components/WirdReminderToggle';
import TasbihChapelet from '@/components/TasbihChapelet';
import { useTasbih } from '@/components/useTasbih';
import { deepLink, cleanUrl, share as shareLink } from '@/lib/share';
import { DHIKR_PRESETS, LIBRE_PRESET_ID } from '@/lib/dhikrPresets';
import { progressPct, NAME_MAX, ARABIC_MAX, TARGET_MIN, TARGET_MAX, WISH_MAX, CHAT_MESSAGE_MAX, RYTHME_SUSPECT } from '@/lib/zikrLogic';
import {
  listGroups, createGroup, updateGroup, getGroup, joinGroup,
  approveMember, rejectMember, saveProgress, warnMember, notifyInactiveMembers, dismissWarning,
  excludeMember, leaveGroup, deleteGroup, restoreLocalCount,
  openWishes, closeWishes, submitWish,
  sendMessage, getMessages, approveZikr,
} from '@/lib/zikrCollectif';

const Spinner = SpinnerUntyped as any;
const WirdReminderToggle = WirdReminderToggleUntyped as any;

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
  sessionAt?: number | null;
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
  dailyTotal: number; // total du jour (fenêtre UTC commune au groupe, lib/zikrLogic.js utcDateKey)
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
  presetId: string;
  ownerUid: string;
  full: boolean;
  pending: number;
  onlineCount: number;
  requests?: JoinRequest[];
  members: Member[];
  myFait?: number;
  myDailyTotal?: number;
  myWarning?: string;
  wishesOpen?: boolean;
  wishes?: Wish[];
  myWish?: string;
  isAdmin?: boolean;
}

const fmt = (n: number) => (Number(n) || 0).toLocaleString('fr-FR');
// Pourcentage lisible sur les cartes (revue design, point 6) : un entier une
// fois la barre visiblement remplie ("52 %"), une décimale en dessous de 1 %
// (sinon "0 %" laisserait croire qu'aucun grain n'a encore été récité alors
// que la progression réelle — ex. 1 096/165 000 — reste non nulle).
const fmtPct = (pct: number) => (pct > 0 && pct < 1 ? pct.toFixed(1) : Math.floor(pct)).toString().replace('.', ',') + ' %';
// Conversion <input type="datetime-local"> (heure LOCALE du navigateur, sans
// fuseau) ↔ epoch ms : le rappel de session (lib/reminders.js) repose sur un
// instant absolu, pas sur l'heure affichée telle quelle — d'où la conversion
// systématique, dans les deux sens, plutôt qu'un stockage de chaîne brute.
const toLocalInputValue = (ms: number) => {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmtSessionAt = (ms: number) =>
  new Date(ms).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
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
    <div className="zk-list-page">
      {/* En-tête resserré (revue design, point 1) : un titre + une ligne de
          sens, plus le grand emoji ni le paragraphe qui repoussaient l'action
          principale et les zikrs existants hors du premier écran. */}
      <div className="zk-hero">
        <h1>Zikr collectif</h1>
        <p>Récitez ensemble pour atteindre un objectif commun.</p>
      </div>

      <WirdReminderToggle />

      <button className="zk-btn main zk-create-toggle" onClick={() => setCreating((v) => !v)}>
        {creating ? (
          <><X size={16} strokeWidth={2.5} aria-hidden="true" /> Annuler</>
        ) : (
          <><Plus size={16} strokeWidth={2.5} aria-hidden="true" /> Créer un zikr collectif</>
        )}
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
        <>
          {/* Titre de section (revue design, point 4) — sépare clairement la
              création des zikrs déjà en cours, au lieu d'un enchaînement direct
              sans repère. */}
          <h2 className="zk-section-title">Zikrs en cours <span className="zk-pill">{groups.length}</span></h2>
          <div className="zk-list">
            {groups.map((g) => <GroupCard key={g.id} g={g} onOpen={() => onOpen(g.id)} />)}
          </div>
        </>
      )}
    </div>
  );
}

// Revue design (points 5, 6, 7) : le badge de statut ("👑 Créateur", "✓
// Membre"…) décrivait un ÉTAT mais ne disait pas à l'utilisateur quoi faire
// ensuite — remplacé par un verbe d'action clair (Continuer/Participer),
// distinct visuellement des états non actionnables (En attente/Complet). Le
// badge "Créateur", trop voyant, devient une mention discrète à côté du nom.
const CTA_BY_STATUS: Record<GroupStatus, { label: string; active: boolean }> = {
  owner: { label: 'Continuer', active: true },
  member: { label: 'Continuer', active: true },
  pending: { label: 'En attente', active: false },
  none: { label: 'Participer', active: true },
};

function GroupCard({ g, onOpen }: { g: Group; onOpen: () => void }) {
  const pct = progressPct(g.total, g.target);
  const full = g.remaining <= 0 && g.status === 'none';
  const cta = full ? { label: 'Complet', active: false } : CTA_BY_STATUS[g.status];

  return (
    <button className="zk-card" onClick={onOpen}>
      <div className="zk-card-top">
        <span className="zk-card-name">
          {g.private && <Lock size={13} strokeWidth={2.5} aria-label="Zikr privé" />}
          {g.approved === false && <Clock size={13} strokeWidth={2.5} aria-label="En attente de validation par l'administrateur" />}
          {g.name}
        </span>
        {g.status === 'owner' && (
          <span className="zk-owner-tag"><Crown size={11} strokeWidth={2.5} aria-hidden="true" /> Créé par vous</span>
        )}
      </div>
      <div className="zk-card-phrase" dir="auto">{g.arabic || g.transliteration}</div>
      <div className="zk-bar"><span style={{ width: pct + '%' }} /></div>
      <div className="zk-card-progress-row">
        <span>{fmt(g.total)} / {fmt(g.target)}</span>
        <span className="zk-card-pct">{fmtPct(pct)}</span>
      </div>
      <div className="zk-card-meta">
        <span className="zk-card-members"><Users size={13} strokeWidth={2.5} aria-hidden="true" /> {fmt(g.membersCount)} participant{g.membersCount > 1 ? 's' : ''}</span>
        <span className={'zk-cta' + (cta.active ? ' zk-cta-active' : ' zk-cta-muted')}>
          {cta.label} {cta.active && <ChevronRight size={14} strokeWidth={2.5} aria-hidden="true" />}
        </span>
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
  const [sessionAt, setSessionAt] = useState(''); // <input type="datetime-local"> — vide = pas de session programmée
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
      const d = await createGroup({
        name, presetId, arabic: isLibre ? customArabic : undefined, target, private: isPrivate,
        sessionAt: sessionAt ? new Date(sessionAt).getTime() : undefined,
      });
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
      <label className="zk-field">
        <span>Prochaine session <em className="zk-optional">optionnel</em></span>
        <input type="datetime-local" value={sessionAt} onChange={(e) => setSessionAt(e.target.value)} />
      </label>
      {sessionAt && (
        <p className="zk-preview">
          🔔 Un rappel push sera envoyé aux membres approuvés (ayant activé les
          notifications) avant l’heure choisie.
        </p>
      )}
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

// Modification (créateur only) — mêmes champs que CreateForm, préremplis.
// La formule (presetId/arabe) se verrouille dès que le groupe a commencé à
// réciter (g.total > 0) — voir handleUpdate, pages/api/zikr.js.
function EditGroupForm({ groupId, g, notify, onSaved, onCancel }: {
  groupId: string; g: GroupDetailData; notify: (msg: string) => void; onSaved: () => void; onCancel: () => void;
}) {
  const [name, setName] = useState(g.name);
  const [presetId, setPresetId] = useState(g.presetId || DHIKR_PRESETS[0].id);
  const [customArabic, setCustomArabic] = useState(g.presetId === LIBRE_PRESET_ID ? g.arabic : '');
  const [target, setTarget] = useState(String(g.target || ''));
  const [isPrivate, setIsPrivate] = useState(!!g.private);
  const [sessionAt, setSessionAt] = useState(g.sessionAt ? toLocalInputValue(g.sessionAt) : '');
  const [busy, setBusy] = useState(false);
  const isLibre = presetId === LIBRE_PRESET_ID;
  const formulaLocked = (Number(g.total) || 0) > 0;

  const targetNum = Math.floor(Number(target));
  const targetValid = target !== '' && Number.isFinite(targetNum) && targetNum >= TARGET_MIN && targetNum <= TARGET_MAX;
  const canSubmit = !busy && !!name.trim() && (!isLibre || !!customArabic.trim()) && targetValid;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await updateGroup(groupId, {
        name, presetId, arabic: isLibre ? customArabic : undefined, target, private: isPrivate,
        sessionAt: sessionAt ? new Date(sessionAt).getTime() : undefined,
      });
      notify('✅ Zikr collectif mis à jour.');
      onSaved();
    } catch (e: any) {
      notify('❌ ' + (e.message || e));
      setBusy(false);
    }
  };

  return (
    <div className="zk-form">
      <label className="zk-field">
        <span>Titre</span>
        <input type="text" maxLength={NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="zk-field">
        <span>Formule à réciter {formulaLocked && <em className="zk-required">verrouillée</em>}</span>
        <select value={presetId} disabled={formulaLocked} onChange={(e) => setPresetId(e.target.value)}>
          {DHIKR_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.transliteration}</option>
          ))}
        </select>
      </label>
      {isLibre && (
        <label className="zk-field">
          <span>Zikr à réciter (arabe)</span>
          <input type="text" dir="rtl" maxLength={ARABIC_MAX} value={customArabic} disabled={formulaLocked}
            placeholder="اكتب هنا" onChange={(e) => setCustomArabic(e.target.value)} />
        </label>
      )}
      {formulaLocked && (
        <p className="zk-preview">
          🔒 La formule ne peut plus changer : des grains ont déjà été comptabilisés pour ce zikr.
        </p>
      )}
      <label className="zk-field">
        <span>Objectif total <em className="zk-required">obligatoire</em></span>
        <input type="number" min={TARGET_MIN} max={TARGET_MAX} value={target} required
          onChange={(e) => setTarget(e.target.value)} />
      </label>
      <label className="zk-checkbox-field">
        <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
        <span>🔒 Zikr privé — invisible dans la liste publique, partageable uniquement par lien</span>
      </label>
      <label className="zk-field">
        <span>Prochaine session <em className="zk-optional">optionnel</em></span>
        <input type="datetime-local" value={sessionAt} onChange={(e) => setSessionAt(e.target.value)} />
      </label>
      <div className="zk-form-actions">
        <button className="zk-btn ghost" type="button" onClick={onCancel}>Annuler</button>
        <button className="zk-btn main" onClick={submit} disabled={!canSubmit}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
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

  // Formulaire de modification (créateur only) — voir EditGroupForm plus bas.
  const [editing, setEditing] = useState(false);

  // « Notifier les inactifs » (créateur only) — voir doNotifyInactive.
  const [notifyBusy, setNotifyBusy] = useState(false);

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
  // Avertit en une fois tous les comptes n'ayant récité aucun grain — voir
  // pages/api/zikr.js handleNotifyInactive (avertissement privé + push
  // best-effort). `notified` reflète ce que le SERVEUR a réellement trouvé
  // (recalculé côté serveur, pas simplement inactiveCount côté client).
  const doNotifyInactive = async () => {
    if (notifyBusy) return;
    setNotifyBusy(true);
    try {
      const d = await notifyInactiveMembers(groupId);
      const n = Number(d.notified) || 0;
      notify(
        n > 0
          ? `🔔 ${n} compte${n > 1 ? 's' : ''} inactif${n > 1 ? 's' : ''} notifié${n > 1 ? 's' : ''}.`
          : 'Aucun compte inactif pour l’instant.'
      );
    } catch (e: any) {
      notify('❌ ' + (e.message || e));
    } finally {
      setNotifyBusy(false);
    }
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
  // Compte purement indicatif (bouton « Notifier les inactifs ») — le
  // décompte qui fait foi est celui recalculé par le serveur, voir
  // handleNotifyInactive (jamais celui-ci, qui ne reflète que le dernier
  // sondage affiché côté client).
  const inactiveCount = g.members.filter((m) => m.uid !== uid && m.fait === 0).length;

  return (
    <div className="glass-panel">
      <div className="zk-detail-topbar">
        <button className="zk-link" onClick={onBack}>← Liste des zikr</button>
        <span className="zk-topbar-actions">
          {g.status === 'owner' && (
            <button type="button" className="zk-share-btn" onClick={() => setEditing((v) => !v)}
              title="Modifier ce zikr collectif" aria-label="Modifier ce zikr collectif">
              <Pencil size={14} strokeWidth={2.5} aria-hidden="true" /> {editing ? 'Fermer' : 'Modifier'}
            </button>
          )}
          {isMember && (
            <button type="button" className="zk-share-btn" onClick={() => setShowChat((v) => !v)}
              title="Discussion du groupe" aria-label="Discussion du groupe">
              <MessageCircle size={14} strokeWidth={2.5} aria-hidden="true" /> {showChat ? 'Fermer' : 'Discussion'}
            </button>
          )}
          <button type="button" className="zk-share-btn" onClick={doShare}
            title="Partager ce zikr collectif" aria-label="Partager ce zikr collectif">
            <Share2 size={14} strokeWidth={2.5} aria-hidden="true" /> Partager
          </button>
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
        {!!g.sessionAt && (
          <div className="zk-private-note">
            <Bell size={13} strokeWidth={2.5} aria-hidden="true" /> Prochaine session : {fmtSessionAt(g.sessionAt)}
            {isMember && ' — un rappel push sera envoyé aux membres approuvés ayant activé les notifications.'}
          </div>
        )}
        {g.private && (
          <div className="zk-private-note">
            <Lock size={13} strokeWidth={2.5} aria-hidden="true" /> Zikr privé — invisible dans la liste publique, accessible uniquement via le lien partagé.
          </div>
        )}
        {g.approved === false && (
          <div className="zk-private-note">
            <Clock size={13} strokeWidth={2.5} aria-hidden="true" /> En attente de validation par l’administrateur avant d’apparaître dans la liste publique.
            {isMember && ' Vous pouvez déjà inviter des participants via le lien de partage.'}
          </div>
        )}
      </div>

      {editing && g.status === 'owner' && (
        <EditGroupForm
          groupId={groupId}
          g={g}
          notify={notify}
          onSaved={() => { setEditing(false); load(); }}
          onCancel={() => setEditing(false)}
        />
      )}

      {/* Panneau admin (prozizou298@gmail.com ou tout compte admins/{clé}) :
          approuver pour la liste publique, ou supprimer n'importe quel zikr
          collectif — voir handleApproveZikr/handleDelete, pages/api/zikr.js. */}
      {g.isAdmin && (
        <div className="zk-admin-panel">
          <span className="zk-admin-badge"><ShieldCheck size={13} strokeWidth={2.5} aria-hidden="true" /> Administration</span>
          {g.approved === false && (
            <button type="button" className="zk-mini ok" onClick={doApproveZikr}>
              <Check size={13} strokeWidth={2.5} aria-hidden="true" /> Approuver
            </button>
          )}
          <button type="button" className="zk-mini no" onClick={doDelete}>
            <Trash2 size={13} strokeWidth={2.5} aria-hidden="true" /> Supprimer
          </button>
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
            <div className="zk-join-state"><Clock size={14} strokeWidth={2.5} aria-hidden="true" /> Votre demande est en attente de validation par le créateur.</div>
          ) : g.full ? (
            <div className="zk-join-state">Ce zikr collectif est complet — objectif entièrement récité.</div>
          ) : (
            <button className="zk-btn main" onClick={doJoin}>
              <Handshake size={16} strokeWidth={2.5} aria-hidden="true" /> Demander à rejoindre
            </button>
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
          <div className="zk-board-head">
            <h3>Participants ({g.members.length})</h3>
            {g.status === 'owner' && (
              <button
                type="button"
                className="zk-notify-inactive"
                onClick={doNotifyInactive}
                disabled={notifyBusy || inactiveCount === 0}
                title="Avertir les comptes n'ayant récité aucun grain — sinon ils seront retirés du groupe"
              >
                <Bell size={13} strokeWidth={2.5} aria-hidden="true" />
                Notifier les inactifs{inactiveCount > 0 ? ` (${inactiveCount})` : ''}
              </button>
            )}
          </div>
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
                  <span className="zk-board-stats">
                    <span className="zk-board-count">{fmt(m.fait)} grains</span>
                    <span className="zk-board-today">auj. {fmt(m.dailyTotal)}</span>
                  </span>
                  {m.rythme > 0 && (
                    <span className={'zk-pace' + (suspect ? ' suspect' : '')} title="Rythme instantané">
                      {suspect ? <AlertTriangle size={11} strokeWidth={2.5} aria-hidden="true" /> : <Zap size={11} strokeWidth={2.5} aria-hidden="true" />} {m.rythme}/min
                    </span>
                  )}
                  {g.status === 'owner' && m.uid !== uid && (
                    <span className="zk-mod-actions">
                      <button type="button" className="zk-mini warn" title="Avertir en privé"
                        aria-label={`Avertir ${m.email} en privé`} onClick={() => doWarn(m.uid, m.email)}>
                        <AlertTriangle size={13} strokeWidth={2.5} aria-hidden="true" />
                      </button>
                      <button type="button" className="zk-mini no" title="Exclure"
                        aria-label={`Exclure ${m.email}`} onClick={() => doExclude(m.uid, m.email)}>
                        <X size={13} strokeWidth={2.5} aria-hidden="true" />
                      </button>
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
          <h3><MessageCircle size={15} strokeWidth={2.5} aria-hidden="true" /> Discussion</h3>
          <div className="zk-chat-list" ref={chatListRef}>
            {messages.length === 0 ? (
              <p className="zk-muted">Aucun message pour l’instant — lancez la discussion !</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={'zk-chat-msg' + (m.uid === uid ? ' me' : '')}>
                  <span className="zk-chat-author">
                    {m.email || 'Membre'}
                    {m.uid === g.ownerUid && <Crown size={10} strokeWidth={2.5} aria-label="Créateur" />}
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
              disabled={chatBusy || !chatText.trim()} aria-label="Envoyer">
              <Send size={16} strokeWidth={2.5} aria-hidden="true" />
            </button>
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
        <strong>{fmt(total)}</strong> / {fmt(target)} ({fmtPct(pct)})
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
          <p><AlertTriangle size={14} strokeWidth={2.5} aria-hidden="true" /> {g.myWarning}</p>
          <button type="button" className="zk-link" onClick={onDismissWarning}>C’est noté</button>
        </div>
      )}

      <div className="zk-progress-block">
        <div className="zk-progress-meta"><span>Progression du groupe</span></div>
        <div className="zk-bar big">
          <span style={{ width: groupPct + '%' }} className={target > 0 && groupTotal >= target ? 'done' : ''} />
        </div>
        <div className="zk-progress-meta"><strong>{fmt(groupTotal)}</strong> / {fmt(target)} ({fmtPct(groupPct)})</div>

        {/* Deux compteurs personnels côte à côte : le total (jamais remis à
            zéro) et le total DU JOUR — fenêtre UTC commune à tout le groupe,
            pas un minuit par membre (lib/zikrLogic.js utcDateKey). Ce second
            total est celui rapporté par le SERVEUR au dernier sondage — pas
            corrigé comme `myFait` (t.total/syncedFait) : un léger décalage
            (rattrapé au prochain envoi groupé, SAVE_DEBOUNCE) est sans
            conséquence pour un simple repère "aujourd'hui". */}
        <div className="zk-my-stats">
          <div>
            <div className="zk-progress-meta"><span>Mes grains récités</span></div>
            <strong className="zk-my-fait">{fmt(myFait)}</strong>
          </div>
          <div>
            <div className="zk-progress-meta"><span>Aujourd’hui</span></div>
            <strong className="zk-my-fait">{fmt(Number(g.myDailyTotal) || 0)}</strong>
          </div>
        </div>
      </div>

      {/* Réglages masqués : pas de part personnelle en Zikr collectif,
          l'objectif restant affiché EST celui du groupe entier. */}
      <TasbihChapelet id={`collectif-${groupId}-${uid}`} t={t} collectifRestant={restant} />
    </>
  );
}
