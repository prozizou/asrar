// api/zikr.js (Vercel) — ZIKR COLLECTIF : un objectif de dhikr commun
// PARTAGÉ (pas de part individuelle) entre plusieurs comptes — l'objectif
// restant (target - total) est LE MÊME nombre pour tout le monde, mis à jour
// en direct à chaque grain égrené par n'importe quel participant. Chacun
// égrène sans plafond ni série qui lui soit propre (cf. components/
// useTasbih.js, paramètre `uncapped`, et components/TasbihChapelet.js, prop
// `collectifRestant`).
//
// `total` (sur le groupe) est un compteur CUMULATIF maintenu par transaction
// à chaque avancement (voir handleProgress) : il n'est JAMAIS décrémenté
// quand un membre quitte ou est exclu (handleLeave/handleExclude ne le
// touchent pas) — ce qu'un participant a récité reste définitivement acquis
// au groupe, même après son départ. C'est ce qui, côté port de référence
// (prozizou/mon-chapelet), nécessitait un champ `faitPartis` séparé (leur
// modèle re-somme les participants actifs à chaque lecture) : ici, la
// somme cumulative rend ce champ inutile — le départ ne touche simplement
// jamais `total`.
//
// Adhésion : n'importe quel compte peut DEMANDER à rejoindre ; seul le
// CRÉATEUR approuve. Le créateur peut modérer un participant (avertissement
// privé à un clic, ou exclusion) ; s'il quitte lui-même le groupe alors que
// d'autres y sont encore, l'administration passe automatiquement au membre
// arrivé le plus tôt après lui (jamais de groupe sans créateur).
//
// Présence « en ligne » : approximée par un battement de cœur — chaque
// sondage (`get`) ou avancement (`progress`) d'un membre pose `lastSeenAt`
// sur son entrée ; `handleGet` calcule `online` en comparant ce à
// ONLINE_WINDOW_MS (lib/zikrLogic.js), pas d'abonnement RTDB direct (cf.
// l'historique /api/check-access, /api/social : ce canal peut rester bloqué
// en silence sur certains réseaux — même raison que le sondage court déjà en
// place partout ailleurs dans l'app). Volontairement absente de la liste
// (`list`) : y ajouter le décompte « en ligne » par groupe demanderait de
// relire tous les membres de CHAQUE groupe à chaque affichage de la liste,
// pour un signal secondaire — coût jugé disproportionné là où le détail
// (`get`) lit de toute façon déjà tous les membres.
//
// Rythme (grains/minute) : mesuré CÔTÉ CLIENT (app/zikr/page.tsx, fenêtre
// glissante sur les dix dernières secondes) et simplement stocké tel quel
// ici — purement indicatif pour repérer un tapotement mécanique plutôt
// qu'une récitation avec intention, jamais bloquant.
//
// Tout passe par HTTPS (Admin SDK), comme le reste de l'app — jamais de SDK
// client Firebase RTDB direct.
//
// Body (JSON) : { idToken, action, ... }
//   action="list"           → liste des zikr collectifs (+ mon statut). Un
//                              zikr n'y apparaît, pour un compte qui n'y a
//                              AUCUN statut (ni créateur, ni membre, ni
//                              demande en attente), que s'il est PUBLIC
//                              (private:false) ET APPROUVÉ par l'administrateur
//                              (approved:true) — voir handleList. Dès qu'on a
//                              un statut (créateur/membre/en attente), toujours
//                              visible, quels que soient ces deux drapeaux.
//                              L'administrateur (isAdmin, server/access.js —
//                              prozizou298@gmail.com ou admins/{clé}) voit TOUT
//                              sans filtre : la liste lui sert aussi de file de
//                              modération. "get"/"join" restent accessibles par
//                              lien direct quels que soient private/approved
//                              (ces deux drapeaux ne restreignent QUE "list").
//   action="create"         → { name, presetId, arabic?, target, private? } :
//                              crée, le créateur rejoint aussitôt avec fait=0.
//                              approved=false par défaut (voir action="list") —
//                              doit être validé par l'administrateur avant
//                              d'apparaître dans la liste publique ; les zikr
//                              créés AVANT l'ajout de ce champ restent publics
//                              (approved absent traité comme "déjà approuvé",
//                              pas de régression rétroactive — voir handleList).
//   action="update"         → { groupId, name, presetId, arabic?, target,
//                              private? } : créateur only — modifie le zikr
//                              (mêmes règles de validation que "create"). La
//                              FORMULE (presetId/arabe) reste modifiable
//                              seulement tant qu'AUCUN grain n'a été
//                              comptabilisé (total===0) — sinon refusé, pour
//                              ne pas rendre incohérents les grains déjà
//                              acquis avec un texte différent.
//   action="get"            → { groupId } : détail (membres, ma part, avertissement)
//   action="join"           → { groupId } : demande d'adhésion
//   action="requests"       → { groupId } : créateur only — demandes en attente
//   action="approve"        → { groupId, uid } : créateur only — accepte un
//                              membre (à ne pas confondre avec "approveZikr")
//   action="reject"         → { groupId, uid } : créateur only
//   action="progress"       → { groupId, fait, rythme? } : membre only
//   action="warn"           → { groupId, uid } : créateur only — avertissement privé
//   action="dismissWarning" → { groupId } : membre only (soi-même)
//   action="exclude"        → { groupId, uid } : créateur only — jamais sur lui-même
//   action="leave"          → { groupId } : membre (créateur inclus, si un
//                              successeur existe — sinon, supprimer plutôt)
//   action="delete"         → { groupId } : créateur (seulement s'il est
//                              l'unique participant) OU ADMINISTRATEUR
//                              (n'importe quel zikr, quel que soit le nombre
//                              de participants — modération, voir handleDelete)
//   action="openWishes"     → { groupId } : créateur only — ouvre la possibilité
//                              de faire un vœu aux membres (objectif atteint
//                              seulement — voir handleOpenWishes)
//   action="closeWishes"    → { groupId } : créateur only — referme (les vœux
//                              déjà enregistrés restent visibles au créateur)
//   action="submitWish"     → { groupId, text } : membre only — enregistre (ou
//                              met à jour) SON PROPRE vœu, tant que c'est ouvert
//   action="sendMessage"    → { groupId, text } : membre only — discussion de
//                              groupe façon WhatsApp (voir handleSendMessage)
//   action="messages"       → { groupId } : membre only — 200 derniers messages
//   action="approveZikr"    → { groupId } : ADMINISTRATEUR only — fait passer
//                              approved à true (voir action="list"/"create")
//
// Nœuds (Admin SDK, écriture/lecture client interdites par les règles RTDB) :
//   zikr_groups/{gid}        = { name, presetId, transliteration, arabic,
//                                 target, total, ownerUid, ownerEmail,
//                                 createdAt, membersCount, wishesOpen?,
//                                 private?, approved? }
//   zikr_members/{gid}/{uid} = { email, fait, rythme, avertissement?,
//                                 joinedAt, updatedAt, lastSeenAt }
//   zikr_requests/{gid}/{uid}= { email, at }
//   zikr_wishes/{gid}/{uid}  = { email, text, at } — vœu PRIVÉ : visible
//                                 seulement du créateur (liste) et de son
//                                 auteur (sa propre entrée, jamais les autres)
//   zikr_chat/{gid}/{msgId}  = { uid, email, text, at } — discussion de groupe
//                                 (façon WhatsApp), réservée aux membres

const { verifyUser, isAdmin } = require("../../server/access");
const { app } = require("../../server/grant");
const { setCors, parseBody } = require("../../server/http");
const { rateLimit } = require("../../lib/rateLimit");
const { reportError } = require("../../server/log");
const {
  normalizeGroupInput, normalizeFait, normalizeRythme, cleanText,
  ONLINE_WINDOW_MS, MESSAGE_AVERTISSEMENT, WISH_MAX, CHAT_MESSAGE_MAX,
} = require("../../lib/zikrLogic");

// Clé Firebase valide (ids de groupe = push keys ; uid = uid Firebase).
function safeKey(v) { return (v == null ? "" : String(v)).replace(/[.#$/[\]]/g, "").slice(0, 64); }

// Limites : "list"/"get"/"progress"/"messages" sont fréquents (sondage temps
// réel + remontée d'avancement + discussion) mais légers → larges ;
// écritures rares → serrées.
function limitFor(action) {
  if (action === "list" || action === "get" || action === "progress" || action === "messages") {
    return { max: 120, windowMs: 60_000 };
  }
  return { max: 20, windowMs: 60_000 };
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const body = parseBody(req);
  const action = String(body.action || "");

  let user;
  try { user = await verifyUser(body.idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  const lim = limitFor(action);
  if (!rateLimit("zikr:" + action + ":" + user.uid, lim.max, lim.windowMs)) {
    return res.status(429).json({ error: "Trop de requêtes, réessaie dans un instant." });
  }

  const db = app().database();
  const gid = safeKey(body.groupId);

  try {
    switch (action) {
      case "list":           return await handleList(db, res, user);
      case "create":         return await handleCreate(db, res, user, body);
      case "update":         return await handleUpdate(db, res, user, gid, body);
      case "get":            return await handleGet(db, res, user, gid);
      case "join":            return await handleJoin(db, res, user, gid);
      case "requests":       return await handleRequests(db, res, user, gid);
      case "approve":        return await handleApprove(db, res, user, gid, safeKey(body.uid));
      case "reject":         return await handleReject(db, res, user, gid, safeKey(body.uid));
      case "progress":       return await handleProgress(db, res, user, gid, body.fait, body.rythme);
      case "warn":           return await handleWarn(db, res, user, gid, safeKey(body.uid));
      case "dismissWarning": return await handleDismissWarning(db, res, user, gid);
      case "exclude":        return await handleExclude(db, res, user, gid, safeKey(body.uid));
      case "leave":           return await handleLeave(db, res, user, gid);
      case "delete":          return await handleDelete(db, res, user, gid);
      case "openWishes":     return await handleOpenWishes(db, res, user, gid);
      case "closeWishes":    return await handleCloseWishes(db, res, user, gid);
      case "submitWish":     return await handleSubmitWish(db, res, user, gid, body.text);
      case "sendMessage":    return await handleSendMessage(db, res, user, gid, body.text);
      case "messages":       return await handleMessages(db, res, user, gid);
      case "approveZikr":    return await handleApproveZikr(db, res, user, gid);
      default:               return res.status(400).json({ error: "Action inconnue." });
    }
  } catch (e) {
    if (!e.statusCode) await reportError("zikr", e, { action, uid: user.uid });
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};

// ── Liste (+ mon statut sur chaque groupe) ──────────────────────
// Un compte sans AUCUN statut (ni créateur, ni membre, ni demande en
// attente) ne voit que les zikr PUBLICS (private:false) ET APPROUVÉS
// (approved:true) — invisible (aucune trace, même pas son existence) sinon.
// Dès qu'on a un statut, toujours visible quels que soient ces deux
// drapeaux (comme avant pour "private" — voir la PR précédente). L'admin
// voit TOUT, sans filtre : cette liste lui sert aussi de file de modération
// (action="approveZikr"). "get"/"join" restent accessibles par groupId
// direct (lien de partage) quels que soient ces drapeaux.
async function handleList(db, res, user) {
  const admin = await isAdmin(user);
  const snap = await db.ref("zikr_groups").once("value");
  const groups = [];
  snap.forEach((g) => {
    const v = g.val() || {};
    const target = Number(v.target) || 0;
    const total = Number(v.total) || 0;
    groups.push({
      id: g.key,
      name: v.name || "",
      transliteration: v.transliteration || "",
      arabic: v.arabic || "",
      target,
      total,
      remaining: Math.max(0, target - total),
      membersCount: Number(v.membersCount) || 0,
      ownerEmail: v.ownerEmail || "",
      isOwner: v.ownerUid === user.uid,
      createdAt: v.createdAt || 0,
      private: v.private === true,
      sessionAt: v.sessionAt || null,
      // Legacy (créé avant l'ajout de la modération) : approved absent →
      // déjà public, pas de disparition rétroactive. Seuls les NOUVEAUX zikr
      // (approved écrit explicitement à false, voir handleCreate) sont
      // soumis au filtre ci-dessous tant que l'admin ne les a pas validés.
      approved: v.approved !== false,
    });
  });

  // Mon statut (membre / en attente) — lecture ciblée sur MON uid uniquement.
  await Promise.all(
    groups.map(async (grp) => {
      if (grp.isOwner) { grp.status = "owner"; return; }
      const [mSnap, rSnap] = await Promise.all([
        db.ref("zikr_members/" + grp.id + "/" + user.uid).once("value"),
        db.ref("zikr_requests/" + grp.id + "/" + user.uid).once("value"),
      ]);
      grp.status = mSnap.exists() ? "member" : rSnap.exists() ? "pending" : "none";
    })
  );

  const visible = admin ? groups : groups.filter((grp) =>
    grp.status !== "none" || (grp.approved && !grp.private)
  );
  visible.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return res.status(200).json({ groups: visible, isAdmin: admin });
}

// ── Créer un zikr collectif (le créateur rejoint aussitôt, fait=0) ──
async function handleCreate(db, res, user, body) {
  const norm = normalizeGroupInput(body);
  if (norm.error) {
    const msg =
      norm.error === "name" ? "Donnez un titre au zikr collectif."
      : norm.error === "preset" ? "Choisissez une formule à réciter."
      : norm.error === "arabic" ? "Précisez le zikr à réciter (en arabe)."
      : "Objectif invalide (entier positif requis).";
    return res.status(400).json({ error: msg });
  }

  const ref = db.ref("zikr_groups").push();
  const gid = ref.key;
  const now = Date.now();
  await ref.set({
    name: norm.name,
    presetId: norm.presetId,
    transliteration: norm.transliteration,
    arabic: norm.arabic,
    target: norm.target,
    total: 0,
    private: norm.private,
    approved: false, // voir l'en-tête du fichier — l'administrateur doit valider
    ownerUid: user.uid,
    ownerEmail: user.email,
    createdAt: now,
    membersCount: 1, // le créateur est le premier participant
    sessionAt: norm.sessionAt, // horaire optionnel de la prochaine session (rappel push, lib/reminders.js)
    sessionReminderSent: false,
  });
  await db.ref("zikr_members/" + gid + "/" + user.uid).set({
    email: user.email, fait: 0, rythme: 0, joinedAt: now, updatedAt: now, lastSeenAt: now,
  });

  return res.status(200).json({ ok: true, id: gid });
}

// ── Créateur : modifie les informations du zikr collectif ───────
// Nom, objectif et visibilité (privé) restent modifiables à tout moment. La
// FORMULE récitée (presetId/arabe), elle, se verrouille dès que le groupe a
// commencé à réciter (total > 0) : la changer en cours de route rendrait les
// grains déjà comptabilisés incohérents avec le texte affiché à tous.
async function handleUpdate(db, res, user, gid, body) {
  const g = await assertOwner(db, gid, user);
  const norm = normalizeGroupInput(body);
  if (norm.error) {
    const msg =
      norm.error === "name" ? "Donnez un titre au zikr collectif."
      : norm.error === "preset" ? "Choisissez une formule à réciter."
      : norm.error === "arabic" ? "Précisez le zikr à réciter (en arabe)."
      : "Objectif invalide (entier positif requis).";
    return res.status(400).json({ error: msg });
  }

  const total = Number(g.total) || 0;
  const formulaChanged = norm.presetId !== g.presetId || norm.arabic !== g.arabic;
  if (total > 0 && formulaChanged) {
    return res.status(400).json({ error: "La formule récitée ne peut plus être modifiée : des grains ont déjà été comptabilisés pour ce zikr." });
  }

  // Un nouvel horaire (ou son retrait) réarme le rappel : sinon, changer la
  // session après un premier envoi ne préviendrait plus personne du nouveau
  // rendez-vous (voir pages/api/cron/reminders.js, sessionReminderSent).
  const sessionChanged = norm.sessionAt !== (g.sessionAt || null);

  await db.ref("zikr_groups/" + gid).update({
    name: norm.name,
    presetId: norm.presetId,
    transliteration: norm.transliteration,
    arabic: norm.arabic,
    target: norm.target,
    private: norm.private,
    sessionAt: norm.sessionAt,
    ...(sessionChanged ? { sessionReminderSent: false } : {}),
  });
  return res.status(200).json({ ok: true });
}

// ── Détail d'un groupe (membres, ma part, avertissement, présence) ──
async function handleGet(db, res, user, gid) {
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });
  const gSnap = await db.ref("zikr_groups/" + gid).once("value");
  const g = gSnap.val();
  if (!g) return res.status(404).json({ error: "Zikr collectif introuvable." });

  const admin = await isAdmin(user);
  const isOwner = g.ownerUid === user.uid;
  const target = Number(g.target) || 0;
  const total = Number(g.total) || 0;
  const remaining = Math.max(0, target - total);
  const now = Date.now();

  const membersSnap = await db.ref("zikr_members/" + gid).once("value");
  const members = [];
  let mine = null;
  membersSnap.forEach((m) => {
    const v = m.val() || {};
    const entry = {
      uid: m.key,
      email: v.email || "",
      fait: Number(v.fait) || 0,
      rythme: Number(v.rythme) || 0,
      online: now - (Number(v.lastSeenAt) || 0) < ONLINE_WINDOW_MS,
    };
    if (m.key === user.uid) mine = { ...entry, avertissement: v.avertissement || "" };
    members.push(entry);
  });
  members.sort((a, b) => b.fait - a.fait); // classement décroissant

  // Statut de l'appelant : créateur > membre > (demande en attente) > aucun.
  let status;
  const owner = {};
  if (isOwner) {
    status = "owner";
    const rSnap = await db.ref("zikr_requests/" + gid).once("value");
    const requests = [];
    rSnap.forEach((r) => {
      const v = r.val() || {};
      requests.push({ uid: r.key, email: v.email || "", at: v.at || 0 });
    });
    owner.requests = requests;
    owner.pending = requests.length;

    // Vœux des participants : visibles UNIQUEMENT du créateur (liste complète),
    // jamais des autres membres entre eux — voir l'en-tête du fichier.
    const wSnap = await db.ref("zikr_wishes/" + gid).once("value");
    const wishes = [];
    wSnap.forEach((w) => {
      const v = w.val() || {};
      wishes.push({ uid: w.key, email: v.email || "", text: v.text || "", at: v.at || 0 });
    });
    wishes.sort((a, b) => (b.at || 0) - (a.at || 0));
    owner.wishes = wishes;
  } else if (mine) {
    status = "member";
  } else {
    const rSnap = await db.ref("zikr_requests/" + gid + "/" + user.uid).once("value");
    status = rSnap.exists() ? "pending" : "none";
  }

  // Battement de cœur (présence « en ligne ») — seulement pour un membre qui
  // sonde effectivement son propre groupe (pas de sens sinon).
  if (mine) await db.ref("zikr_members/" + gid + "/" + user.uid + "/lastSeenAt").set(now);

  const full = remaining <= 0; // objectif entièrement récité

  // Mon propre vœu (jamais celui des autres) — pour préremplir le formulaire
  // si j'en avais déjà envoyé un. Un membre simple (pas le créateur) n'a pas
  // besoin de la liste complète, seulement de sa propre entrée.
  let myWish = "";
  if (mine && !isOwner) {
    const mwSnap = await db.ref("zikr_wishes/" + gid + "/" + user.uid).once("value");
    myWish = (mwSnap.val() && mwSnap.val().text) || "";
  }

  return res.status(200).json({
    id: gid,
    name: g.name || "",
    presetId: g.presetId || "",
    transliteration: g.transliteration || "",
    arabic: g.arabic || "",
    target,
    total,
    remaining,
    ownerUid: g.ownerUid || "",
    ownerEmail: g.ownerEmail || "",
    createdAt: g.createdAt || 0,
    membersCount: Number(g.membersCount) || 0,
    onlineCount: members.filter((m) => m.online).length,
    full,
    private: g.private === true,
    approved: g.approved !== false,
    sessionAt: g.sessionAt || null,
    isAdmin: admin,
    wishesOpen: g.wishesOpen === true,
    status,
    myFait: mine ? mine.fait : 0,
    myWarning: mine ? mine.avertissement : "",
    myWish,
    members,
    ...owner,
  });
}

// ── Demander à rejoindre ────────────────────────────────────────
async function handleJoin(db, res, user, gid) {
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });
  const gSnap = await db.ref("zikr_groups/" + gid).once("value");
  const g = gSnap.val();
  if (!g) return res.status(404).json({ error: "Zikr collectif introuvable." });
  if (g.ownerUid === user.uid) return res.status(200).json({ ok: true, status: "owner" });

  const mSnap = await db.ref("zikr_members/" + gid + "/" + user.uid).once("value");
  if (mSnap.exists()) return res.status(200).json({ ok: true, status: "member" });

  await db.ref("zikr_requests/" + gid + "/" + user.uid).set({ email: user.email, at: Date.now() });
  return res.status(200).json({ ok: true, status: "pending" });
}

// ── Créateur : demandes en attente ─────────────────────────────
async function handleRequests(db, res, user, gid) {
  await assertOwner(db, gid, user);
  const rSnap = await db.ref("zikr_requests/" + gid).once("value");
  const requests = [];
  rSnap.forEach((r) => {
    const v = r.val() || {};
    requests.push({ uid: r.key, email: v.email || "", at: v.at || 0 });
  });
  return res.status(200).json({ requests });
}

// ── Créateur : accepter une demande ─────────────────────────────
async function handleApprove(db, res, user, gid, uid) {
  await assertOwner(db, gid, user);
  if (!uid) return res.status(400).json({ error: "Compte manquant." });

  const reqSnap = await db.ref("zikr_requests/" + gid + "/" + uid).once("value");
  if (!reqSnap.exists()) return res.status(404).json({ error: "Demande introuvable (déjà traitée ?)." });
  const info = reqSnap.val() || {};

  const now = Date.now();
  // Transaction : deux approbations simultanées de la même demande (double-
  // clic) ne créent qu'une seule entrée, sans écraser un avancement déjà
  // enregistré entre-temps.
  await db.ref("zikr_members/" + gid).transaction((members) => {
    members = members || {};
    if (members[uid]) return members; // déjà approuvé
    members[uid] = { email: info.email || "", fait: 0, rythme: 0, joinedAt: now, updatedAt: now, lastSeenAt: now };
    return members;
  });

  await db.ref("zikr_requests/" + gid + "/" + uid).remove();
  await db.ref("zikr_groups/" + gid + "/membersCount").transaction((n) => (n || 0) + 1);
  return res.status(200).json({ ok: true });
}

// ── Créateur : refuser une demande ─────────────────────────────
async function handleReject(db, res, user, gid, uid) {
  await assertOwner(db, gid, user);
  if (!uid) return res.status(400).json({ error: "Compte manquant." });
  await db.ref("zikr_requests/" + gid + "/" + uid).remove();
  return res.status(200).json({ ok: true });
}

// ── Membre : avancement ABSOLU + rythme (temps réel, sans valider) ──
async function handleProgress(db, res, user, gid, rawFait, rawRythme) {
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });

  const gSnap = await db.ref("zikr_groups/" + gid).once("value");
  const g = gSnap.val();
  if (!g) return res.status(404).json({ error: "Zikr collectif introuvable." });

  const memRef = db.ref("zikr_members/" + gid + "/" + user.uid);
  const memSnap = await memRef.once("value");
  if (!memSnap.exists()) return res.status(403).json({ error: "Rejoignez d'abord ce zikr collectif." });
  const mem = memSnap.val() || {};

  const oldFait = Number(mem.fait) || 0;
  // Avancement MONOTONE, SANS PLAFOND (objectif partagé, pas de part
  // individuelle) : on ne retient jamais une valeur inférieure à celle déjà
  // enregistrée. Le client envoie un absolu déduit de son compteur local
  // (localStorage) ; sans ce garde-fou, un appareil neuf (stockage vide), une
  // navigation privée ou le bouton « réinitialiser » renverrait 0 et ferait
  // RECULER le total commun — au détriment de tout le groupe.
  const newFait = Math.max(oldFait, normalizeFait(rawFait));
  const delta = newFait - oldFait;
  const rythme = normalizeRythme(rawRythme);

  await memRef.update({ fait: newFait, rythme, updatedAt: Date.now(), lastSeenAt: Date.now() });
  let total = Number(g.total) || 0;
  if (delta !== 0) {
    // Total CUMULATIF (jamais décrémenté, même quand un membre quitte plus
    // tard — voir l'en-tête du fichier) : maintenu par transaction (le delta
    // reste juste même si plusieurs membres avancent en même temps).
    const totalTx = await db.ref("zikr_groups/" + gid + "/total").transaction((t) => Math.max(0, (t || 0) + delta));
    total = Number(totalTx.snapshot && totalTx.snapshot.val()) || 0;
  }

  return res.status(200).json({ ok: true, fait: newFait, total });
}

// ── Créateur : avertissement privé à un clic ────────────────────
async function handleWarn(db, res, user, gid, uid) {
  await assertOwner(db, gid, user);
  if (!uid) return res.status(400).json({ error: "Compte manquant." });
  if (uid === user.uid) return res.status(400).json({ error: "Vous ne pouvez pas vous avertir vous-même." });
  const memSnap = await db.ref("zikr_members/" + gid + "/" + uid).once("value");
  if (!memSnap.exists()) return res.status(404).json({ error: "Ce compte n'est plus dans le groupe." });
  await db.ref("zikr_members/" + gid + "/" + uid + "/avertissement").set(MESSAGE_AVERTISSEMENT);
  return res.status(200).json({ ok: true });
}

// ── Membre : efface l'avertissement une fois lu (soi-même) ─────
async function handleDismissWarning(db, res, user, gid) {
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });
  await db.ref("zikr_members/" + gid + "/" + user.uid + "/avertissement").remove();
  return res.status(200).json({ ok: true });
}

// ── Créateur : exclut un participant (jamais lui-même) ──────────
async function handleExclude(db, res, user, gid, uid) {
  const g = await assertOwner(db, gid, user);
  if (!uid) return res.status(400).json({ error: "Compte manquant." });
  if (uid === g.ownerUid) {
    return res.status(400).json({ error: "Le créateur ne peut pas s'auto-exclure — quittez ou supprimez le zikr collectif." });
  }
  await removeParticipant(db, gid, g, uid);
  return res.status(200).json({ ok: true });
}

// ── Membre : quitter (créateur inclus, si un successeur existe) ──
async function handleLeave(db, res, user, gid) {
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });
  const gSnap = await db.ref("zikr_groups/" + gid).once("value");
  const g = gSnap.val();
  if (!g) return res.status(404).json({ error: "Zikr collectif introuvable." });

  if (g.ownerUid === user.uid && (Number(g.membersCount) || 0) <= 1) {
    return res.status(400).json({ error: "Vous êtes seul dans ce zikr collectif : supprimez-le plutôt que de le quitter." });
  }
  await removeParticipant(db, gid, g, user.uid);
  return res.status(200).json({ ok: true });
}

// Retire un participant du groupe (quitte de son propre chef, ou exclu par
// le créateur) — ce qu'il a déjà récité reste définitivement acquis à
// `total` (jamais touché ici, voir l'en-tête du fichier). Si le PARTANT est
// le créateur et qu'il reste d'autres membres, l'un d'eux (le plus ancien
// arrivé) devient automatiquement le nouveau créateur — un groupe existant
// n'est jamais laissé sans titulaire.
async function removeParticipant(db, gid, g, targetUid) {
  let existed = false;
  const tx = await db.ref("zikr_members/" + gid).transaction((members) => {
    members = members || {};
    if (!members[targetUid]) { existed = false; return members; }
    existed = true;
    delete members[targetUid];
    return members;
  });
  if (!existed) return; // déjà parti — idempotent

  await db.ref("zikr_groups/" + gid + "/membersCount").transaction((n) => Math.max(0, (n || 1) - 1));
  await db.ref("zikr_requests/" + gid + "/" + targetUid).remove();

  if (targetUid === g.ownerUid) {
    const remaining = (tx.committed && tx.snapshot && tx.snapshot.val()) || {};
    const entries = Object.entries(remaining).sort(
      (a, b) => (Number(a[1].joinedAt) || 0) - (Number(b[1].joinedAt) || 0)
    );
    if (entries.length > 0) {
      const [nextUid, nextData] = entries[0];
      await db.ref("zikr_groups/" + gid).update({ ownerUid: nextUid, ownerEmail: nextData.email || "" });
    }
  }
}

// ── Supprimer le groupe : le créateur (seulement s'il est seul — les
// autres participants doivent d'abord quitter) OU L'ADMINISTRATEUR
// (n'importe quel zikr collectif, quel que soit le nombre de participants —
// pouvoir de modération, voir l'en-tête du fichier) ───────────────
async function handleDelete(db, res, user, gid) {
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });
  const gSnap = await db.ref("zikr_groups/" + gid).once("value");
  const g = gSnap.val();
  if (!g) return res.status(404).json({ error: "Zikr collectif introuvable." });

  const admin = await isAdmin(user);
  if (!admin) {
    if (g.ownerUid !== user.uid) {
      const e = new Error("Action réservée au créateur du zikr collectif.");
      e.statusCode = 403;
      throw e;
    }
    if ((Number(g.membersCount) || 0) > 1) {
      return res.status(409).json({ error: "D'autres participants ont rejoint ce zikr collectif — quittez-le plutôt (un autre membre en devient créateur)." });
    }
  }

  await Promise.all([
    db.ref("zikr_groups/" + gid).remove(),
    db.ref("zikr_members/" + gid).remove(),
    db.ref("zikr_requests/" + gid).remove(),
    db.ref("zikr_wishes/" + gid).remove(),
    db.ref("zikr_chat/" + gid).remove(),
  ]);
  return res.status(200).json({ ok: true });
}

// ── Administrateur : approuve un zikr collectif pour la liste publique ──
async function handleApproveZikr(db, res, user, gid) {
  if (!(await isAdmin(user))) {
    const e = new Error("Action réservée à l'administrateur.");
    e.statusCode = 403;
    throw e;
  }
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });
  const snap = await db.ref("zikr_groups/" + gid).once("value");
  if (!snap.exists()) return res.status(404).json({ error: "Zikr collectif introuvable." });
  await db.ref("zikr_groups/" + gid + "/approved").set(true);
  return res.status(200).json({ ok: true });
}

// ── Créateur : ouvre la possibilité de faire un vœu ─────────────
// Seulement une fois l'objectif ENTIÈREMENT récité par le groupe — un vœu
// après un dhikr collectif accompli, pas avant (cohérent avec la pratique :
// on formule le vœu une fois l'engagement commun tenu).
async function handleOpenWishes(db, res, user, gid) {
  const g = await assertOwner(db, gid, user);
  const target = Number(g.target) || 0;
  const total = Number(g.total) || 0;
  if (target <= 0 || total < target) {
    return res.status(400).json({ error: "L'objectif du zikr collectif doit être entièrement atteint avant d'ouvrir les vœux." });
  }
  await db.ref("zikr_groups/" + gid + "/wishesOpen").set(true);
  return res.status(200).json({ ok: true });
}

// ── Créateur : referme (les vœux déjà reçus restent visibles) ──
async function handleCloseWishes(db, res, user, gid) {
  await assertOwner(db, gid, user);
  await db.ref("zikr_groups/" + gid + "/wishesOpen").set(false);
  return res.status(200).json({ ok: true });
}

// ── Membre : enregistre (ou met à jour) SON PROPRE vœu ──────────
// Jamais visible des autres membres — seulement de son auteur et du créateur
// (liste complète, voir handleGet) : un vœu reste une démarche personnelle.
async function handleSubmitWish(db, res, user, gid, rawText) {
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });
  const gSnap = await db.ref("zikr_groups/" + gid).once("value");
  const g = gSnap.val();
  if (!g) return res.status(404).json({ error: "Zikr collectif introuvable." });
  if (g.wishesOpen !== true) {
    return res.status(403).json({ error: "Les vœux ne sont pas (encore) ouverts pour ce zikr collectif." });
  }

  const memSnap = await db.ref("zikr_members/" + gid + "/" + user.uid).once("value");
  if (!memSnap.exists()) return res.status(403).json({ error: "Rejoignez d'abord ce zikr collectif." });

  const text = cleanText(rawText, WISH_MAX);
  if (!text) return res.status(400).json({ error: "Écrivez votre vœu avant d'envoyer." });

  await db.ref("zikr_wishes/" + gid + "/" + user.uid).set({ email: user.email, text, at: Date.now() });
  return res.status(200).json({ ok: true, text });
}

// ── Membre : discussion de groupe façon WhatsApp ─────────────────
// Réservée aux membres (créateur inclus) : jamais accessible à un visiteur
// qui n'a pas encore rejoint (même par lien direct — contrairement à
// get/join, volontairement plus permissifs).
async function handleSendMessage(db, res, user, gid, rawText) {
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });
  const memSnap = await db.ref("zikr_members/" + gid + "/" + user.uid).once("value");
  if (!memSnap.exists()) return res.status(403).json({ error: "Rejoignez d'abord ce zikr collectif." });

  const text = cleanText(rawText, CHAT_MESSAGE_MAX);
  if (!text) return res.status(400).json({ error: "Écrivez un message avant d'envoyer." });

  const ref = db.ref("zikr_chat/" + gid).push();
  await ref.set({ uid: user.uid, email: user.email, text, at: Date.now() });
  return res.status(200).json({ ok: true, id: ref.key });
}

// Messages récents (200 derniers — une discussion de groupe reste modeste,
// pas besoin de pagination complète). Sondée régulièrement par le client
// tant que le panneau discussion est ouvert (app/zikr/page.tsx).
async function handleMessages(db, res, user, gid) {
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });
  const memSnap = await db.ref("zikr_members/" + gid + "/" + user.uid).once("value");
  if (!memSnap.exists()) return res.status(403).json({ error: "Rejoignez d'abord ce zikr collectif." });

  const snap = await db.ref("zikr_chat/" + gid).limitToLast(200).once("value");
  const messages = [];
  snap.forEach((m) => {
    const v = m.val() || {};
    messages.push({ id: m.key, uid: v.uid || "", email: v.email || "", text: v.text || "", at: v.at || 0 });
  });
  return res.status(200).json({ messages });
}

// Vérifie que l'appelant est bien le créateur du groupe, sinon lève une erreur
// HTTP (403/404). Renvoie le groupe (utile pour lire target/total ensuite).
async function assertOwner(db, gid, user) {
  if (!gid) { const e = new Error("Groupe manquant."); e.statusCode = 400; throw e; }
  const g = (await db.ref("zikr_groups/" + gid).once("value")).val();
  if (!g) { const e = new Error("Zikr collectif introuvable."); e.statusCode = 404; throw e; }
  if (g.ownerUid !== user.uid) {
    const e = new Error("Action réservée au créateur du zikr collectif.");
    e.statusCode = 403;
    throw e;
  }
  return g;
}
