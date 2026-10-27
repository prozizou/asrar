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
const { setCors, parseBody, isValidKey } = require("../../server/http");
const { MAX_PER_USER } = require("../../server/notificationStore");
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
      // Le badge est dérivé des mêmes documents que la liste (200 maximum),
      // sans compteur séparé susceptible de diverger après une panne/purge.
      const listSnap = await base.orderByChild("createdAt").limitToLast(MAX_PER_USER).once("value");
      const items = [];
      listSnap.forEach((c) => { items.push({ id: c.key, ...c.val() }); });
      items.reverse(); // limitToLast renvoie du plus ancien au plus récent → on veut l'inverse
      return res.status(200).json({ items: items.slice(0, LIST_LIMIT), unread: items.filter((item) => item.read !== true).length });
    }

    if (action === "markRead") {
      if (!isValidKey(notifId)) return res.status(400).json({ error: "Identifiant de notification invalide." });
      const ref = base.child(notifId);
      const snap = await ref.once("value");
      if (!snap.exists()) return res.status(404).json({ error: "Notification introuvable." });
      await ref.transaction((item) => item ? { ...item, read: true } : null);
      return res.status(200).json({ ok: true });
    }

    if (action === "markAllRead") {
      await base.transaction((items) => {
        if (!items) return null;
        return Object.fromEntries(Object.entries(items).map(([key, item]) => [key, { ...item, read: true }]));
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Action inconnue." });
  } catch (e) {
    await reportError("notifications", e, { uid: user.uid, action });
    return res.status(500).json({ error: e.message });
  }
}
