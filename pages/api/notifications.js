// api/notifications.js — Centre de notifications de l'utilisateur connecté :
// liste, marquage lu (un ou tous). L'ÉCRITURE (création d'une notification)
// ne passe jamais par ici — elle vient de server/notify.js, appelé depuis les
// trois déclencheurs (pages/api/admin.js save-secret/save-book,
// pages/api/zikr.js notifyNewMessage) : cet endpoint est en LECTURE/ACQUIT
// seul, jamais de création côté client.
//
// Body (JSON) : { idToken, action, notifId? }
//   action="list"        → { items: [...50 plus récentes, plus récente en tête], unread }
//   action="markRead"    → { notifId } — idempotent (déjà lu = no-op)
//   action="markAllRead" → toutes les notifications non lues de l'utilisateur

const { verifyUser } = require("../../server/access");
const { app } = require("../../server/grant");
const { setCors, parseBody } = require("../../server/http");
const { rateLimit } = require("../../lib/rateLimit");
const { reportError } = require("../../server/log");

const RATE_LIMIT = { max: 60, windowMs: 60_000 }; // sondé régulièrement par le client (badge + centre ouvert)
const LIST_LIMIT = 50;

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken, action, notifId } = parseBody(req);

  let user;
  try { user = await verifyUser(idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  if (!rateLimit("notifications:" + user.uid, RATE_LIMIT.max, RATE_LIMIT.windowMs)) {
    return res.status(429).json({ error: "Trop de requêtes, réessayez dans une minute." });
  }

  const db = app().database();
  const base = db.ref("notifications/" + user.uid);

  try {
    if (action === "list") {
      const [listSnap, unreadSnap] = await Promise.all([
        base.orderByChild("createdAt").limitToLast(LIST_LIMIT).once("value"),
        db.ref("notifications_meta/" + user.uid + "/unread").once("value"),
      ]);
      const items = [];
      listSnap.forEach((c) => items.push({ id: c.key, ...c.val() }));
      items.reverse(); // limitToLast renvoie du plus ancien au plus récent → on veut l'inverse
      return res.status(200).json({ items, unread: Math.max(0, unreadSnap.val() || 0) });
    }

    if (action === "markRead") {
      if (!notifId) return res.status(400).json({ error: "notifId requis." });
      const ref = base.child(notifId);
      const snap = await ref.once("value");
      if (!snap.exists()) return res.status(404).json({ error: "Notification introuvable." });
      if (snap.val().read !== true) {
        await ref.update({ read: true });
        await db.ref("notifications_meta/" + user.uid + "/unread")
          .transaction((c) => Math.max(0, (c || 0) - 1));
      }
      return res.status(200).json({ ok: true });
    }

    if (action === "markAllRead") {
      const snap = await base.orderByChild("read").equalTo(false).once("value");
      const updates = {};
      snap.forEach((c) => { updates[c.key + "/read"] = true; });
      if (Object.keys(updates).length > 0) await base.update(updates);
      await db.ref("notifications_meta/" + user.uid + "/unread").set(0);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Action inconnue." });
  } catch (e) {
    await reportError("notifications", e, { uid: user.uid, action });
    return res.status(500).json({ error: e.message });
  }
}
