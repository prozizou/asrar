// server/asrarChat/core.js — Briques communes d'Asrar-chat (serveur only).
// Toutes les données vivent sous des nœuds RTDB préfixés « ac_ », écrits
// UNIQUEMENT par l'API (Admin SDK) ; les règles RTDB n'ouvrent en lecture
// directe que des signaux sans contenu (rules/database.rules.json).
const crypto = require("crypto");
const { isValidKey } = require("../http");

const P = {
  profiles: "ac_profiles",          // {uid}: { handle, displayName, bio, photo?, seller?, createdAt, stats? }
  handles: "ac_handles",            // {handle}: uid (unicité des pseudonymes)
  convs: "ac_convs",                // {cid}: { type, title, about, photo?, visibility, ownerUid, inviteCode?, createdAt, lastAt, lastPreview, membersCount, removed? }
  members: "ac_members",            // {cid}/{uid}: { role, joinedAt, lastReadAt, muted? }
  userConvs: "ac_user_convs",       // {uid}/{cid}: { lastAt }
  messages: "ac_messages",          // {cid}/{mid}: message
  signals: "ac_signals",            // {cid}: { at, nonce } — lisible par les membres
  inbox: "ac_inbox_signals",        // {uid}: { at, nonce } — lisible par soi
  typing: "ac_typing",              // {cid}/{uid}: epoch ms — écrit par le client membre
  posts: "ac_posts",                // {pid}: publication (partie publique)
  postContent: "ac_post_content",   // {pid}: { contentText, assets } — jamais lu sans droit
  entitlements: "ac_entitlements",  // {uid}/{pid}: { orderId, grantedAt, expiresAt, revoked? }
  orders: "ac_orders",              // {oid}: commande
  buyerOrders: "ac_buyer_orders",   // {uid}/{oid}: at
  sellerOrders: "ac_seller_orders", // {uid}/{oid}: at
  favorites: "ac_favorites",        // {uid}/{pid}: at
  ratings: "ac_ratings",            // {pid}/{uid}: { stars, at }
  blocks: "ac_blocks",              // {uid}/{blockedUid}: at
  reports: "ac_reports",            // {rid}: signalement
  suspended: "ac_suspended",        // {uid}: { at, by, reason }
  settings: "ac_settings",          // { commissionRate }
  audit: "ac_audit",                // {id}: journal des opérations sensibles
};

function fail(statusCode, message) {
  throw Object.assign(new Error(message), { statusCode });
}

function key(value, label = "Identifiant") {
  if (!isValidKey(value)) fail(400, label + " invalide.");
  return value;
}

async function read(db, path) {
  return (await db.ref(path).once("value")).val();
}

function nonce() {
  return crypto.randomBytes(8).toString("hex");
}

// Signaux sans contenu : réveillent l'interface des membres (écoute RTDB),
// qui relit ensuite par l'API. Un échec n'annule jamais l'opération.
async function signal(db, cid) {
  try { await db.ref(P.signals + "/" + cid).set({ at: Date.now(), nonce: nonce() }); } catch {}
}
async function inboxSignal(db, uids) {
  const list = [...new Set(uids)].filter(isValidKey);
  if (!list.length) return;
  const at = Date.now();
  try { await db.ref().update(Object.fromEntries(list.map((uid) => [P.inbox + "/" + uid, { at, nonce: nonce() }]))); } catch {}
}

// Journal des opérations sensibles (paiements, modération, litiges).
async function audit(db, actorUid, action, details = {}) {
  try {
    await db.ref(P.audit).push({ at: Date.now(), actor: actorUid || "", action, ...details });
  } catch { /* le journal ne bloque jamais l'opération elle-même */ }
}

async function getProfile(db, uid) {
  if (!isValidKey(uid)) return null;
  return read(db, P.profiles + "/" + uid);
}

async function requireProfile(db, user) {
  const profile = await getProfile(db, user.uid);
  if (!profile || !profile.handle) fail(409, "Créez d'abord votre profil Asrar-chat.");
  return profile;
}

async function assertNotSuspended(db, uid) {
  if (await read(db, P.suspended + "/" + uid)) fail(403, "Votre compte Asrar-chat est suspendu. Contactez l'administration.");
}

async function isBlocked(db, ownerUid, otherUid) {
  return !!(await read(db, `${P.blocks}/${ownerUid}/${otherUid}`));
}

/** Carte publique d'un profil (jamais l'e-mail ni les coordonnées privées). */
function publicProfile(uid, p, { includePayment = false } = {}) {
  if (!p) return null;
  const out = {
    uid,
    handle: p.handle || "",
    displayName: p.displayName || "",
    bio: p.bio || "",
    photo: p.photo || "",
    seller: !!(p.seller && p.seller.enabled),
    verified: !!p.verified,
  };
  if (p.stats) out.stats = { posts: Number(p.stats.posts) || 0, sales: Number(p.stats.sales) || 0 };
  if (includePayment && p.seller && p.seller.enabled) {
    out.payment = {
      waveLink: p.seller.waveLink || "",
      wavePhone: p.seller.wavePhone || "",
      pispiAlias: p.seller.pispiAlias || "",
      whatsapp: p.seller.whatsapp || "",
    };
  }
  return out;
}

async function profilesByUid(db, uids) {
  const list = [...new Set(uids)].filter(isValidKey);
  const entries = await Promise.all(list.map(async (uid) => [uid, publicProfile(uid, await getProfile(db, uid))]));
  return Object.fromEntries(entries.filter(([, p]) => p));
}

module.exports = {
  P, fail, key, read, signal, inboxSignal, audit, getProfile, requireProfile,
  assertNotSuspended, isBlocked, publicProfile, profilesByUid,
};
