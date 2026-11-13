// server/asrarChat/chat.js — Discussions Asrar-chat : privées (dm), groupes
// et chaînes (seuls propriétaire/admins publient), publics ou privés.
//
// Messages : ac_messages/{cid}/{mid} = { uid, at, text?, asset?, replyTo?,
// forwarded?, editedAt?, deleted?, reactions?, postId? }. Les pièces jointes
// sont privées (dossier ac/{uid}/private) et servies par lien signé
// temporaire, uniquement à qui peut lire la discussion.
const crypto = require("crypto");
const { isValidKey } = require("../http");
const {
  P, fail, key, read, signal, inboxSignal, audit, getProfile, requireProfile, assertNotSuspended,
  isBlocked, publicProfile, profilesByUid,
} = require("./core");
const { deliver, publicUrl } = require("./media");
const { notifyUsers } = require("../notify");
const {
  normalizeConvInput, CONV_ERRORS, dmId, canPost, canModerate, cleanParagraph, cleanLine, normalizeAsset,
  MESSAGE_MAX, REACTIONS, GROUP_MEMBERS_MAX, assetKind, normalizeHandle,
} = require("../../lib/asrarChat/logic");
const { NOTIF_TYPES } = require("../../lib/notifyTemplates");

const PAGE = 40;
const PRESENCE_EVERY_MS = 60_000;

const newInviteCode = () => crypto.randomBytes(9).toString("base64url");

async function conv(db, cid) {
  key(cid, "Discussion");
  const c = await read(db, P.convs + "/" + cid);
  if (!c || c.removed) fail(404, "Discussion introuvable.");
  return c;
}
async function membership(db, cid, uid) {
  return read(db, `${P.members}/${cid}/${uid}`);
}
async function requireMember(db, cid, uid) {
  const c = await conv(db, cid);
  const m = await membership(db, cid, uid);
  if (!m) fail(403, "Rejoignez d'abord cette discussion.");
  return { c, m };
}
// Lecture : membres, ou n'importe quel compte pour un groupe/chaîne PUBLIC.
async function requireReader(db, cid, uid) {
  const c = await conv(db, cid);
  const m = await membership(db, cid, uid);
  if (!m && !(c.visibility === "public" && c.type !== "dm")) fail(403, "Discussion privée.");
  return { c, m };
}

async function touchPresence(db, uid) {
  const at = Number(await read(db, "ac_presence/" + uid)) || 0;
  if (Date.now() - at > PRESENCE_EVERY_MS) await db.ref("ac_presence/" + uid).set(Date.now()).catch(() => {});
}

function convSummary(cid, c, m, extra = {}) {
  return {
    id: cid, type: c.type, title: c.title || "", about: c.about || "", photo: c.photo || "",
    visibility: c.visibility || "private", membersCount: Number(c.membersCount) || 0,
    lastAt: Number(c.lastAt) || Number(c.createdAt) || 0, lastPreview: c.lastPreview || "",
    role: m ? m.role : null, muted: !!(m && m.muted), ...extra,
  };
}

async function unreadCount(db, cid, m) {
  if (!m) return 0;
  let q = db.ref(P.messages + "/" + cid).orderByKey();
  if (m.lastReadMid) q = q.startAfter(m.lastReadMid);
  const snap = await q.limitToLast(100).once("value");
  let n = 0;
  snap.forEach((child) => { const v = child.val(); if (v && v.uid !== m.uid && !v.deleted) n++; });
  return n;
}

// ── Liste et ouverture ─────────────────────────────────────────────────────
async function listConvs(db, user) {
  await touchPresence(db, user.uid);
  const index = (await read(db, `${P.userConvs}/${user.uid}`)) || {};
  const blocked = (await read(db, `${P.blocks}/${user.uid}`)) || {};
  const rows = await Promise.all(Object.keys(index).filter(isValidKey).map(async (cid) => {
    const [c, m] = await Promise.all([read(db, P.convs + "/" + cid), membership(db, cid, user.uid)]);
    if (!c || c.removed || !m) return null;
    const extra = { unread: await unreadCount(db, cid, { ...m, uid: user.uid }) };
    if (c.type === "dm") {
      const other = (c.dmUids || []).find((u) => u !== user.uid);
      const p = other ? publicProfile(other, await getProfile(db, other)) : null;
      if (!p) return null;
      extra.peer = { ...p, lastSeenAt: Number(await read(db, "ac_presence/" + other)) || 0 };
      extra.blocked = !!blocked[other];
      return convSummary(cid, { ...c, title: p.displayName, photo: p.photo }, m, extra);
    }
    return convSummary(cid, c, m, extra);
  }));
  const convs = rows.filter(Boolean).sort((a, b) => b.lastAt - a.lastAt);
  return { convs };
}

async function openDm(db, user, body) {
  const me = await requireProfile(db, user);
  await assertNotSuspended(db, user.uid);
  let other = body.uid;
  if (!other && body.handle) {
    const handle = normalizeHandle(body.handle);
    other = handle ? await read(db, P.handles + "/" + handle) : null;
  }
  key(other, "Profil");
  if (other === user.uid) fail(400, "Vous ne pouvez pas discuter avec vous-même.");
  const peer = await getProfile(db, other);
  if (!peer || !peer.handle) fail(404, "Profil introuvable.");
  if (await isBlocked(db, other, user.uid)) fail(403, "Ce compte n'accepte pas vos messages.");
  const cid = dmId(user.uid, other);
  const existing = await read(db, P.convs + "/" + cid);
  if (!existing) {
    const now = Date.now();
    await db.ref().update({
      [`${P.convs}/${cid}`]: { type: "dm", dmUids: [user.uid, other].sort(), visibility: "private", ownerUid: user.uid, createdAt: now, lastAt: now, membersCount: 2, title: "" },
      [`${P.members}/${cid}/${user.uid}`]: { role: "member", joinedAt: now, lastReadAt: now },
      [`${P.members}/${cid}/${other}`]: { role: "member", joinedAt: now, lastReadAt: now },
      [`${P.userConvs}/${user.uid}/${cid}`]: now,
      [`${P.userConvs}/${other}/${cid}`]: now,
    });
  } else {
    // Une discussion quittée réapparaît pour les deux à l'ouverture.
    const now = Date.now();
    const updates = {};
    for (const uid of [user.uid, other]) {
      if (!(await membership(db, cid, uid))) updates[`${P.members}/${cid}/${uid}`] = { role: "member", joinedAt: now, lastReadAt: now };
      updates[`${P.userConvs}/${uid}/${cid}`] = now;
    }
    await db.ref().update(updates);
  }
  void me;
  return { id: cid };
}

async function createConv(db, user, body) {
  await requireProfile(db, user);
  await assertNotSuspended(db, user.uid);
  const norm = normalizeConvInput(body);
  if (norm.error) fail(400, CONV_ERRORS[norm.error]);
  const owned = Object.keys((await read(db, `${P.userConvs}/${user.uid}`)) || {}).length;
  if (owned > 500) fail(400, "Trop de discussions. Quittez-en avant d'en créer une nouvelle.");
  const ref = db.ref(P.convs).push();
  const now = Date.now();
  const value = { ...norm.value, ownerUid: user.uid, createdAt: now, lastAt: now, membersCount: 1, inviteCode: newInviteCode() };
  if (body.photo) {
    const asset = normalizeAsset(body.photo, user.uid, "public");
    if (!asset || asset.rt !== "image") fail(400, "Photo invalide.");
    value.photo = publicUrl(asset, "c_fill,w_256,h_256,q_auto,f_auto");
  }
  await db.ref().update({
    [`${P.convs}/${ref.key}`]: value,
    [`${P.members}/${ref.key}/${user.uid}`]: { role: "owner", joinedAt: now, lastReadAt: now },
    [`${P.userConvs}/${user.uid}/${ref.key}`]: now,
  });
  await audit(db, user.uid, "conv.create", { cid: ref.key, type: value.type, visibility: value.visibility });
  return { id: ref.key };
}

async function getConv(db, user, body) {
  const cid = key(body.cid, "Discussion");
  const { c, m } = await requireReader(db, cid, user.uid);
  const out = convSummary(cid, c, m);
  if (c.type === "dm") {
    const other = (c.dmUids || []).find((u) => u !== user.uid);
    const p = publicProfile(other, await getProfile(db, other));
    out.title = p ? p.displayName : "";
    out.photo = p ? p.photo : "";
    out.peer = p ? { ...p, lastSeenAt: Number(await read(db, "ac_presence/" + other)) || 0 } : null;
    out.blocked = !!(await read(db, `${P.blocks}/${user.uid}/${other}`));
    out.blockedMe = !!(await read(db, `${P.blocks}/${other}/${user.uid}`));
  }
  out.canPost = canPost(c, m);
  out.canModerate = canModerate(m);
  if (canModerate(m) && c.type !== "dm") out.inviteCode = c.inviteCode || "";
  const owner = c.ownerUid ? publicProfile(c.ownerUid, await getProfile(db, c.ownerUid)) : null;
  if (owner && c.type !== "dm") out.owner = owner;
  return { conv: out };
}

async function joinConv(db, user, body) {
  await requireProfile(db, user);
  await assertNotSuspended(db, user.uid);
  let cid = body.cid;
  if (!cid && body.inviteCode) {
    const code = String(body.inviteCode).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
    if (code.length < 8) fail(400, "Lien d'invitation invalide.");
    const snap = await db.ref(P.convs).orderByChild("inviteCode").equalTo(code).limitToFirst(1).once("value");
    snap.forEach((child) => { cid = child.key; });
    if (!cid) fail(404, "Lien d'invitation expiré ou invalide.");
  }
  const c = await conv(db, key(cid, "Discussion"));
  if (c.type === "dm") fail(403, "Discussion privée.");
  if (c.visibility !== "public" && !(body.inviteCode && body.inviteCode === c.inviteCode)) fail(403, "Cette discussion est privée : il faut un lien d'invitation.");
  if (await read(db, `ac_bans/${cid}/${user.uid}`)) fail(403, "Vous avez été retiré de cette discussion.");
  if (await membership(db, cid, user.uid)) return { id: cid };
  const now = Date.now();
  const tx = await db.ref(`${P.convs}/${cid}/membersCount`).transaction((n) => {
    const count = Number(n) || 0;
    if (c.type === "group" && count >= GROUP_MEMBERS_MAX) return undefined;
    return count + 1;
  });
  if (!tx.committed) fail(409, "Ce groupe est complet.");
  await db.ref().update({
    [`${P.members}/${cid}/${user.uid}`]: { role: "member", joinedAt: now, lastReadAt: now },
    [`${P.userConvs}/${user.uid}/${cid}`]: now,
  });
  return { id: cid };
}

async function leaveConv(db, user, body) {
  const cid = key(body.cid, "Discussion");
  const { c, m } = await requireMember(db, cid, user.uid);
  const updates = { [`${P.members}/${cid}/${user.uid}`]: null, [`${P.userConvs}/${user.uid}/${cid}`]: null };
  if (c.type !== "dm") {
    if (m.role === "owner") {
      // Succession : le plus ancien admin, sinon le plus ancien membre.
      const all = Object.entries((await read(db, `${P.members}/${cid}`)) || {}).filter(([uid]) => uid !== user.uid);
      all.sort(([, a], [, b]) => (a.role === "admin" ? 0 : 1) - (b.role === "admin" ? 0 : 1) || (a.joinedAt || 0) - (b.joinedAt || 0));
      if (all.length) {
        updates[`${P.members}/${cid}/${all[0][0]}/role`] = "owner";
        updates[`${P.convs}/${cid}/ownerUid`] = all[0][0];
      } else updates[`${P.convs}/${cid}/removed`] = true;
    }
    await db.ref(`${P.convs}/${cid}/membersCount`).transaction((n) => Math.max(0, (Number(n) || 1) - 1));
  }
  await db.ref().update(updates);
  return { ok: true };
}

async function updateConv(db, user, body) {
  const cid = key(body.cid, "Discussion");
  const { c, m } = await requireMember(db, cid, user.uid);
  if (c.type === "dm" || !canModerate(m)) fail(403, "Réservé aux administrateurs de la discussion.");
  const norm = normalizeConvInput({ ...body, type: c.type });
  if (norm.error) fail(400, CONV_ERRORS[norm.error]);
  const update = { title: norm.value.title, about: norm.value.about, visibility: norm.value.visibility };
  if (body.photo) {
    const asset = normalizeAsset(body.photo, user.uid, "public");
    if (!asset || asset.rt !== "image") fail(400, "Photo invalide.");
    update.photo = publicUrl(asset, "c_fill,w_256,h_256,q_auto,f_auto");
  }
  if (body.resetInvite === true) update.inviteCode = newInviteCode();
  await db.ref(P.convs + "/" + cid).update(update);
  await signal(db, cid);
  return { ok: true };
}

async function listMembers(db, user, body) {
  const cid = key(body.cid, "Discussion");
  const { c, m } = await requireMember(db, cid, user.uid);
  // Abonnés d'une chaîne : visibles des seuls administrateurs.
  if (c.type === "channel" && !canModerate(m)) fail(403, "Liste réservée aux administrateurs de la chaîne.");
  const members = (await read(db, `${P.members}/${cid}`)) || {};
  const uids = Object.keys(members).slice(0, 500);
  const profiles = await profilesByUid(db, uids);
  return {
    members: uids.filter((uid) => profiles[uid]).map((uid) => ({ ...profiles[uid], role: members[uid].role, joinedAt: members[uid].joinedAt || 0 }))
      .sort((a, b) => ["owner", "admin", "member"].indexOf(a.role) - ["owner", "admin", "member"].indexOf(b.role) || a.joinedAt - b.joinedAt),
  };
}

async function setMemberRole(db, user, body) {
  const cid = key(body.cid, "Discussion");
  const target = key(body.uid, "Membre");
  const { c, m } = await requireMember(db, cid, user.uid);
  if (c.type === "dm" || m.role !== "owner") fail(403, "Réservé au propriétaire.");
  if (target === user.uid) fail(400, "Action impossible sur vous-même.");
  if (!(await membership(db, cid, target))) fail(404, "Membre introuvable.");
  const role = body.role === "admin" ? "admin" : "member";
  await db.ref(`${P.members}/${cid}/${target}/role`).set(role);
  return { ok: true };
}

async function removeMember(db, user, body) {
  const cid = key(body.cid, "Discussion");
  const target = key(body.uid, "Membre");
  const { c, m } = await requireMember(db, cid, user.uid);
  if (c.type === "dm" || !canModerate(m)) fail(403, "Réservé aux administrateurs.");
  const t = await membership(db, cid, target);
  if (!t) fail(404, "Membre introuvable.");
  if (t.role === "owner" || (t.role === "admin" && m.role !== "owner")) fail(403, "Vous ne pouvez pas retirer ce membre.");
  await db.ref().update({
    [`${P.members}/${cid}/${target}`]: null,
    [`${P.userConvs}/${target}/${cid}`]: null,
    [`ac_bans/${cid}/${target}`]: body.ban === true ? Date.now() : null,
  });
  await db.ref(`${P.convs}/${cid}/membersCount`).transaction((n) => Math.max(0, (Number(n) || 1) - 1));
  await audit(db, user.uid, "conv.removeMember", { cid, target, ban: body.ban === true });
  return { ok: true };
}

async function setMuted(db, user, body) {
  const cid = key(body.cid, "Discussion");
  await requireMember(db, cid, user.uid);
  await db.ref(`${P.members}/${cid}/${user.uid}/muted`).set(body.muted === true ? true : null);
  return { ok: true };
}

// ── Messages ───────────────────────────────────────────────────────────────
function preview(msg) {
  if (msg.postId) return "Publication";
  if (msg.text) return cleanLine(msg.text, 80);
  const kind = assetKind(msg.asset);
  return { image: "Photo", video: "Vidéo", audio: "Message vocal", document: "Document" }[kind] || "Message";
}

async function messageOut(db, cid, id, v, viewerUid, postCard) {
  const base = { id, uid: v.uid || "", at: v.at || 0 };
  if (v.deleted) return { ...base, deleted: true };
  const out = { ...base, text: v.text || "" };
  if (v.asset) out.media = deliver(v.asset);
  if (v.forwarded) out.forwarded = true;
  if (v.editedAt) out.editedAt = v.editedAt;
  if (v.reactions) out.reactions = v.reactions;
  if (v.replyTo) {
    const parent = await read(db, `${P.messages}/${cid}/${v.replyTo}`);
    out.reply = parent && !parent.deleted
      ? { id: v.replyTo, uid: parent.uid, text: cleanLine(parent.text, 140), kind: parent.postId ? "post" : assetKind(parent.asset) }
      : { id: v.replyTo, deleted: true };
  }
  if (v.postId) out.post = await postCard(db, v.postId, viewerUid);
  return out;
}

async function listMessages(db, user, body, postCard) {
  const cid = key(body.cid, "Discussion");
  const { c, m } = await requireReader(db, cid, user.uid);
  let q = db.ref(P.messages + "/" + cid).orderByKey();
  if (body.before && isValidKey(body.before)) q = q.endBefore(body.before);
  const snap = await q.limitToLast(PAGE).once("value");
  const raw = [];
  snap.forEach((child) => { raw.push([child.key, child.val()]); });
  const blocked = (await read(db, `${P.blocks}/${user.uid}`)) || {};
  const visible = raw.filter(([, v]) => v && !blocked[v.uid]);
  const messages = await Promise.all(visible.map(([id, v]) => messageOut(db, cid, id, v, user.uid, postCard)));
  const authors = await profilesByUid(db, messages.map((x) => x.uid));
  const result = { messages, authors, hasMore: raw.length === PAGE };
  // Accusés de lecture (discussion privée) : où en est l'autre participant.
  if (c.type === "dm" && m) {
    const other = (c.dmUids || []).find((u) => u !== user.uid);
    const om = other ? await membership(db, cid, other) : null;
    result.peerReadAt = om ? Number(om.lastReadAt) || 0 : 0;
  }
  if (m && c.type === "group") result.readCount = await groupReadCounts(db, cid, messages, user.uid);
  return result;
}

// Groupe : combien de membres ont lu chacun de MES messages récents.
async function groupReadCounts(db, cid, messages, uid) {
  const mine = messages.filter((x) => x.uid === uid && !x.deleted);
  if (!mine.length) return {};
  const members = (await read(db, `${P.members}/${cid}`)) || {};
  const reads = Object.entries(members).filter(([u]) => u !== uid).map(([, v]) => Number(v.lastReadAt) || 0);
  return Object.fromEntries(mine.map((x) => [x.id, reads.filter((at) => at >= x.at).length]));
}

async function notifyRecipients(db, cid, c, sender, previousLastAt, text) {
  const members = (await read(db, `${P.members}/${cid}`)) || {};
  // Une seule notification par série : seuls les membres qui avaient tout lu
  // avant ce message sont notifiés (pas une notification par message).
  const uids = Object.entries(members)
    .filter(([uid, v]) => uid !== sender.uid && !v.muted && (Number(v.lastReadAt) || 0) >= previousLastAt)
    .map(([uid]) => uid);
  if (c.type !== "channel") await inboxSignal(db, Object.keys(members));
  if (!uids.length) return;
  const name = sender.profile.displayName || sender.profile.handle || "Asrar-chat";
  const title = c.type === "dm" ? name : c.title || "Asrar-chat";
  await notifyUsers(db, uids, {
    type: NOTIF_TYPES.ASRAR_CHAT,
    title,
    body: c.type === "dm" ? text : `${name} : ${text}`,
    senderName: name,
    targetUrl: "/asrar-chat?c=" + cid,
    meta: { tagSuffix: cid },
  }, { eventId: "ac-msg:" + cid + ":" + Date.now() }).catch(() => {});
}

async function sendMessage(db, user, body) {
  const profile = await requireProfile(db, user);
  await assertNotSuspended(db, user.uid);
  const cid = key(body.cid, "Discussion");
  const { c, m } = await requireMember(db, cid, user.uid);
  if (!canPost(c, m)) fail(403, "Seuls les administrateurs publient dans cette chaîne.");
  if (c.type === "dm") {
    const other = (c.dmUids || []).find((u) => u !== user.uid);
    if (await isBlocked(db, other, user.uid)) fail(403, "Ce compte n'accepte pas vos messages.");
    if (await isBlocked(db, user.uid, other)) fail(403, "Vous avez bloqué ce compte. Débloquez-le pour lui écrire.");
  }
  const msg = { uid: user.uid, at: Date.now() };
  const text = cleanParagraph(body.text, MESSAGE_MAX);
  if (text) msg.text = text;
  if (body.asset) {
    const asset = normalizeAsset(body.asset, user.uid, "private");
    if (!asset) fail(400, "Pièce jointe invalide. Renvoyez-la.");
    msg.asset = asset;
  }
  if (body.postId) {
    const post = await read(db, P.posts + "/" + key(body.postId, "Publication"));
    if (!post || post.status !== "published") fail(404, "Publication introuvable.");
    if (post.sellerUid !== user.uid && !body.forwarded) fail(403, "Vous ne pouvez publier que vos propres contenus.");
    msg.postId = body.postId;
  }
  if (!msg.text && !msg.asset && !msg.postId) fail(400, "Message vide.");
  if (body.replyTo && isValidKey(body.replyTo) && (await read(db, `${P.messages}/${cid}/${body.replyTo}`))) msg.replyTo = body.replyTo;
  const ref = db.ref(P.messages + "/" + cid).push();
  const previousLastAt = Number(c.lastAt) || 0;
  await db.ref().update({
    [`${P.messages}/${cid}/${ref.key}`]: msg,
    [`${P.convs}/${cid}/lastAt`]: msg.at,
    [`${P.convs}/${cid}/lastPreview`]: preview(msg),
    [`${P.members}/${cid}/${user.uid}/lastReadAt`]: msg.at,
    [`${P.members}/${cid}/${user.uid}/lastReadMid`]: ref.key,
  });
  await signal(db, cid);
  await notifyRecipients(db, cid, c, { uid: user.uid, profile }, previousLastAt, preview(msg));
  return { id: ref.key, at: msg.at };
}

async function mutateMessage(db, user, body, kind) {
  const cid = key(body.cid, "Discussion");
  const mid = key(body.mid, "Message");
  const { c, m } = await requireMember(db, cid, user.uid);
  const ref = db.ref(`${P.messages}/${cid}/${mid}`);
  const current = await read(db, `${P.messages}/${cid}/${mid}`);
  if (!current || current.deleted) fail(404, "Message introuvable.");
  if (kind === "edit") {
    if (current.uid !== user.uid) fail(403, "Seul l'auteur peut modifier ce message.");
    if (current.postId) fail(400, "Modifiez la publication elle-même.");
    const text = cleanParagraph(body.text, MESSAGE_MAX);
    if (!text && !current.asset) fail(400, "Message vide.");
    await ref.update({ text, editedAt: Date.now() });
  } else if (kind === "delete") {
    if (current.uid !== user.uid && !canModerate(m)) fail(403, "Seul l'auteur ou un administrateur peut supprimer ce message.");
    await ref.set({ uid: current.uid, at: current.at, deleted: true, deletedBy: user.uid });
    if (current.uid !== user.uid) await audit(db, user.uid, "message.delete", { cid, mid, author: current.uid });
  } else if (kind === "react") {
    const emoji = body.emoji == null ? null : String(body.emoji);
    if (emoji !== null && !REACTIONS.includes(emoji)) fail(400, "Réaction invalide.");
    await db.ref(`${P.messages}/${cid}/${mid}/reactions/${user.uid}`).set(emoji);
  }
  void c;
  await signal(db, cid);
  return { ok: true };
}

async function forwardMessage(db, user, body) {
  const from = key(body.cid, "Discussion");
  const mid = key(body.mid, "Message");
  await requireReader(db, from, user.uid);
  const source = await read(db, `${P.messages}/${from}/${mid}`);
  if (!source || source.deleted) fail(404, "Message introuvable.");
  const targets = (Array.isArray(body.to) ? body.to : [body.to]).filter(isValidKey).slice(0, 5);
  if (!targets.length) fail(400, "Choisissez une discussion.");
  const results = [];
  for (const to of targets) {
    const { c, m } = await requireMember(db, to, user.uid);
    if (!canPost(c, m)) fail(403, "Vous ne pouvez pas publier dans « " + (c.title || "cette discussion") + " ».");
    const msg = { uid: user.uid, at: Date.now(), forwarded: true };
    if (source.text) msg.text = source.text;
    if (source.asset) msg.asset = source.asset;
    if (source.postId) msg.postId = source.postId;
    const ref = db.ref(P.messages + "/" + to).push();
    await db.ref().update({
      [`${P.messages}/${to}/${ref.key}`]: msg,
      [`${P.convs}/${to}/lastAt`]: msg.at,
      [`${P.convs}/${to}/lastPreview`]: preview(msg),
      [`${P.members}/${to}/${user.uid}/lastReadAt`]: msg.at,
      [`${P.members}/${to}/${user.uid}/lastReadMid`]: ref.key,
    });
    await signal(db, to);
    results.push(ref.key);
  }
  return { ok: true, ids: results };
}

async function markRead(db, user, body) {
  const cid = key(body.cid, "Discussion");
  const { m } = await requireMember(db, cid, user.uid);
  const snap = await db.ref(P.messages + "/" + cid).orderByKey().limitToLast(1).once("value");
  let last = null;
  snap.forEach((child) => { last = child.key; });
  // Déjà à jour : aucune écriture ni signal (sinon deux participants
  // connectés se réveilleraient mutuellement sans fin).
  if (!last || m.lastReadMid === last) return { ok: true };
  const update = { lastReadAt: Date.now() };
  if (last) update.lastReadMid = last;
  await db.ref(`${P.members}/${cid}/${user.uid}`).update(update);
  await touchPresence(db, user.uid);
  await signal(db, cid);
  return { ok: true };
}

module.exports = {
  listConvs, openDm, createConv, getConv, joinConv, leaveConv, updateConv, listMembers, setMemberRole,
  removeMember, setMuted, listMessages, sendMessage, mutateMessage, forwardMessage, markRead,
  requireReader, membership,
};
