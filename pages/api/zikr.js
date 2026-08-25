// api/zikr.js (Vercel) — ZIKR COLLECTIF : objectif de dhikr commun, cumulé
// entre plusieurs comptes, avec adhésion validée par le créateur.
//
// Tout passe par HTTPS (Admin SDK), comme le reste de l'app — jamais de SDK
// client Firebase RTDB direct (cf. l'historique /api/check-access, /api/social :
// ce canal WebSocket peut rester bloqué en silence sur certains réseaux).
//
// Body (JSON) : { idToken, action, ... }
//   action="list"      → liste publique des zikr collectifs (+ mon statut sur chacun)
//   action="create"    → { name, phrase, target } : crée un groupe, créateur = 1er membre
//   action="get"       → { groupId } : détail (progression, classement des membres,
//                          mon statut ; demandes en attente si je suis le créateur)
//   action="join"      → { groupId } : demande d'adhésion (créateur validera)
//   action="requests"  → { groupId } : créateur only — demandes en attente
//   action="approve"   → { groupId, uid } : créateur only — accepte une demande
//   action="reject"    → { groupId, uid } : créateur only — refuse une demande
//   action="contribute"→ { groupId, amount } : membre only — ajoute au total commun
//   action="leave"     → { groupId } : membre (non-créateur) quitte le groupe
//   action="delete"    → { groupId } : créateur only — supprime le groupe
//
// Nœuds (Admin SDK, écriture/lecture client interdites par les règles RTDB) :
//   zikr_groups/{gid}        = { name, phrase, target, total, ownerUid,
//                                 ownerEmail, createdAt, membersCount }
//   zikr_members/{gid}/{uid} = { email, joinedAt, contributed }
//   zikr_requests/{gid}/{uid}= { email, at }

const { verifyUser } = require("../../server/access");
const { app } = require("../../server/grant");
const { setCors, parseBody } = require("../../server/http");
const { rateLimit } = require("../../lib/rateLimit");
const { reportError } = require("../../server/log");
const { normalizeGroupInput, clampAmount } = require("../../lib/zikrLogic");

// Clé Firebase valide (ids de groupe = push keys ; uid = uid Firebase).
function safeKey(v) { return (v == null ? "" : String(v)).replace(/[.#$/[\]]/g, "").slice(0, 64); }

// Limites : "list"/"get" sont de simples rafraîchissements (larges) ;
// "contribute" est fréquent (envoi par lot de grains égrenés) mais borné ;
// les actions d'écriture rares (create/approve…) ont une limite serrée.
function limitFor(action) {
  if (action === "list" || action === "get") return { max: 40, windowMs: 60_000 };
  if (action === "contribute") return { max: 40, windowMs: 60_000 };
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
      case "list":       return await handleList(db, res, user);
      case "create":     return await handleCreate(db, res, user, body);
      case "get":        return await handleGet(db, res, user, gid);
      case "join":       return await handleJoin(db, res, user, gid);
      case "requests":   return await handleRequests(db, res, user, gid);
      case "approve":    return await handleApprove(db, res, user, gid, safeKey(body.uid));
      case "reject":     return await handleReject(db, res, user, gid, safeKey(body.uid));
      case "contribute": return await handleContribute(db, res, user, gid, body.amount);
      case "leave":      return await handleLeave(db, res, user, gid);
      case "delete":     return await handleDelete(db, res, user, gid);
      default:           return res.status(400).json({ error: "Action inconnue." });
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
  const ids = [];
  snap.forEach((g) => {
    const v = g.val() || {};
    ids.push(g.key);
    groups.push({
      id: g.key,
      name: v.name || "",
      phrase: v.phrase || "",
      target: Number(v.target) || 0,
      total: Number(v.total) || 0,
      membersCount: Number(v.membersCount) || 0,
      ownerEmail: v.ownerEmail || "",
      isOwner: v.ownerUid === user.uid,
      createdAt: v.createdAt || 0,
    });
  });

  // Mon statut (membre / en attente) — une lecture par groupe, mais ciblée
  // sur MON uid uniquement (pas toute la liste des membres de chacun).
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

// ── Créer un zikr collectif ────────────────────────────────────
async function handleCreate(db, res, user, body) {
  const norm = normalizeGroupInput(body);
  if (norm.error) {
    const msg =
      norm.error === "name" ? "Donnez un titre au zikr collectif."
      : norm.error === "phrase" ? "Indiquez la formule à réciter."
      : "Objectif invalide (entier positif requis).";
    return res.status(400).json({ error: msg });
  }

  const ref = db.ref("zikr_groups").push();
  const gid = ref.key;
  const now = Date.now();
  await ref.set({
    name: norm.name,
    phrase: norm.phrase,
    target: norm.target,
    total: 0,
    ownerUid: user.uid,
    ownerEmail: user.email,
    createdAt: now,
    membersCount: 1, // le créateur est le premier membre
  });
  await db.ref("zikr_members/" + gid + "/" + user.uid).set({ email: user.email, joinedAt: now, contributed: 0 });

  return res.status(200).json({ ok: true, id: gid });
}

// ── Détail d'un groupe (progression, classement, mon statut) ───
async function handleGet(db, res, user, gid) {
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });
  const gSnap = await db.ref("zikr_groups/" + gid).once("value");
  const g = gSnap.val();
  if (!g) return res.status(404).json({ error: "Zikr collectif introuvable." });

  const isOwner = g.ownerUid === user.uid;

  const membersSnap = await db.ref("zikr_members/" + gid).once("value");
  const members = [];
  let mine = null;
  membersSnap.forEach((m) => {
    const v = m.val() || {};
    const entry = { uid: m.key, email: v.email || "", contributed: Number(v.contributed) || 0 };
    if (m.key === user.uid) mine = entry;
    members.push(entry);
  });
  members.sort((a, b) => b.contributed - a.contributed); // classement décroissant

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

  return res.status(200).json({
    id: gid,
    name: g.name || "",
    phrase: g.phrase || "",
    target: Number(g.target) || 0,
    total: Number(g.total) || 0,
    ownerEmail: g.ownerEmail || "",
    createdAt: g.createdAt || 0,
    membersCount: Number(g.membersCount) || 0,
    status,
    myContribution: mine ? mine.contributed : 0,
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

// ── Créateur : accepter une demande ────────────────────────────
async function handleApprove(db, res, user, gid, uid) {
  await assertOwner(db, gid, user);
  if (!uid) return res.status(400).json({ error: "Compte manquant." });

  const reqSnap = await db.ref("zikr_requests/" + gid + "/" + uid).once("value");
  if (!reqSnap.exists()) return res.status(404).json({ error: "Demande introuvable (déjà traitée ?)." });
  const info = reqSnap.val() || {};

  // Déjà membre ? (double-clic) — on nettoie la demande sans re-compter.
  const memSnap = await db.ref("zikr_members/" + gid + "/" + uid).once("value");
  if (!memSnap.exists()) {
    await db.ref("zikr_members/" + gid + "/" + uid).set({
      email: info.email || "", joinedAt: Date.now(), contributed: 0,
    });
    await db.ref("zikr_groups/" + gid + "/membersCount").transaction((n) => (n || 0) + 1);
  }
  await db.ref("zikr_requests/" + gid + "/" + uid).remove();
  return res.status(200).json({ ok: true });
}

// ── Créateur : refuser une demande ─────────────────────────────
async function handleReject(db, res, user, gid, uid) {
  await assertOwner(db, gid, user);
  if (!uid) return res.status(400).json({ error: "Compte manquant." });
  await db.ref("zikr_requests/" + gid + "/" + uid).remove();
  return res.status(200).json({ ok: true });
}

// ── Membre : contribuer au total commun ────────────────────────
async function handleContribute(db, res, user, gid, rawAmount) {
  if (!gid) return res.status(400).json({ error: "Groupe manquant." });
  const amount = clampAmount(rawAmount);
  if (!amount) return res.status(400).json({ error: "Contribution invalide." });

  const memRef = db.ref("zikr_members/" + gid + "/" + user.uid);
  const memSnap = await memRef.once("value");
  if (!memSnap.exists()) return res.status(403).json({ error: "Rejoignez d'abord ce zikr collectif." });

  // Deux transactions atomiques : le total commun et la part du membre restent
  // cohérents même si plusieurs membres contribuent en même temps.
  const mineTx = await memRef.child("contributed").transaction((c) => (c || 0) + amount);
  const totalTx = await db.ref("zikr_groups/" + gid + "/total").transaction((t) => (t || 0) + amount);

  const total = Number(totalTx.snapshot && totalTx.snapshot.val()) || 0;
  const myContribution = Number(mineTx.snapshot && mineTx.snapshot.val()) || 0;
  return res.status(200).json({ ok: true, total, myContribution, added: amount });
}

// ── Membre : quitter ───────────────────────────────────────────
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
    await db.ref("zikr_members/" + gid + "/" + user.uid).remove();
    await db.ref("zikr_groups/" + gid + "/membersCount").transaction((n) => Math.max(0, (n || 1) - 1));
  }
  // Retire aussi une éventuelle demande en attente (cohérence).
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
// HTTP (403/404). Centralisé : toutes les actions d'administration passent ici.
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
