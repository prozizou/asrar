// api/zikr.js (Vercel) — ZIKR COLLECTIF : objectif de dhikr commun, RÉPARTI EN
// PARTS entre plusieurs comptes (même logique que le ZIP « mon-chapelet » :
// part = objectif / parts, la dernière absorbant le reste). Chaque participant
// n'égrène QUE sa part ; l'avancement remonte au groupe en temps réel (pas de
// validation manuelle — cf. handleProgress, avancement absolu enregistré à
// chaque frappe, débattu côté client).
//
// Adhésion : n'importe quel compte peut DEMANDER à rejoindre ; seul le CRÉATEUR
// approuve, ce qui attribue une part (rang) libre — via transaction, pour que
// deux approbations simultanées ne donnent pas la même part à deux personnes.
//
// Tout passe par HTTPS (Admin SDK), comme le reste de l'app — jamais de SDK
// client Firebase RTDB direct (cf. l'historique /api/check-access, /api/social :
// ce canal WebSocket peut rester bloqué en silence sur certains réseaux ;
// le « temps réel » est donc obtenu par un sondage court côté client, pas par
// un abonnement RTDB direct).
//
// Body (JSON) : { idToken, action, ... }
//   action="list"     → liste publique des zikr collectifs (+ mon statut)
//   action="create"   → { name, phrase, target, parts } : crée, créateur = part n°0
//   action="get"      → { groupId } : détail (progression, parts, ma part, membres)
//   action="join"     → { groupId } : demande d'adhésion
//   action="requests" → { groupId } : créateur only — demandes en attente
//   action="approve"  → { groupId, uid } : créateur only — attribue une part libre
//   action="reject"   → { groupId, uid } : créateur only — refuse une demande
//   action="progress" → { groupId, fait } : membre only — avancement ABSOLU sur sa part
//   action="leave"    → { groupId } : membre (non-créateur) libère sa part
//   action="delete"   → { groupId } : créateur only — supprime le groupe
//
// Nœuds (Admin SDK, écriture/lecture client interdites par les règles RTDB) :
//   zikr_groups/{gid}        = { name, phrase, target, parts, total, ownerUid,
//                                 ownerEmail, createdAt, membersCount }
//   zikr_members/{gid}/{uid} = { email, rang, fait, joinedAt, updatedAt }
//   zikr_requests/{gid}/{uid}= { email, at }

const { verifyUser } = require("../../server/access");
const { app } = require("../../server/grant");
const { setCors, parseBody } = require("../../server/http");
const { rateLimit } = require("../../lib/rateLimit");
const { reportError } = require("../../server/log");
const { normalizeGroupInput, partSize, clampFait } = require("../../lib/zikrLogic");

// Clé Firebase valide (ids de groupe = push keys ; uid = uid Firebase).
function safeKey(v) { return (v == null ? "" : String(v)).replace(/[.#$/[\]]/g, "").slice(0, 64); }

// Limites : "list"/"get"/"progress" sont fréquents (sondage temps réel +
// remontée d'avancement) mais légers → larges ; écritures rares → serrées.
function limitFor(action) {
  if (action === "list" || action === "get" || action === "progress") return { max: 120, windowMs: 60_000 };
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
      case "list":     return await handleList(db, res, user);
      case "create":   return await handleCreate(db, res, user, body);
      case "get":      return await handleGet(db, res, user, gid);
      case "join":     return await handleJoin(db, res, user, gid);
      case "requests": return await handleRequests(db, res, user, gid);
      case "approve":  return await handleApprove(db, res, user, gid, safeKey(body.uid));
      case "reject":   return await handleReject(db, res, user, gid, safeKey(body.uid));
      case "progress": return await handleProgress(db, res, user, gid, body.fait);
      case "leave":    return await handleLeave(db, res, user, gid);
      case "delete":   return await handleDelete(db, res, user, gid);
      default:         return res.status(400).json({ error: "Action inconnue." });
    }
  } catch (e) {
    if (!e.statusCode) await reportError("zikr", e, { action, uid: user.uid });
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};

// ── Liste publique + mon statut sur chaque groupe ──────────────
async function handleList(db, res, user) {
  const snap = await db.ref("zikr_groups").once("value");
  const groups = [];
  snap.forEach((g) => {
    const v = g.val() || {};
    groups.push({
      id: g.key,
      name: v.name || "",
      phrase: v.phrase || "",
      target: Number(v.target) || 0,
      parts: Number(v.parts) || 0,
      total: Number(v.total) || 0,
      membersCount: Number(v.membersCount) || 0,
      ownerEmail: v.ownerEmail || "",
      isOwner: v.ownerUid === user.uid,
      createdAt: v.createdAt || 0,
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

  groups.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return res.status(200).json({ groups });
}

// ── Créer un zikr collectif (le créateur prend la part n°0) ────
async function handleCreate(db, res, user, body) {
  const norm = normalizeGroupInput(body);
  if (norm.error) {
    const msg =
      norm.error === "name" ? "Donnez un titre au zikr collectif."
      : norm.error === "phrase" ? "Indiquez la formule à réciter."
      : norm.error === "target" ? "Objectif invalide (entier positif requis)."
      : "Nombre de participants invalide (au moins 1, pas plus que l'objectif).";
    return res.status(400).json({ error: msg });
  }

  const ref = db.ref("zikr_groups").push();
  const gid = ref.key;
  const now = Date.now();
  await ref.set({
    name: norm.name,
    phrase: norm.phrase,
    target: norm.target,
    parts: norm.parts,
    total: 0,
    ownerUid: user.uid,
    ownerEmail: user.email,
    createdAt: now,
    membersCount: 1, // le créateur est le premier participant (part n°0)
  });
  await db.ref("zikr_members/" + gid + "/" + user.uid).set({
    email: user.email, rang: 0, fait: 0, joinedAt: now, updatedAt: now,
  });

  return res.status(200).json({ ok: true, id: gid });
}

// ── Détail d'un groupe (progression, parts, ma part, membres) ──
async function handleGet(db, res, user, gid) {
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });
  const gSnap = await db.ref("zikr_groups/" + gid).once("value");
  const g = gSnap.val();
  if (!g) return res.status(404).json({ error: "Zikr collectif introuvable." });

  const isOwner = g.ownerUid === user.uid;
  const parts = Number(g.parts) || 0;
  const target = Number(g.target) || 0;

  const membersSnap = await db.ref("zikr_members/" + gid).once("value");
  const members = [];
  let mine = null;
  membersSnap.forEach((m) => {
    const v = m.val() || {};
    const rang = Number(v.rang) || 0;
    const entry = {
      uid: m.key,
      email: v.email || "",
      rang,
      fait: Number(v.fait) || 0,
      part: partSize(target, parts, rang),
    };
    if (m.key === user.uid) mine = entry;
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
  } else if (mine) {
    status = "member";
  } else {
    const rSnap = await db.ref("zikr_requests/" + gid + "/" + user.uid).once("value");
    status = rSnap.exists() ? "pending" : "none";
  }

  const full = members.length >= parts; // toutes les parts sont prises

  return res.status(200).json({
    id: gid,
    name: g.name || "",
    phrase: g.phrase || "",
    target,
    parts,
    total: Number(g.total) || 0,
    ownerEmail: g.ownerEmail || "",
    createdAt: g.createdAt || 0,
    membersCount: Number(g.membersCount) || 0,
    full,
    status,
    myRang: mine ? mine.rang : null,
    myPart: mine ? mine.part : 0,
    myFait: mine ? mine.fait : 0,
    members,
    ...owner,
  });
}

// ── Demander à rejoindre ───────────────────────────────────────
async function handleJoin(db, res, user, gid) {
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });
  const gSnap = await db.ref("zikr_groups/" + gid).once("value");
  const g = gSnap.val();
  if (!g) return res.status(404).json({ error: "Zikr collectif introuvable." });
  if (g.ownerUid === user.uid) return res.status(200).json({ ok: true, status: "owner" });

  const mSnap = await db.ref("zikr_members/" + gid + "/" + user.uid).once("value");
  if (mSnap.exists()) return res.status(200).json({ ok: true, status: "member" });

  // Groupe complet : inutile de déposer une demande qu'on ne pourra approuver.
  const membersSnap = await db.ref("zikr_members/" + gid).once("value");
  if (membersSnap.numChildren() >= (Number(g.parts) || 0)) {
    return res.status(409).json({ error: "Ce zikr collectif est complet (toutes les parts sont prises)." });
  }

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

// ── Créateur : accepter une demande (attribue une part libre) ──
async function handleApprove(db, res, user, gid, uid) {
  const g = await assertOwner(db, gid, user);
  if (!uid) return res.status(400).json({ error: "Compte manquant." });
  const parts = Number(g.parts) || 0;

  const reqSnap = await db.ref("zikr_requests/" + gid + "/" + uid).once("value");
  if (!reqSnap.exists()) return res.status(404).json({ error: "Demande introuvable (déjà traitée ?)." });
  const info = reqSnap.val() || {};

  // Déjà membre ? (double-clic) — on nettoie la demande sans re-attribuer.
  const memSnap = await db.ref("zikr_members/" + gid + "/" + uid).once("value");
  if (memSnap.exists()) {
    await db.ref("zikr_requests/" + gid + "/" + uid).remove();
    return res.status(200).json({ ok: true, rang: Number(memSnap.val().rang) || 0 });
  }

  // Attribution du rang dans une transaction sur le nœud des membres : deux
  // approbations simultanées ne peuvent pas donner la même part à deux comptes.
  const now = Date.now();
  const tx = await db.ref("zikr_members/" + gid).transaction((members) => {
    members = members || {};
    if (members[uid]) return members; // course : déjà attribué entre-temps
    const taken = new Set(Object.values(members).map((m) => Number(m.rang) || 0));
    let rang = -1;
    for (let c = 0; c < parts; c++) { if (!taken.has(c)) { rang = c; break; } }
    if (rang === -1) return; // complet → abandon (transaction non validée)
    members[uid] = { email: info.email || "", rang, fait: 0, joinedAt: now, updatedAt: now };
    return members;
  });

  const membersAfter = (tx.committed && tx.snapshot && tx.snapshot.val()) || null;
  const mine = membersAfter && membersAfter[uid];
  if (!mine) {
    return res.status(409).json({ error: "Toutes les parts sont déjà prises (groupe complet)." });
  }

  await db.ref("zikr_requests/" + gid + "/" + uid).remove();
  await db.ref("zikr_groups/" + gid + "/membersCount").transaction((n) => (n || 0) + 1);
  return res.status(200).json({ ok: true, rang: Number(mine.rang) || 0 });
}

// ── Créateur : refuser une demande ─────────────────────────────
async function handleReject(db, res, user, gid, uid) {
  await assertOwner(db, gid, user);
  if (!uid) return res.status(400).json({ error: "Compte manquant." });
  await db.ref("zikr_requests/" + gid + "/" + uid).remove();
  return res.status(200).json({ ok: true });
}

// ── Membre : avancement ABSOLU sur sa part (temps réel, sans valider) ──
async function handleProgress(db, res, user, gid, rawFait) {
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });

  const gSnap = await db.ref("zikr_groups/" + gid).once("value");
  const g = gSnap.val();
  if (!g) return res.status(404).json({ error: "Zikr collectif introuvable." });

  const memRef = db.ref("zikr_members/" + gid + "/" + user.uid);
  const memSnap = await memRef.once("value");
  if (!memSnap.exists()) return res.status(403).json({ error: "Rejoignez d'abord ce zikr collectif." });
  const mem = memSnap.val() || {};

  const part = partSize(Number(g.target) || 0, Number(g.parts) || 0, Number(mem.rang) || 0);
  const oldFait = Number(mem.fait) || 0;
  // Avancement MONOTONE : on ne retient jamais une valeur inférieure à celle
  // déjà enregistrée. Le client envoie un absolu déduit de son compteur local
  // (localStorage) ; sans ce garde-fou, un appareil neuf (stockage vide), une
  // navigation privée ou le bouton « réinitialiser » renverrait 0 et ferait
  // RECULER le total commun — au détriment de tout le groupe. Contrepartie
  // assumée : après une remise à zéro locale, il faut regagner l'avancement
  // déjà acquis avant que le groupe ne progresse à nouveau.
  const newFait = Math.max(oldFait, clampFait(rawFait, part));
  const delta = newFait - oldFait;

  await memRef.update({ fait: newFait, updatedAt: Date.now() });
  let total = Number(g.total) || 0;
  if (delta !== 0) {
    // Le total commun = somme des parts faites : maintenu par transaction (le
    // delta reste juste même si plusieurs membres avancent en même temps).
    const totalTx = await db.ref("zikr_groups/" + gid + "/total").transaction((t) => Math.max(0, (t || 0) + delta));
    total = Number(totalTx.snapshot && totalTx.snapshot.val()) || 0;
  }

  return res.status(200).json({ ok: true, fait: newFait, part, total });
}

// ── Membre : quitter (libère sa part) ──────────────────────────
async function handleLeave(db, res, user, gid) {
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });
  const gSnap = await db.ref("zikr_groups/" + gid).once("value");
  const g = gSnap.val();
  if (!g) return res.status(404).json({ error: "Zikr collectif introuvable." });
  if (g.ownerUid === user.uid) {
    return res.status(400).json({ error: "Le créateur ne peut pas quitter son propre zikr (supprimez-le à la place)." });
  }
  const memSnap = await db.ref("zikr_members/" + gid + "/" + user.uid).once("value");
  if (memSnap.exists()) {
    const fait = Number((memSnap.val() || {}).fait) || 0;
    await db.ref("zikr_members/" + gid + "/" + user.uid).remove();
    await db.ref("zikr_groups/" + gid + "/membersCount").transaction((n) => Math.max(0, (n || 1) - 1));
    // Sa part récitée quitte le total commun avec elle (la part est libérée).
    if (fait > 0) await db.ref("zikr_groups/" + gid + "/total").transaction((t) => Math.max(0, (t || 0) - fait));
  }
  await db.ref("zikr_requests/" + gid + "/" + user.uid).remove();
  return res.status(200).json({ ok: true });
}

// ── Créateur : supprimer le groupe ─────────────────────────────
async function handleDelete(db, res, user, gid) {
  await assertOwner(db, gid, user);
  await Promise.all([
    db.ref("zikr_groups/" + gid).remove(),
    db.ref("zikr_members/" + gid).remove(),
    db.ref("zikr_requests/" + gid).remove(),
  ]);
  return res.status(200).json({ ok: true });
}

// Vérifie que l'appelant est bien le créateur du groupe, sinon lève une erreur
// HTTP (403/404). Renvoie le groupe (utile pour lire parts/target ensuite).
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
