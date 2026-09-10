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
// client Firebase direct.
//
// MIGRATION FIRESTORE (Phase 5, voir docs/FIRESTORE_SCHEMA.md) : zikr_groups
// devient une collection Firestore (gid préservé), avec members/requests/
// wishes/messages en SOUS-COLLECTIONS (au lieu de 6 nœuds RTDB frères reliés
// seulement par convention de nommage). zikr_wish_amines/{gid}/{wishUid}
// (RTDB) est fusionné dans le champ `amines` du vœu correspondant — un seul
// document à lire/écrire au lieu de deux nœuds toujours consultés ensemble.
// push_subscriptions (notifications) a suivi en Phase 6 : sendPushToUid/
// pushInactivityWarning/notifyReciting/notifyNewMessage lisent désormais
// aussi Firestore — plus aucun accès RTDB dans ce fichier.
//
// Amélioration notable (transactions Firestore multi-documents, impossibles
// sur la RTDB — voir docs/FIRESTORE_SCHEMA.md) : handleProgress combine en
// UNE transaction ce qui exigeait 3 transactions RTDB indépendantes (fait/
// rythme du membre, total du groupe, total du jour) ; handleApprove combine
// en UNE transaction la lecture de la demande, la création du membre, la
// suppression de la demande et l'incrément de membersCount (jamais de double
// comptage même en cas de double-clic concurrent) ; handleAmineWish combine
// lecture + bascule + recomptage en une seule transaction.
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
//   action="progress"       → { groupId, fait, rythme? } : membre only — met
//                              aussi à jour le total DU JOUR (fenêtre UTC
//                              commune à tout le groupe, voir zikr_groups/
//                              {gid}/members ci-dessous) et, à la reprise
//                              d'activité (le compte était hors ligne juste
//                              avant cet appel), prévient les AUTRES membres
//                              en push que ce compte est en train de réciter
//                              — au plus une fois par heure et par
//                              destinataire (voir handleProgress/notifyReciting)
//   action="warn"           → { groupId, uid } : créateur only — avertissement privé
//   action="notifyInactive" → { groupId } : créateur only — avertissement privé +
//                              notification push (si abonné) à TOUS les comptes
//                              du groupe n'ayant récité aucun grain (fait===0),
//                              en un clic (voir handleNotifyInactive)
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
//   action="shareWish"      → { groupId, shared } : membre only — partage (ou
//                              retire du partage) SON PROPRE vœu déjà envoyé,
//                              vers le mur commun (sharedWishes, voir "get")
//                              où les autres membres peuvent dire Amine —
//                              OPT-IN, un vœu reste privé par défaut
//   action="amineWish"      → { groupId, wishUid } : membre only — dit
//                              « Amine » (ou le retire, toggle) sur un vœu
//                              PARTAGÉ par un autre membre — refusé sur un
//                              vœu resté privé
//   action="sendMessage"    → { groupId, text?, mediaType?, mediaUrl?,
//                              mediaDuration? } : membre only — discussion de
//                              groupe façon WhatsApp, texte et/ou pièce jointe
//                              (image ou audio — voir handleSendMessage) ;
//                              notifie en push (best-effort) tous les AUTRES
//                              membres (voir notifyNewMessage)
//   action="messages"       → { groupId } : membre only — 200 derniers messages
//   action="approveZikr"    → { groupId } : ADMINISTRATEUR only — fait passer
//                              approved à true (voir action="list"/"create")
//
// Collections Firestore (Admin SDK, lecture/écriture client interdites par
// firestore.rules) :
//   zikr_groups/{gid}                = { name, presetId, transliteration, arabic,
//                                 target, total, ownerUid, ownerEmail,
//                                 ownerName? (nom Google, affichage seulement
//                                 — "Créé par {ownerName || partie locale de
//                                 ownerEmail}", voir chatDisplayName),
//                                 createdAt, membersCount, wishesOpen?,
//                                 private?, approved? }
//   zikr_groups/{gid}/members/{uid}  = { email, fait, rythme, avertissement?,
//                                 joinedAt, updatedAt, lastSeenAt,
//                                 daily?: { date, total } — total DU JOUR
//                                 (fenêtre UTC commune à tout le groupe,
//                                 lib/zikrLogic.js utcDateKey) : bascule
//                                 paresseuse à la LECTURE (handleGet compare
//                                 juste `date` au jour courant), jamais de job
//                                 de remise à zéro à programmer,
//                                 lastRecitingPushAt? — throttle du push
//                                 « reprise d'activité » (voir notifyReciting) }
//   zikr_groups/{gid}/requests/{uid} = { email, at }
//   zikr_groups/{gid}/wishes/{uid}   = { email, text, at, shared?,
//                                 amines?: {uid: true} } — vœu PRIVÉ par
//                                 défaut : visible seulement du créateur
//                                 (liste) et de son auteur (sa propre entrée,
//                                 jamais les autres) ; shared:true (opt-in,
//                                 action="shareWish") le fait apparaître sur
//                                 le mur commun (sharedWishes, action="get")
//                                 où n'importe quel membre peut dire Amine —
//                                 qui l'a dit vit dans `amines` (map uid→true)
//                                 sur CE MÊME document (action="amineWish")
//   zikr_groups/{gid}/messages/{id}  = { uid, email, name?, picture?, text, at,
//                                 mediaType?, mediaUrl?, mediaDuration? } —
//                                 discussion de groupe (façon WhatsApp),
//                                 réservée aux membres ; name/picture (nom et
//                                 photo Google, voir server/access.js
//                                 verifyUser) absents pour un compte email/
//                                 mot de passe — le client retombe alors sur
//                                 la partie locale de l'email (affichage
//                                 seulement, jamais utilisé pour l'autorité) ;
//                                 mediaType ∈ {"image","audio"} si une pièce
//                                 jointe accompagne (ou remplace) le texte

const webpush = require("web-push");
const { verifyUser, isAdmin } = require("../../server/access");
const { app } = require("../../server/grant");
const { setCors, parseBody } = require("../../server/http");
const { rateLimit } = require("../../lib/rateLimit");
const { reportError } = require("../../server/log");
const {
  normalizeGroupInput, normalizeFait, normalizeRythme, cleanText, utcDateKey,
  ONLINE_WINDOW_MS, RECITING_PUSH_WINDOW_MS, MESSAGE_AVERTISSEMENT, MESSAGE_INACTIVITE,
  WISH_MAX, CHAT_MESSAGE_MAX, CHAT_MEDIA_TYPES, isValidChatMessage, amineCount,
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

  // Firestore pour tout, y compris push_subscriptions (notifications) depuis
  // la Phase 6 de la migration (voir docs/FIRESTORE_SCHEMA.md) — plus aucun
  // accès RTDB dans ce fichier.
  const firestore = app().firestore();
  const gid = safeKey(body.groupId);

  try {
    switch (action) {
      case "list":           return await handleList(firestore, res, user);
      case "create":         return await handleCreate(firestore, res, user, body);
      case "update":         return await handleUpdate(firestore, res, user, gid, body);
      case "get":            return await handleGet(firestore, res, user, gid);
      case "join":            return await handleJoin(firestore, res, user, gid);
      case "requests":       return await handleRequests(firestore, res, user, gid);
      case "approve":        return await handleApprove(firestore, res, user, gid, safeKey(body.uid));
      case "reject":         return await handleReject(firestore, res, user, gid, safeKey(body.uid));
      case "progress":       return await handleProgress(firestore, res, user, gid, body.fait, body.rythme);
      case "warn":           return await handleWarn(firestore, res, user, gid, safeKey(body.uid));
      case "notifyInactive": return await handleNotifyInactive(firestore, res, user, gid);
      case "dismissWarning": return await handleDismissWarning(firestore, res, user, gid);
      case "exclude":        return await handleExclude(firestore, res, user, gid, safeKey(body.uid));
      case "leave":           return await handleLeave(firestore, res, user, gid);
      case "delete":          return await handleDelete(firestore, res, user, gid);
      case "openWishes":     return await handleOpenWishes(firestore, res, user, gid);
      case "closeWishes":    return await handleCloseWishes(firestore, res, user, gid);
      case "submitWish":     return await handleSubmitWish(firestore, res, user, gid, body.text);
      case "shareWish":      return await handleShareWish(firestore, res, user, gid, body.shared);
      case "amineWish":      return await handleAmineWish(firestore, res, user, gid, safeKey(body.wishUid));
      case "sendMessage":    return await handleSendMessage(firestore, res, user, gid, body.text, body.mediaType, body.mediaUrl, body.mediaDuration);
      case "messages":       return await handleMessages(firestore, res, user, gid);
      case "approveZikr":    return await handleApproveZikr(firestore, res, user, gid);
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
async function handleList(firestore, res, user) {
  const admin = await isAdmin(user);
  const snap = await firestore.collection("zikr_groups").get();
  const groups = [];
  snap.forEach((g) => {
    const v = g.data() || {};
    const target = Number(v.target) || 0;
    const total = Number(v.total) || 0;
    groups.push({
      id: g.id,
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
      const gRef = firestore.collection("zikr_groups").doc(grp.id);
      const [mSnap, rSnap] = await Promise.all([
        gRef.collection("members").doc(user.uid).get(),
        gRef.collection("requests").doc(user.uid).get(),
      ]);
      grp.status = mSnap.exists ? "member" : rSnap.exists ? "pending" : "none";
    })
  );

  const visible = admin ? groups : groups.filter((grp) =>
    grp.status !== "none" || (grp.approved && !grp.private)
  );
  visible.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return res.status(200).json({ groups: visible, isAdmin: admin });
}

// ── Créer un zikr collectif (le créateur rejoint aussitôt, fait=0) ──
async function handleCreate(firestore, res, user, body) {
  const norm = normalizeGroupInput(body);
  if (norm.error) {
    const msg =
      norm.error === "name" ? "Donnez un titre au zikr collectif."
      : norm.error === "preset" ? "Choisissez une formule à réciter."
      : norm.error === "arabic" ? "Précisez le zikr à réciter (en arabe)."
      : "Objectif invalide (entier positif requis).";
    return res.status(400).json({ error: msg });
  }

  const ref = firestore.collection("zikr_groups").doc();
  const gid = ref.id;
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
    ownerName: user.name || "", // nom Google (server/access.js verifyUser) — affichage seulement, voir handleGet
    createdAt: now,
    membersCount: 1, // le créateur est le premier participant
    sessionAt: norm.sessionAt, // horaire optionnel de la prochaine session (rappel push, lib/reminders.js)
    sessionReminderSent: false,
  });
  await ref.collection("members").doc(user.uid).set({
    email: user.email, fait: 0, rythme: 0, joinedAt: now, updatedAt: now, lastSeenAt: now,
  });

  return res.status(200).json({ ok: true, id: gid });
}

// ── Créateur : modifie les informations du zikr collectif ───────
// Nom, objectif et visibilité (privé) restent modifiables à tout moment. La
// FORMULE récitée (presetId/arabe), elle, se verrouille dès que le groupe a
// commencé à réciter (total > 0) : la changer en cours de route rendrait les
// grains déjà comptabilisés incohérents avec le texte affiché à tous.
async function handleUpdate(firestore, res, user, gid, body) {
  const { ref, data: g } = await assertOwner(firestore, gid, user);
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

  await ref.update({
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
async function handleGet(firestore, res, user, gid) {
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });
  const gRef = firestore.collection("zikr_groups").doc(gid);
  const gSnap = await gRef.get();
  const g = gSnap.exists ? gSnap.data() : null;
  if (!g) return res.status(404).json({ error: "Zikr collectif introuvable." });

  const admin = await isAdmin(user);
  const isOwner = g.ownerUid === user.uid;
  const target = Number(g.target) || 0;
  const total = Number(g.total) || 0;
  const remaining = Math.max(0, target - total);
  const now = Date.now();
  const today = utcDateKey(now); // fenêtre du "total du jour" — voir lib/zikrLogic.js

  // Total DU JOUR (v.daily = { date, total }, écrit par handleProgress) —
  // bascule paresseuse : un `daily` d'une date différente d'aujourd'hui est
  // simplement traité comme 0, sans qu'aucun job n'ait besoin de le remettre
  // à zéro à minuit.
  const dailyOf = (v) => (v.daily && v.daily.date === today ? Number(v.daily.total) || 0 : 0);

  // Ma propre entrée UNIQUEMENT, d'abord — pas tout `members` (revue de
  // sécurité) : avant ce correctif, "get" renvoyait le uid + email + activité
  // de TOUS les membres à quiconque connaissait le groupId, même sans y être
  // (y compris un groupe `private:true`). Le trousseau complet (avec uid/
  // email) n'est désormais construit que pour le créateur/un membre,
  // ci-dessous — un visiteur non-membre n'obtient qu'un aperçu (compteurs
  // déjà publics via `membersCount`/`total`/`remaining`), jamais l'identité
  // des participants. Le tableau client (app/zikr/page.tsx) ne lit
  // d'ailleurs `members` que derrière `isMember`, donc rien ne change pour
  // un membre réel.
  const mineSnap = await gRef.collection("members").doc(user.uid).get();
  let mine = null;
  if (mineSnap.exists) {
    const v = mineSnap.data() || {};
    mine = {
      uid: user.uid,
      email: v.email || "",
      fait: Number(v.fait) || 0,
      rythme: Number(v.rythme) || 0,
      online: now - (Number(v.lastSeenAt) || 0) < ONLINE_WINDOW_MS,
      avertissement: v.avertissement || "",
      dailyTotal: dailyOf(v),
    };
  }

  // L'administrateur voit aussi le trousseau complet (modération — même
  // logique que handleList, qui lui montre tous les groupes sans filtre).
  let members = [];
  if (isOwner || mine || admin) {
    const membersSnap = await gRef.collection("members").get();
    membersSnap.forEach((m) => {
      const v = m.data() || {};
      members.push({
        uid: m.id,
        email: v.email || "",
        fait: Number(v.fait) || 0,
        rythme: Number(v.rythme) || 0,
        online: now - (Number(v.lastSeenAt) || 0) < ONLINE_WINDOW_MS,
        dailyTotal: dailyOf(v),
      });
    });
    members.sort((a, b) => b.fait - a.fait); // classement décroissant
  }

  // Statut de l'appelant : créateur > membre > (demande en attente) > aucun.
  let status;
  const owner = {};
  const isRealMember = isOwner || !!mine;

  // Vœux : lus UNE SEULE FOIS pour tout membre réel (créateur ou participant)
  // — sert à construire à la fois la liste PRIVÉE (créateur only, ci-dessous)
  // et le mur des vœux PARTAGÉS (n'importe quel membre, plus bas), sans lire
  // deux fois la même sous-collection. `amines` vit désormais directement
  // sur le document du vœu (fusionné depuis zikr_wish_amines en Phase 0 de
  // la migration) : plus de second nœud à consulter pour les compter.
  let allWishes = [];
  if (isRealMember) {
    const wSnap = await gRef.collection("wishes").get();
    wSnap.forEach((w) => {
      const v = w.data() || {};
      allWishes.push({
        uid: w.id, email: v.email || "", text: v.text || "", at: v.at || 0,
        shared: v.shared === true, amines: v.amines || {},
      });
    });
  }

  if (isOwner) {
    status = "owner";
    const rSnap = await gRef.collection("requests").get();
    const requests = [];
    rSnap.forEach((r) => {
      const v = r.data() || {};
      requests.push({ uid: r.id, email: v.email || "", at: v.at || 0 });
    });
    owner.requests = requests;
    owner.pending = requests.length;

    // Vœux des participants, liste COMPLÈTE (y compris non partagés) :
    // visible UNIQUEMENT du créateur — jamais des autres membres entre eux,
    // voir l'en-tête du fichier.
    owner.wishes = [...allWishes]
      .map(({ amines, ...w }) => w) // amines : détail interne, pas utile à cette liste
      .sort((a, b) => (b.at || 0) - (a.at || 0));
  } else if (mine) {
    status = "member";
  } else {
    const rSnap = await gRef.collection("requests").doc(user.uid).get();
    status = rSnap.exists ? "pending" : "none";
  }

  // Battement de cœur (présence « en ligne ») — seulement pour un membre qui
  // sonde effectivement son propre groupe (pas de sens sinon).
  if (mine) await gRef.collection("members").doc(user.uid).update({ lastSeenAt: now });

  const full = remaining <= 0; // objectif entièrement récité

  // Mon propre vœu (jamais celui des autres) — pour préremplir le formulaire
  // si j'en avais déjà envoyé un, et savoir si je l'ai déjà partagé (case à
  // cocher « Partager au groupe », voir handleShareWish).
  let myWish = "";
  let myWishShared = false;
  if (mine && !isOwner) {
    const own = allWishes.find((w) => w.uid === user.uid);
    myWish = own ? own.text : "";
    myWishShared = own ? own.shared : false;
  }

  // Mur des vœux PARTAGÉS (opt-in, handleShareWish) : visible de TOUT membre
  // réel (créateur inclus) — contrairement à `owner.wishes` ci-dessus, qui
  // reste réservé au créateur et inclut aussi les vœux restés privés. Chaque
  // entrée porte son nombre de « Amine » et si MOI je l'ai déjà dit (jamais
  // l'identité des autres réactants — pas demandé, juste le compte).
  let sharedWishes = [];
  if (isRealMember) {
    sharedWishes = allWishes
      .filter((w) => w.shared)
      .map((w) => ({
        uid: w.uid,
        email: w.email,
        text: w.text,
        at: w.at,
        amineCount: amineCount(w.amines),
        aminedByMe: !!w.amines[user.uid],
      }))
      .sort((a, b) => (b.at || 0) - (a.at || 0));
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
    ownerName: g.ownerName || "",
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
    myDailyTotal: mine ? mine.dailyTotal : 0,
    myWarning: mine ? mine.avertissement : "",
    myWish,
    myWishShared,
    sharedWishes,
    members,
    ...owner,
  });
}

// ── Demander à rejoindre ────────────────────────────────────────
async function handleJoin(firestore, res, user, gid) {
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });
  const gRef = firestore.collection("zikr_groups").doc(gid);
  const gSnap = await gRef.get();
  const g = gSnap.exists ? gSnap.data() : null;
  if (!g) return res.status(404).json({ error: "Zikr collectif introuvable." });
  if (g.ownerUid === user.uid) return res.status(200).json({ ok: true, status: "owner" });

  const mSnap = await gRef.collection("members").doc(user.uid).get();
  if (mSnap.exists) return res.status(200).json({ ok: true, status: "member" });

  await gRef.collection("requests").doc(user.uid).set({ email: user.email, at: Date.now() });
  return res.status(200).json({ ok: true, status: "pending" });
}

// ── Créateur : demandes en attente ─────────────────────────────
async function handleRequests(firestore, res, user, gid) {
  const { ref } = await assertOwner(firestore, gid, user);
  const rSnap = await ref.collection("requests").get();
  const requests = [];
  rSnap.forEach((r) => {
    const v = r.data() || {};
    requests.push({ uid: r.id, email: v.email || "", at: v.at || 0 });
  });
  return res.status(200).json({ requests });
}

// ── Créateur : accepter une demande ─────────────────────────────
// UNE transaction Firestore multi-documents (demande + membre + compteur du
// groupe) — remplace 3 opérations RTDB séparées (dont une seule
// transactionnelle) et, au passage, corrige un double comptage possible de
// membersCount en cas de double-clic concurrent (la demande est relue DANS
// la même transaction que la création du membre).
async function handleApprove(firestore, res, user, gid, uid) {
  const { ref: gRef } = await assertOwner(firestore, gid, user);
  if (!uid) return res.status(400).json({ error: "Compte manquant." });

  const requestRef = gRef.collection("requests").doc(uid);
  const memberRef = gRef.collection("members").doc(uid);
  const now = Date.now();

  let found = false;
  await firestore.runTransaction(async (tx) => {
    const [reqSnap, memSnap] = await Promise.all([tx.get(requestRef), tx.get(memberRef)]);
    if (!reqSnap.exists) return; // demande introuvable (déjà traitée)
    found = true;
    tx.delete(requestRef);
    if (memSnap.exists) return; // déjà membre (course concurrente) : nettoie juste la demande
    const info = reqSnap.data() || {};
    tx.set(memberRef, { email: info.email || "", fait: 0, rythme: 0, joinedAt: now, updatedAt: now, lastSeenAt: now });
    tx.update(gRef, { membersCount: app().firestore.FieldValue.increment(1) });
  });
  if (!found) return res.status(404).json({ error: "Demande introuvable (déjà traitée ?)." });
  return res.status(200).json({ ok: true });
}

// ── Créateur : refuser une demande ─────────────────────────────
async function handleReject(firestore, res, user, gid, uid) {
  const { ref } = await assertOwner(firestore, gid, user);
  if (!uid) return res.status(400).json({ error: "Compte manquant." });
  await ref.collection("requests").doc(uid).delete();
  return res.status(200).json({ ok: true });
}

// ── Membre : avancement ABSOLU + rythme (temps réel, sans valider) ──
// UNE transaction Firestore multi-documents (groupe + membre) — remplace 3
// opérations RTDB indépendantes (mise à jour du membre, transaction sur le
// total du groupe, transaction sur le total du jour du membre) : la RTDB ne
// permet pas de transaction portant sur plusieurs chemins à la fois,
// Firestore si (voir docs/FIRESTORE_SCHEMA.md).
async function handleProgress(firestore, res, user, gid, rawFait, rawRythme) {
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });

  const gRef = firestore.collection("zikr_groups").doc(gid);
  const memRef = gRef.collection("members").doc(user.uid);
  const now = Date.now();
  const rythme = normalizeRythme(rawRythme);
  const today = utcDateKey(now);

  let result;
  await firestore.runTransaction(async (tx) => {
    const [gSnap, memSnap] = await Promise.all([tx.get(gRef), tx.get(memRef)]);
    if (!gSnap.exists) { const e = new Error("Zikr collectif introuvable."); e.statusCode = 404; throw e; }
    if (!memSnap.exists) { const e = new Error("Rejoignez d'abord ce zikr collectif."); e.statusCode = 403; throw e; }
    const g = gSnap.data();
    const mem = memSnap.data();

    const oldFait = Number(mem.fait) || 0;
    // Le compte était-il considéré hors ligne JUSTE AVANT cet appel (avant la
    // mise à jour de lastSeenAt ci-dessous) ? Sert de déclencheur pour
    // notifyReciting — une reprise d'activité, pas chaque grain (voir sa
    // propre doc plus bas).
    const wasOffline = now - (Number(mem.lastSeenAt) || 0) >= ONLINE_WINDOW_MS;
    // Avancement MONOTONE, SANS PLAFOND (objectif partagé, pas de part
    // individuelle) : on ne retient jamais une valeur inférieure à celle déjà
    // enregistrée. Le client envoie un absolu déduit de son compteur local
    // (localStorage) ; sans ce garde-fou, un appareil neuf (stockage vide), une
    // navigation privée ou le bouton « réinitialiser » renverrait 0 et ferait
    // RECULER le total commun — au détriment de tout le groupe.
    const newFait = Math.max(oldFait, normalizeFait(rawFait));
    const delta = newFait - oldFait;

    const memUpd = { fait: newFait, rythme, updatedAt: now, lastSeenAt: now };
    // Total CUMULATIF (jamais décrémenté, même quand un membre quitte plus
    // tard — voir l'en-tête du fichier).
    let total = Number(g.total) || 0;
    if (delta !== 0) {
      total = Math.max(0, total + delta);
      tx.update(gRef, { total });
    }
    if (delta > 0) {
      // Total DU JOUR (fenêtre UTC commune à tout le groupe, lib/zikrLogic.js
      // utcDateKey).
      const daily = mem.daily;
      memUpd.daily = (!daily || daily.date !== today)
        ? { date: today, total: delta }
        : { date: today, total: (Number(daily.total) || 0) + delta };
    }
    tx.update(memRef, memUpd);

    result = { newFait, total, delta, wasOffline };
  });

  if (result.delta > 0 && result.wasOffline) {
    // Reprise d'activité — best-effort (jamais d'erreur remontée au client
    // pour un push manqué), mais ATTENDU avant de répondre : une promesse
    // simplement lancée sans await risquerait d'être interrompue par le
    // runtime serverless dès la réponse envoyée (pas de worker persistant
    // entre deux requêtes ici). Sans incidence notable sur la latence de
    // "progress" : ne se déclenche qu'à la reprise d'activité, jamais à
    // chaque grain (voir notifyReciting).
    await notifyReciting(firestore, gid, user.uid, user.email, result.newFait).catch(() => {});
  }

  return res.status(200).json({ ok: true, fait: result.newFait, total: result.total });
}

// ── Créateur : avertissement privé à un clic ────────────────────
async function handleWarn(firestore, res, user, gid, uid) {
  const { ref } = await assertOwner(firestore, gid, user);
  if (!uid) return res.status(400).json({ error: "Compte manquant." });
  if (uid === user.uid) return res.status(400).json({ error: "Vous ne pouvez pas vous avertir vous-même." });
  const memRef = ref.collection("members").doc(uid);
  const memSnap = await memRef.get();
  if (!memSnap.exists) return res.status(404).json({ error: "Ce compte n'est plus dans le groupe." });
  await memRef.update({ avertissement: MESSAGE_AVERTISSEMENT });
  return res.status(200).json({ ok: true });
}

// ── Créateur : avertit EN UNE FOIS tous les comptes inactifs ────
// Contrairement à "warn" (un compte choisi à la main), cible directement
// TOUS les membres n'ayant récité AUCUN grain (fait===0) — utile quand un
// groupe a accepté plusieurs demandes qui n'ont ensuite jamais participé
// (voir l'en-tête du fichier). Avertissement privé (relu à la prochaine
// ouverture de l'app) + notification push best-effort (si le compte est
// abonné, cf. pages/api/push-subscribe.js) : sans le push, un compte qui
// n'ouvre déjà plus l'app ne verrait jamais l'avertissement.
async function handleNotifyInactive(firestore, res, user, gid) {
  const { ref } = await assertOwner(firestore, gid, user);
  const membersSnap = await ref.collection("members").get();
  const targets = [];
  membersSnap.forEach((m) => {
    if (m.id === user.uid) return; // jamais le créateur lui-même
    const v = m.data() || {};
    if ((Number(v.fait) || 0) === 0) targets.push(m.id);
  });
  if (targets.length === 0) return res.status(200).json({ ok: true, notified: 0 });

  await Promise.all(
    targets.map((uid) => ref.collection("members").doc(uid).update({ avertissement: MESSAGE_INACTIVITE }))
  );
  // Best-effort : l'avertissement en application ci-dessus reste enregistré
  // même si VAPID est mal configuré ou qu'un envoi échoue.
  await pushInactivityWarning(firestore, targets, gid).catch(() => {});

  return res.status(200).json({ ok: true, notified: targets.length });
}

// Configure VAPID (mêmes clés que pages/api/cron/reminders.js et
// pages/api/cron/planet-push.js) si disponible, sinon renvoie false — les
// deux appelants (pushInactivityWarning, notifyReciting) traitent alors
// l'envoi push comme silencieusement indisponible (l'avertissement/l'action
// elle-même reste de toute façon déjà enregistrée ailleurs).
function configureVapid() {
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;
  if (!vapidPublic || !vapidPrivate || !vapidSubject) return false;
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  return true;
}

// Envoie `payload` à TOUS les abonnements push de `uid` (best-effort, jamais
// bloquant) — nettoie les abonnements expirés (404/410), même politique que
// pages/api/cron/reminders.js/planet-push.js (dupliquée ici plutôt que
// factorisée avec eux : ce fichier est déclenché par un UTILISATEUR déjà
// authentifié, ces deux-là par un secret de planificateur — server/cronAuth
// n'a pas de sens ici). VAPID doit déjà avoir été configuré par l'appelant
// (configureVapid()). push_subscriptions est sur Firestore depuis la Phase 6
// de la migration (voir docs/FIRESTORE_SCHEMA.md) — même `firestore` que
// partout ailleurs dans ce fichier.
async function sendPushToUid(firestore, uid, payload, logTag) {
  const subsSnap = await firestore.collection("push_subscriptions").where("uid", "==", uid).get();
  if (subsSnap.empty) return;
  const tasks = [];
  subsSnap.forEach((doc) => {
    const sub = doc.data() || {};
    if (!sub.endpoint || !sub.keys) return;
    tasks.push(
      webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload).catch(async (e) => {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) {
          await doc.ref.delete();
        } else {
          await reportError(logTag, e, { uid });
        }
      })
    );
  });
  await Promise.all(tasks);
}

// Notification push déclenchée ici à la demande du créateur — voir
// configureVapid/sendPushToUid ci-dessus.
async function pushInactivityWarning(firestore, uids, gid) {
  if (!configureVapid()) return; // pas configuré : l'avertissement en app suffit
  const payload = JSON.stringify({
    title: '⏳ Zikr collectif',
    body: MESSAGE_INACTIVITE,
    url: '/s?k=zikr&i=' + gid,
    tag: 'zikr-inactivite-' + gid,
  });
  await Promise.all(uids.map((uid) => sendPushToUid(firestore, uid, payload, "zikr:notifyInactive")));
}

// ── Prévient les AUTRES membres qu'un compte REPREND son activité ──
// Appelée par handleProgress uniquement à la reprise (le compte était hors
// ligne juste avant cet appel, cf. ONLINE_WINDOW_MS) — jamais à chaque
// grain, le débit serait ingérable sur une récitation continue. Un second
// filtre, CETTE FOIS PAR DESTINATAIRE (lastRecitingPushAt, persistant —
// l'app tournant en serverless, un compteur en mémoire comme lib/rateLimit.js
// ne survivrait pas aux cold starts, cf. pages/api/cron/reminders.js pour le
// même choix de state persisté), plafonne encore l'envoi à au plus 1x/heure
// PAR MEMBRE (RECITING_PUSH_WINDOW_MS, lib/zikrLogic.js) — même si plusieurs
// comptes reprennent leur récitation entre-temps, personne n'est inondé.
async function notifyReciting(firestore, gid, senderUid, senderEmail, fait) {
  if (!configureVapid()) return;
  const gRef = firestore.collection("zikr_groups").doc(gid);
  const [gSnap, membersSnap] = await Promise.all([
    gRef.get(),
    gRef.collection("members").get(),
  ]);
  const groupName = (gSnap.exists && gSnap.data().name) || "Zikr collectif";
  const now = Date.now();
  const payload = JSON.stringify({
    title: '🟢 ' + groupName,
    body: `${senderEmail || "Un membre"} est en train de réciter — ${Number(fait).toLocaleString("fr-FR")} grains.`,
    url: '/s?k=zikr&i=' + gid,
    tag: 'zikr-reciting-' + gid,
  });

  const tasks = [];
  membersSnap.forEach((m) => {
    const uid = m.id;
    if (uid === senderUid) return;
    const v = m.data() || {};
    if (now - (Number(v.lastRecitingPushAt) || 0) < RECITING_PUSH_WINDOW_MS) return; // déjà notifié récemment
    tasks.push(
      m.ref.update({ lastRecitingPushAt: now })
        .then(() => sendPushToUid(firestore, uid, payload, "zikr:notifyReciting"))
    );
  });
  await Promise.all(tasks);
}

// ── Membre : efface l'avertissement une fois lu (soi-même) ─────
async function handleDismissWarning(firestore, res, user, gid) {
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });
  await firestore.collection("zikr_groups").doc(gid).collection("members").doc(user.uid)
    .update({ avertissement: app().firestore.FieldValue.delete() });
  return res.status(200).json({ ok: true });
}

// ── Créateur : exclut un participant (jamais lui-même) ──────────
async function handleExclude(firestore, res, user, gid, uid) {
  const { ref, data: g } = await assertOwner(firestore, gid, user);
  if (!uid) return res.status(400).json({ error: "Compte manquant." });
  if (uid === g.ownerUid) {
    return res.status(400).json({ error: "Le créateur ne peut pas s'auto-exclure — quittez ou supprimez le zikr collectif." });
  }
  await removeParticipant(firestore, ref, g, uid);
  return res.status(200).json({ ok: true });
}

// ── Membre : quitter (créateur inclus, si un successeur existe) ──
async function handleLeave(firestore, res, user, gid) {
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });
  const gRef = firestore.collection("zikr_groups").doc(gid);
  const gSnap = await gRef.get();
  const g = gSnap.exists ? gSnap.data() : null;
  if (!g) return res.status(404).json({ error: "Zikr collectif introuvable." });

  if (g.ownerUid === user.uid && (Number(g.membersCount) || 0) <= 1) {
    return res.status(400).json({ error: "Vous êtes seul dans ce zikr collectif : supprimez-le plutôt que de le quitter." });
  }
  await removeParticipant(firestore, gRef, g, user.uid);
  return res.status(200).json({ ok: true });
}

// Retire un participant du groupe (quitte de son propre chef, ou exclu par
// le créateur) — ce qu'il a déjà récité reste définitivement acquis à
// `total` (jamais touché ici, voir l'en-tête du fichier). Si le PARTANT est
// le créateur et qu'il reste d'autres membres, l'un d'eux (le plus ancien
// arrivé) devient automatiquement le nouveau créateur — un groupe existant
// n'est jamais laissé sans titulaire. UNE transaction Firestore (membre +
// compteur + éventuelle réattribution du groupe), remplace 2 transactions
// RTDB séparées + une mise à jour non transactionnelle.
async function removeParticipant(firestore, gRef, g, targetUid) {
  const memberRef = gRef.collection("members").doc(targetUid);
  const requestRef = gRef.collection("requests").doc(targetUid);
  let existed = false;

  const isOwnerLeaving = targetUid === g.ownerUid;
  await firestore.runTransaction(async (tx) => {
    // TOUTES les lectures d'abord (contrainte Firestore : une transaction
    // n'accepte plus aucune lecture après sa première écriture) — y compris
    // la liste des membres restants, dont on n'aura peut-être même pas
    // besoin, plutôt que de la lire conditionnellement après le tx.delete()
    // ci-dessous.
    const [memSnap, gSnap, remainingSnap] = await Promise.all([
      tx.get(memberRef),
      tx.get(gRef),
      isOwnerLeaving ? tx.get(gRef.collection("members")) : Promise.resolve(null),
    ]);
    if (!memSnap.exists) { existed = false; return; }
    existed = true;

    tx.delete(memberRef);
    const curCount = Number((gSnap.data() || {}).membersCount) || 1;
    const upd = { membersCount: Math.max(0, curCount - 1) };

    if (isOwnerLeaving && remainingSnap) {
      const entries = [];
      remainingSnap.forEach((m) => {
        if (m.id === targetUid) return;
        entries.push({ uid: m.id, email: (m.data() || {}).email || "", joinedAt: Number((m.data() || {}).joinedAt) || 0 });
      });
      entries.sort((a, b) => a.joinedAt - b.joinedAt);
      if (entries.length > 0) {
        upd.ownerUid = entries[0].uid;
        upd.ownerEmail = entries[0].email;
      }
    }
    tx.update(gRef, upd);
  });
  if (!existed) return; // déjà parti — idempotent

  await requestRef.delete();
}

// ── Supprimer le groupe : le créateur (seulement s'il est seul — les
// autres participants doivent d'abord quitter) OU L'ADMINISTRATEUR
// (n'importe quel zikr collectif, quel que soit le nombre de participants —
// pouvoir de modération, voir l'en-tête du fichier) ───────────────
async function handleDelete(firestore, res, user, gid) {
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });
  const gRef = firestore.collection("zikr_groups").doc(gid);
  const gSnap = await gRef.get();
  const g = gSnap.exists ? gSnap.data() : null;
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

  await deleteGroupDeep(gRef);
  return res.status(200).json({ ok: true });
}

// Supprime le groupe ET toutes ses sous-collections — Firestore ne supprime
// JAMAIS les sous-collections d'un document en cascade (contrairement à
// db.ref(...).remove() sur la RTDB, qui effaçait tout l'arbre d'un coup) :
// il faut donc les vider explicitement, par lots (une discussion active peut
// dépasser la limite de 500 écritures d'un seul batch).
async function deleteSubcollection(colRef, batchSize = 400) {
  for (;;) {
    const snap = await colRef.limit(batchSize).get();
    if (snap.empty) return;
    const batch = colRef.firestore.batch();
    snap.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    if (snap.size < batchSize) return;
  }
}
async function deleteGroupDeep(gRef) {
  for (const sub of ["members", "requests", "wishes", "messages"]) {
    await deleteSubcollection(gRef.collection(sub));
  }
  await gRef.delete();
}

// ── Administrateur : approuve un zikr collectif pour la liste publique ──
async function handleApproveZikr(firestore, res, user, gid) {
  if (!(await isAdmin(user))) {
    const e = new Error("Action réservée à l'administrateur.");
    e.statusCode = 403;
    throw e;
  }
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });
  const ref = firestore.collection("zikr_groups").doc(gid);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "Zikr collectif introuvable." });
  await ref.update({ approved: true });
  return res.status(200).json({ ok: true });
}

// ── Créateur : ouvre la possibilité de faire un vœu ─────────────
// Seulement une fois l'objectif ENTIÈREMENT récité par le groupe — un vœu
// après un dhikr collectif accompli, pas avant (cohérent avec la pratique :
// on formule le vœu une fois l'engagement commun tenu).
async function handleOpenWishes(firestore, res, user, gid) {
  const { ref, data: g } = await assertOwner(firestore, gid, user);
  const target = Number(g.target) || 0;
  const total = Number(g.total) || 0;
  if (target <= 0 || total < target) {
    return res.status(400).json({ error: "L'objectif du zikr collectif doit être entièrement atteint avant d'ouvrir les vœux." });
  }
  await ref.update({ wishesOpen: true });
  return res.status(200).json({ ok: true });
}

// ── Créateur : referme (les vœux déjà reçus restent visibles) ──
async function handleCloseWishes(firestore, res, user, gid) {
  const { ref } = await assertOwner(firestore, gid, user);
  await ref.update({ wishesOpen: false });
  return res.status(200).json({ ok: true });
}

// ── Membre : enregistre (ou met à jour) SON PROPRE vœu ──────────
// Reste PRIVÉ par défaut (créateur + auteur seulement, voir handleGet) — le
// partage au groupe (`shared`) est une démarche SÉPARÉE et explicite
// (handleShareWish). `set(...,{merge:true})`, pas `set()` seul : un
// remplacement complet effacerait un `shared:true`/`amines` déjà posés à
// chaque simple correction du texte.
async function handleSubmitWish(firestore, res, user, gid, rawText) {
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });
  const gRef = firestore.collection("zikr_groups").doc(gid);
  const gSnap = await gRef.get();
  const g = gSnap.exists ? gSnap.data() : null;
  if (!g) return res.status(404).json({ error: "Zikr collectif introuvable." });
  if (g.wishesOpen !== true) {
    return res.status(403).json({ error: "Les vœux ne sont pas (encore) ouverts pour ce zikr collectif." });
  }

  const memSnap = await gRef.collection("members").doc(user.uid).get();
  if (!memSnap.exists) return res.status(403).json({ error: "Rejoignez d'abord ce zikr collectif." });

  const text = cleanText(rawText, WISH_MAX);
  if (!text) return res.status(400).json({ error: "Écrivez votre vœu avant d'envoyer." });

  await gRef.collection("wishes").doc(user.uid).set({ email: user.email, text, at: Date.now() }, { merge: true });
  return res.status(200).json({ ok: true, text });
}

// ── Membre : partage (ou retire du partage) SON PROPRE vœu ──────
// Opt-in demandé explicitement : un vœu reste privé (créateur + auteur
// seulement) tant qu'il n'est pas partagé — seul son propre auteur peut
// décider de l'exposer au mur commun (sharedWishes, voir handleGet), où les
// autres membres peuvent dire Amine (handleAmineWish).
async function handleShareWish(firestore, res, user, gid, rawShared) {
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });
  const gRef = firestore.collection("zikr_groups").doc(gid);
  const memSnap = await gRef.collection("members").doc(user.uid).get();
  if (!memSnap.exists) return res.status(403).json({ error: "Rejoignez d'abord ce zikr collectif." });

  const wishRef = gRef.collection("wishes").doc(user.uid);
  const wishSnap = await wishRef.get();
  if (!wishSnap.exists) return res.status(400).json({ error: "Envoyez d'abord votre vœu avant de le partager." });

  const shared = !!rawShared;
  await wishRef.update({ shared });
  return res.status(200).json({ ok: true, shared });
}

// ── Membre : dit « Amine » (ou le retire, toggle) sur un vœu partagé ──
// Refusé sur un vœu resté privé, même par groupId+wishUid valides — le
// partage (`shared`) est la seule chose qui rend un vœu visible/réactible
// par quiconque d'autre que son auteur et le créateur. Lecture + bascule +
// recomptage en UNE transaction (au lieu de 3 opérations RTDB séquentielles)
// — deux « Amine »/retraits concurrents sur le même vœu ne se marchent plus
// dessus.
async function handleAmineWish(firestore, res, user, gid, wishUid) {
  if (!gid || !wishUid) return res.status(400).json({ error: "Vœu introuvable." });
  const gRef = firestore.collection("zikr_groups").doc(gid);
  const memSnap = await gRef.collection("members").doc(user.uid).get();
  if (!memSnap.exists) return res.status(403).json({ error: "Rejoignez d'abord ce zikr collectif." });

  const wishRef = gRef.collection("wishes").doc(wishUid);
  let amined, count;
  await firestore.runTransaction(async (tx) => {
    const wishSnap = await tx.get(wishRef);
    const wish = wishSnap.exists ? wishSnap.data() : null;
    if (!wish || wish.shared !== true) {
      const e = new Error("Ce vœu n'est pas partagé.");
      e.statusCode = 404;
      throw e;
    }
    const amines = { ...(wish.amines || {}) };
    const already = !!amines[user.uid];
    if (already) delete amines[user.uid]; else amines[user.uid] = true;
    tx.update(wishRef, { amines });
    amined = !already;
    count = Object.keys(amines).length;
  });
  return res.status(200).json({ ok: true, amined, amineCount: count });
}

// ── Membre : discussion de groupe façon WhatsApp ─────────────────
// Réservée aux membres (créateur inclus) : jamais accessible à un visiteur
// qui n'a pas encore rejoint (même par lien direct — contrairement à
// get/join, volontairement plus permissifs). Texte ET/OU pièce jointe
// (image/audio, voir CHAT_MEDIA_TYPES) — demandé explicitement (« envoyer
// des audios, images... »). Le FICHIER lui-même n'est jamais reçu ici : il a
// déjà été envoyé DIRECTEMENT à Cloudinary par le client (voir
// pages/api/cloudinary-sign.js, folder="zikr_chat") ; seule l'URL déjà
// hébergée transite par cet appel, comme pour les images produit (marché).
async function handleSendMessage(firestore, res, user, gid, rawText, rawMediaType, rawMediaUrl, rawMediaDuration) {
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });
  const gRef = firestore.collection("zikr_groups").doc(gid);
  const memSnap = await gRef.collection("members").doc(user.uid).get();
  if (!memSnap.exists) return res.status(403).json({ error: "Rejoignez d'abord ce zikr collectif." });

  const text = cleanText(rawText, CHAT_MESSAGE_MAX);
  const mediaType = CHAT_MEDIA_TYPES.includes(rawMediaType) ? rawMediaType : null;
  // L'URL vient de NOTRE propre compte Cloudinary (res.cloudinary.com) —
  // jamais une URL arbitraire fournie par le client, qui permettrait
  // d'afficher/faire jouer n'importe quelle ressource externe dans la
  // discussion (usurpation, contenu non modéré) sous couvert d'un "message".
  const mediaUrl = mediaType && /^https:\/\/res\.cloudinary\.com\//.test(String(rawMediaUrl || "")) ? String(rawMediaUrl) : null;
  if (!isValidChatMessage(text, mediaType, mediaUrl)) {
    return res.status(400).json({ error: "Écrivez un message ou joignez une image/un audio avant d'envoyer." });
  }

  const msg = { uid: user.uid, email: user.email, text, at: Date.now() };
  // Nom/photo Google (déjà vérifiés par verifyUser — jamais fournis par le
  // client) : demandé explicitement (« nom/pseudo + avatar » plutôt que
  // l'email brut). Absents pour un compte email/mot de passe — le client
  // retombe alors sur la partie locale de l'email (voir displayNameOf).
  if (user.name) msg.name = user.name;
  if (user.picture) msg.picture = user.picture;
  if (mediaUrl) {
    msg.mediaType = mediaType;
    msg.mediaUrl = mediaUrl;
    // Purement indicatif (affichage du minuteur du vocal côté client) —
    // jamais vérifié ici, voir CHAT_AUDIO_MAX_S (lib/zikrLogic.js).
    const dur = Math.floor(Number(rawMediaDuration));
    if (mediaType === "audio" && Number.isFinite(dur) && dur > 0) msg.mediaDuration = dur;
  }

  const ref = await gRef.collection("messages").add(msg);
  // Best-effort : le message reste enregistré ci-dessus même si VAPID est
  // mal configuré ou qu'un envoi push échoue — jamais bloquant pour l'auteur.
  await notifyNewMessage(firestore, gid, user.uid, user.email, text, !!mediaUrl).catch(() => {});
  return res.status(200).json({ ok: true, id: ref.id });
}

// Messages récents (200 derniers — une discussion de groupe reste modeste,
// pas besoin de pagination complète). Sondée régulièrement par le client
// tant que le panneau discussion est ouvert (app/zikr/page.tsx). `orderBy`
// DESC + `limit` puis `reverse()` : idiome standard pour obtenir « les N
// derniers, en ordre chronologique croissant » (équivalent du limitToLast
// RTDB d'origine).
async function handleMessages(firestore, res, user, gid) {
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });
  const gRef = firestore.collection("zikr_groups").doc(gid);
  const memSnap = await gRef.collection("members").doc(user.uid).get();
  if (!memSnap.exists) return res.status(403).json({ error: "Rejoignez d'abord ce zikr collectif." });

  const snap = await gRef.collection("messages").orderBy("at", "desc").limit(200).get();
  const messages = [];
  snap.forEach((m) => {
    const v = m.data() || {};
    const msg = { id: m.id, uid: v.uid || "", email: v.email || "", text: v.text || "", at: v.at || 0 };
    if (v.name) msg.name = v.name;
    if (v.picture) msg.picture = v.picture;
    if (CHAT_MEDIA_TYPES.includes(v.mediaType) && v.mediaUrl) {
      msg.mediaType = v.mediaType;
      msg.mediaUrl = v.mediaUrl;
      if (v.mediaDuration) msg.mediaDuration = Number(v.mediaDuration) || 0;
    }
    messages.push(msg);
  });
  messages.reverse();
  return res.status(200).json({ messages });
}

// ── Prévient les AUTRES membres qu'un nouveau message a été posté ──
// Demandé explicitement (« bip sonore + notification aux membres ») : le bip
// lui-même est joué CÔTÉ CLIENT (app/zikr/page.tsx, sur le sondage qui
// détecte un nouveau message pas de soi) — cette notification push couvre le
// cas où l'app n'est pas au premier plan (même infra que notifyReciting/
// pushInactivityWarning ci-dessus). Aucun plafond par destinataire (contraste
// avec notifyReciting) : un message reste un événement ponctuel et voulu par
// son auteur, pas un signal répété automatiquement comme la reprise d'activité.
async function notifyNewMessage(firestore, gid, senderUid, senderEmail, text, hasMedia) {
  if (!configureVapid()) return;
  const gRef = firestore.collection("zikr_groups").doc(gid);
  const [gSnap, membersSnap] = await Promise.all([
    gRef.get(),
    gRef.collection("members").get(),
  ]);
  const groupName = (gSnap.exists && gSnap.data().name) || "Zikr collectif";
  const body = text
    ? `${senderEmail || "Un membre"} : ${text}`
    : `${senderEmail || "Un membre"} a envoyé ${hasMedia ? "une pièce jointe" : "un message"}.`;
  const payload = JSON.stringify({
    title: '💬 ' + groupName,
    body,
    url: '/s?k=zikr&i=' + gid,
    tag: 'zikr-chat-' + gid,
  });

  const targets = [];
  membersSnap.forEach((m) => { if (m.id !== senderUid) targets.push(m.id); });
  await Promise.all(targets.map((uid) => sendPushToUid(firestore, uid, payload, "zikr:notifyNewMessage")));
}

// Vérifie que l'appelant est bien le créateur du groupe, sinon lève une erreur
// HTTP (403/404). Renvoie { ref, data } : la référence sert aux appelants qui
// doivent encore accéder à une sous-collection ou mettre à jour le document.
async function assertOwner(firestore, gid, user) {
  if (!gid) { const e = new Error("Groupe manquant."); e.statusCode = 400; throw e; }
  const ref = firestore.collection("zikr_groups").doc(gid);
  const snap = await ref.get();
  if (!snap.exists) { const e = new Error("Zikr collectif introuvable."); e.statusCode = 404; throw e; }
  const data = snap.data();
  if (data.ownerUid !== user.uid) {
    const e = new Error("Action réservée au créateur du zikr collectif.");
    e.statusCode = 403;
    throw e;
  }
  return { ref, data };
}
