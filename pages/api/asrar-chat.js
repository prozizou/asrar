// pages/api/asrar-chat.js — Point d'entrée UNIQUE d'Asrar-chat (messagerie
// sociale et commerciale). POST { idToken, action, ... }. Toute la logique et
// tous les contrôles d'accès vivent côté serveur (server/asrarChat/*) ; le
// navigateur ne lit en direct que des signaux sans contenu.
// Architecture détaillée : ASRAR_CHAT.md.
const { verifyUser, isAdmin: checkAdmin } = require("../../server/access");
const { app } = require("../../server/grant");
const { setCors, parseBody } = require("../../server/http");
const { rateLimit } = require("../../lib/rateLimit");
const { reportError } = require("../../server/log");
const { P, read, getProfile, publicProfile } = require("../../server/asrarChat/core");
const media = require("../../server/asrarChat/media");
const profiles = require("../../server/asrarChat/profiles");
const chat = require("../../server/asrarChat/chat");
const posts = require("../../server/asrarChat/posts");
const orders = require("../../server/asrarChat/orders");
const moderation = require("../../server/asrarChat/moderation");

// Lectures fréquentes (sondage, ouverture d'écrans) : larges. Écritures :
// serrées. Paiements et signalements : très serrées.
const LIMITS = {
  read: { max: 240, windowMs: 60_000 },
  write: { max: 40, windowMs: 60_000 },
  send: { max: 30, windowMs: 60_000 },
  upload: { max: 20, windowMs: 60_000 },
  money: { max: 12, windowMs: 60_000 },
  report: { max: 10, windowMs: 3_600_000 },
};

// action → [famille de limite, gestionnaire(db, user, body, isAdmin)]
const ACTIONS = {
  me: ["read", me],
  "upload.sign": ["upload", signUpload],
  "profile.save": ["write", (db, u, b) => profiles.saveProfile(db, u, b)],
  "profile.get": ["read", (db, u, b) => profiles.getPublicProfile(db, u, b)],
  "seller.save": ["write", (db, u, b) => profiles.saveSeller(db, u, b)],
  "block.set": ["write", (db, u, b) => profiles.setBlock(db, u, b)],
  "block.list": ["read", (db, u) => profiles.listBlocked(db, u)],

  "conv.list": ["read", (db, u) => chat.listConvs(db, u)],
  "conv.get": ["read", (db, u, b) => chat.getConv(db, u, b)],
  "conv.dm": ["write", (db, u, b) => chat.openDm(db, u, b)],
  "conv.create": ["write", (db, u, b) => chat.createConv(db, u, b)],
  "conv.join": ["write", (db, u, b) => chat.joinConv(db, u, b)],
  "conv.leave": ["write", (db, u, b) => chat.leaveConv(db, u, b)],
  "conv.update": ["write", (db, u, b) => chat.updateConv(db, u, b)],
  "conv.members": ["read", (db, u, b) => chat.listMembers(db, u, b)],
  "conv.role": ["write", (db, u, b) => chat.setMemberRole(db, u, b)],
  "conv.remove": ["write", (db, u, b) => chat.removeMember(db, u, b)],
  "conv.mute": ["write", (db, u, b) => chat.setMuted(db, u, b)],
  "msg.list": ["read", (db, u, b, admin) => chat.listMessages(db, u, b, (d, pid, uid) => posts.postCard(d, pid, uid, admin))],
  "msg.send": ["send", (db, u, b) => chat.sendMessage(db, u, b)],
  "msg.edit": ["write", (db, u, b) => chat.mutateMessage(db, u, b, "edit")],
  "msg.delete": ["write", (db, u, b) => chat.mutateMessage(db, u, b, "delete")],
  "msg.react": ["write", (db, u, b) => chat.mutateMessage(db, u, b, "react")],
  "msg.forward": ["send", (db, u, b) => chat.forwardMessage(db, u, b)],
  "msg.read": ["read", (db, u, b) => chat.markRead(db, u, b)],

  "post.save": ["write", (db, u, b, admin) => posts.savePost(db, u, b, admin)],
  "post.delete": ["write", (db, u, b, admin) => posts.deletePost(db, u, b, admin)],
  "post.open": ["read", (db, u, b, admin) => posts.openPost(db, u, b, admin)],
  "post.mine": ["read", (db, u) => posts.myPosts(db, u)],
  "post.favorite": ["write", (db, u, b) => posts.toggleFavorite(db, u, b)],
  "post.favorites": ["read", (db, u) => posts.listFavorites(db, u)],
  "post.rate": ["write", (db, u, b) => posts.ratePost(db, u, b)],
  "explore.posts": ["read", (db, u, b) => posts.explore(db, u, b)],
  "explore.sellers": ["read", (db, u, b) => posts.exploreSellers(db, u, b)],
  "explore.convs": ["read", (db, u, b) => posts.exploreConvs(db, u, b)],
  "explore.users": ["read", (db, u, b) => posts.searchUsers(db, u, b)],
  storefront: ["read", (db, u, b) => posts.storefront(db, u, b)],

  "order.create": ["money", (db, u, b) => orders.createOrder(db, u, b)],
  "order.declare": ["money", (db, u, b) => orders.declarePaid(db, u, b)],
  "order.confirm": ["money", (db, u, b, admin) => orders.confirmPaid(db, u, b, admin)],
  "order.reject": ["money", (db, u, b, admin) => orders.rejectPaid(db, u, b, admin)],
  "order.cancel": ["money", (db, u, b, admin) => orders.cancelOrder(db, u, b, admin)],
  "order.dispute": ["money", (db, u, b) => orders.openDispute(db, u, b)],
  "order.refund": ["money", (db, u, b, admin) => orders.refundOrder(db, u, b, admin)],
  "order.resolve": ["money", (db, u, b, admin) => orders.resolveDispute(db, u, b, admin)],
  "order.get": ["read", (db, u, b, admin) => orders.getOrder(db, u, b, admin)],
  "order.mine": ["read", (db, u) => orders.myOrders(db, u)],
  "order.sales": ["read", (db, u) => orders.sales(db, u)],
  library: ["read", (db, u) => orders.library(db, u)],

  report: ["report", (db, u, b) => moderation.report(db, u, b)],
  "admin.overview": ["read", (db, u, b, admin) => moderation.adminOverview(db, u, admin)],
  "admin.reports": ["read", (db, u, b, admin) => moderation.adminReports(db, u, b, admin)],
  "admin.resolveReport": ["write", (db, u, b, admin) => moderation.resolveReport(db, u, b, admin)],
  "admin.suspend": ["write", (db, u, b, admin) => moderation.setSuspended(db, u, b, admin)],
  "admin.commission": ["write", (db, u, b, admin) => moderation.setCommission(db, u, b, admin)],
  "admin.orders": ["read", (db, u, b, admin) => moderation.adminOrders(db, u, b, admin)],
  "admin.users": ["read", (db, u, b, admin) => moderation.adminUsers(db, u, b, admin)],
  "admin.audit": ["read", (db, u, b, admin) => moderation.adminAudit(db, u, admin)],
};

// Actions qui n'ont pas besoin du statut administrateur (évite une lecture).
const NEEDS_ADMIN = (action) => action === "me" || action.startsWith("admin.") || action.startsWith("order.") || action.startsWith("post.") || action === "msg.list";

async function me(db, user, body, isAdmin) {
  const p = await getProfile(db, user.uid);
  const suspended = !!(await read(db, P.suspended + "/" + user.uid));
  return {
    uid: user.uid,
    profile: p && p.handle ? publicProfile(user.uid, p, { includePayment: true }) : null,
    isAdmin,
    suspended,
  };
}

async function signUpload(db, user, body) {
  const visibility = body.visibility === "public" ? "public" : "private";
  const rt = ["image", "video", "raw"].includes(body.rt) ? body.rt : "";
  if (!rt) throw Object.assign(new Error("Type de fichier non autorisé."), { statusCode: 400 });
  if (visibility === "public" && rt !== "image") throw Object.assign(new Error("Seules les images peuvent être publiques."), { statusCode: 400 });
  if (await read(db, P.suspended + "/" + user.uid)) throw Object.assign(new Error("Compte suspendu."), { statusCode: 403 });
  return media.signUpload(user.uid, visibility, rt);
}

export default async function handler(req, res) {
  setCors(req, res);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const body = parseBody(req);
  const action = String(body.action || "");
  const entry = Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : null;
  if (!entry) return res.status(400).json({ error: "Action inconnue." });

  let user;
  try { user = await verifyUser(body.idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  const [family, run] = entry;
  const limit = LIMITS[family];
  if (!rateLimit("ac:" + family + ":" + user.uid, limit.max, limit.windowMs)) {
    return res.status(429).json({ error: "Trop de requêtes. Réessayez dans un instant." });
  }

  const db = app().database();
  try {
    const admin = NEEDS_ADMIN(action) ? await checkAdmin(user) : false;
    const result = await run(db, user, body, admin);
    return res.status(200).json(result || { ok: true });
  } catch (e) {
    if (!e.statusCode) await reportError("asrar-chat", e, { action, uid: user.uid });
    return res.status(e.statusCode || 500).json({ error: e.statusCode ? e.message : "Erreur serveur. Réessayez.", ...(e.code ? { code: e.code } : {}) });
  }
}
