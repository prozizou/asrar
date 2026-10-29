const { normalizeChatWaveform } = require('../lib/chatWaveform');
const { randomUUID } = require('crypto');
const { isValidKey } = require('./http');
const { isActiveZikrMember } = require('../lib/zikrWarning');
const { chatDisplayName, cleanText, CHAT_MESSAGE_MAX, CHAT_MEDIA_TYPES, isValidChatMessage } = require('../lib/zikrLogic');

async function signal(db, gid) {
  try { await db.ref(`zikr_chat_signals/${gid}`).set({ at: Date.now(), nonce: randomUUID() }); }
  catch { /* A committed message remains successful; API polling reconciles. */ }
}
function fail(code, message) { throw Object.assign(new Error(message), { statusCode: code }); }
async function member(db, gid, uid) {
  if (!isValidKey(gid)) fail(400, 'Groupe manquant ou invalide.');
  if (!isActiveZikrMember((await db.ref(`zikr_members/${gid}/${uid}`).once('value')).val())) fail(403, 'Rejoignez d’abord ce zikr collectif.');
}
function key(value) { if (!isValidKey(value)) fail(400, 'Message ou curseur invalide.'); return value; }
function publicMessage(id, value) {
  const v = value || {};
  const base = { id, uid: v.uid || '', email: v.email || '', name: v.name || '', picture: v.picture || '', at: v.at || 0, version: v.version || 0 };
  if (v.deleted) return { ...base, text: '', deleted: true };
  return { ...base, text: v.text || '', ...(v.replyTo ? { replyTo: v.replyTo } : {}), ...(v.forwarded ? { forwarded: true } : {}),
    ...(v.editedAt ? { editedAt: v.editedAt } : {}), ...(v.reactions ? { reactions: v.reactions } : {}),
    ...(CHAT_MEDIA_TYPES.includes(v.mediaType) && v.mediaUrl ? { mediaType: v.mediaType, mediaUrl: v.mediaUrl, mediaDuration: v.mediaDuration || 0, ...(normalizeChatWaveform(v.mediaWaveform) ? { mediaWaveform: v.mediaWaveform } : {}) } : {}) };
}
async function quotes(db, gid, messages) {
  const cache = new Map(messages.map((message) => [message.id, message]));
  const needed = [...new Set(messages.filter((m) => m.replyTo && !cache.has(m.replyTo)).map((m) => m.replyTo))];
  await Promise.all(needed.map(async (id) => {
    const value = (await db.ref(`zikr_chat/${gid}/${id}`).once('value')).val();
    cache.set(id, value ? publicMessage(id, value) : { id, deleted: true, text: '' });
  }));
  return messages.map((message) => {
    if (!message.replyTo) return message;
    const parent = cache.get(message.replyTo);
    return { ...message, reply: parent?.deleted ? { id: message.replyTo, deleted: true } : {
      id: message.replyTo, uid: parent.uid, name: chatDisplayName(parent.email, parent.name), version: parent.version || 0, text: parent.text?.slice(0, 180) || '', mediaType: parent.mediaType || null,
    } };
  });
}
function media(body) {
  const text = cleanText(body.text, CHAT_MESSAGE_MAX);
  const mediaType = CHAT_MEDIA_TYPES.includes(body.mediaType) ? body.mediaType : null;
  const mediaUrl = mediaType && /^https:\/\/res\.cloudinary\.com\//.test(String(body.mediaUrl || '')) ? String(body.mediaUrl) : null;
  if (!isValidChatMessage(text, mediaType, mediaUrl)) fail(400, 'Écrivez un message ou joignez une image/un audio avant d’envoyer.');
  const result = { text };
  if (mediaUrl) {
    result.mediaType = mediaType; result.mediaUrl = mediaUrl;
    const duration = Math.floor(Number(body.mediaDuration));
    if (mediaType === 'audio' && duration > 0 && Number.isFinite(duration)) result.mediaDuration = Math.min(duration, 120);
    const waveform = normalizeChatWaveform(body.mediaWaveform);
    if (mediaType === 'audio' && waveform) result.mediaWaveform = waveform;
  }
  return result;
}
async function send(db, res, user, gid, body, publish, forwarded = false) {
  await member(db, gid, user.uid);
  const payload = media(body);
  if (body.replyTo) {
    const replyTo = key(body.replyTo);
    const source = (await db.ref(`zikr_chat/${gid}/${replyTo}`).once('value')).val();
    if (!source || source.deleted) fail(409, 'Le message auquel vous répondez a été supprimé.');
    payload.replyTo = replyTo;
  }
  const message = { ...payload, uid: user.uid, email: user.email || '', at: Date.now(), version: 0 };
  if (user.name) message.name = user.name;
  if (user.picture) message.picture = user.picture;
  if (forwarded) message.forwarded = true;
  const ref = db.ref(`zikr_chat/${gid}`).push();
  await publish(db, gid, user.uid, user.email, user.name, message.text, !!message.mediaUrl, ref.key, message);
  await signal(db, gid);
  return res.json({ ok: true, id: ref.key });
}
async function messages(db, res, user, gid, body) {
  await member(db, gid, user.uid);
  const { after, before, changeAfter } = body;
  if (after != null) key(after);
  if (before != null) key(before);
  if (changeAfter != null) key(changeAfter);
  if (before && after) fail(400, 'Deux curseurs de discussion incompatibles.');
  const limit = body.limit == null ? 200 : Number(body.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) fail(400, 'Taille de page invalide.');
  let query = db.ref(`zikr_chat/${gid}`).orderByKey();
  if (after) query = query.startAfter(after);
  if (before) query = query.endBefore(before);
  const snap = await (after ? query.limitToFirst(limit) : query.limitToLast(limit)).once('value');
  const list = []; snap.forEach((item) => { list.push(publicMessage(item.key, item.val())); });
  const result = { messages: await quotes(db, gid, list), incremental: !!after, ...((body.limit || before) ? { hasOlder: list.length === limit } : {}) };
  if (body.withChanges) {
    let changesQuery = db.ref(`zikr_chat_changes/${gid}`).orderByKey();
    changesQuery = changeAfter ? changesQuery.startAfter(changeAfter).limitToFirst(100) : changesQuery.limitToLast(100);
    const changes = await changesQuery.once('value');
    const changedIds = new Set(); changes.forEach((event) => { if (isValidKey(event.val()?.id)) changedIds.add(event.val().id); result.changeCursor = event.key; });
    const changed = await Promise.all([...changedIds].map(async (id) => publicMessage(id, (await db.ref(`zikr_chat/${gid}/${id}`).once('value')).val() || { deleted: true })));
    result.changes = await quotes(db, gid, changed);
  }
  return res.json(result);
}
async function mutate(db, res, user, gid, body, remove) {
  await member(db, gid, user.uid);
  const id = key(body.messageId);
  const replacement = remove ? null : media(body);
  const event = db.ref(`zikr_chat_changes/${gid}`).push();
  const now = Date.now();
  const result = await db.ref(`zikr_chat/${gid}/${id}`).transaction((current) => {
    if (!current) return current;
    if (current.uid !== user.uid || (!remove && current.deleted)) return;
    if (remove && current.deleted) return current; // Retry repairs the same change event.
    const base = { uid: current.uid, email: current.email || '', at: current.at, name: current.name || '', picture: current.picture || '', version: (current.version || 0) + 1, changeKey: event.key };
    if (remove) return { ...base, text: '', deleted: true, deletedAt: now };
    if (current.mediaType === 'audio' || replacement.mediaType === 'audio') return;
    return { ...base, ...replacement, ...(current.replyTo ? { replyTo: current.replyTo } : {}), ...(current.forwarded ? { forwarded: true } : {}), ...(current.reactions ? { reactions: current.reactions } : {}), editedAt: now };
  });
  const value = result.snapshot.val();
  if (!value) fail(404, 'Message introuvable.');
  if (value.uid !== user.uid) fail(403, 'Vous pouvez modifier ou supprimer uniquement vos messages.');
  if (!result.committed) fail(409, 'Ce message ne peut plus être modifié.');
  await db.ref(`zikr_chat_changes/${gid}/${value.changeKey}`).set({ id });
  await signal(db, gid);
  return res.json({ ok: true, message: publicMessage(id, value) });
}
async function forward(db, res, user, gid, body, publish) {
  await member(db, gid, user.uid);
  const source = (await db.ref(`zikr_chat/${gid}/${key(body.messageId)}`).once('value')).val();
  if (!source || source.deleted) fail(409, 'Ce message n’est plus disponible.');
  const destination = key(body.targetGroupId);
  await member(db, destination, user.uid);
  return send(db, res, user, destination, { text: source.text, mediaType: source.mediaType, mediaUrl: source.mediaUrl, mediaDuration: source.mediaDuration, mediaWaveform: source.mediaWaveform }, publish, true);
}
async function read(db, res, user, gid, body) {
  await member(db, gid, user.uid);
  if (!Array.isArray(body.messageIds) || body.messageIds.length > 50 || !body.messageIds.every(isValidKey)) fail(400, 'Liste de messages invalide.');
  const played = body.kind === 'played';
  if (body.kind && !['seen', 'played'].includes(body.kind)) fail(400, 'Type de lecture invalide.');
  await Promise.all([...new Set(body.messageIds)].map(async (id) => {
    const message = (await db.ref(`zikr_chat/${gid}/${id}`).once('value')).val();
    if (!message || message.deleted || message.uid === user.uid || (played && message.mediaType !== 'audio')) return;
    await db.ref(`zikr_chat_reads/${gid}/${id}/${user.uid}`).transaction((current) => {
      const result = current || { at: Date.now(), name: chatDisplayName(user.email, user.name) };
      return played && !result.playedAt ? { ...result, playedAt: Date.now() } : result;
    });
    // Per-author live markers: a set of reader UIDs is idempotent, so retrying
    // after a network failure cannot increment a count twice.
    await db.ref(`zikr_chat_read_counts/${gid}/${message.uid}/${id}/${user.uid}`).set(true);
  }));
  return res.json({ ok: true });
}
async function readers(db, res, user, gid, body) {
  await member(db, gid, user.uid);
  const id = key(body.messageId);
  const message = (await db.ref(`zikr_chat/${gid}/${id}`).once('value')).val();
  if (!message) fail(404, 'Message introuvable.');
  if (message.uid !== user.uid) fail(403, 'Les informations de lecture sont réservées à l’auteur.');
  if (message.deleted) return res.json({ readers: [] });
  const snap = await db.ref(`zikr_chat_reads/${gid}/${id}`).once('value');
  const list = []; snap.forEach((item) => { const value = item.val(); list.push({ uid: item.key, name: value.name || 'Participant', at: value.at, ...(value.playedAt ? { playedAt: value.playedAt } : {}) }); });
  return res.json({ readers: list });
}
async function react(db, res, user, gid, body) {
  await member(db, gid, user.uid);
  const id = key(body.messageId);
  const emoji = body.emoji;
  if (emoji != null && !['❤️', '👍', '🤲', '😂', '😮', '😢'].includes(emoji)) fail(400, 'Réaction invalide.');
  const event = db.ref(`zikr_chat_changes/${gid}`).push();
  const result = await db.ref(`zikr_chat/${gid}/${id}`).transaction((current) => {
    if (!current) return current;
    if (current.deleted) return;
    const reactions = { ...(current.reactions || {}) };
    if (!emoji || reactions[user.uid] === emoji) delete reactions[user.uid]; else reactions[user.uid] = emoji;
    return { ...current, reactions, version: (current.version || 0) + 1, changeKey: event.key };
  });
  const value = result.snapshot.val();
  if (!value) fail(404, 'Message introuvable.');
  if (!result.committed || value.deleted) fail(409, 'Le message a été supprimé.');
  await db.ref(`zikr_chat_changes/${gid}/${value.changeKey}`).set({ id });
  await signal(db, gid);
  return res.json({ ok: true, message: publicMessage(id, value) });
}
module.exports = { send, messages, mutate, forward, read, readers, react };
