const { app } = require("../../server/grant");
const { verifyUser, getAccessStatus, isAdmin } = require("../../server/access");
const { setCors, parseBody } = require("../../server/http");
const { rateLimit } = require("../../lib/rateLimit");
const { reportError } = require("../../server/log");
const { accountSummary, availableExport, requestPrivacy } = require("../../server/accountData");

export default async function handler(req, res) {
  setCors(req, res); res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée." });
  const body = parseBody(req);
  let user;
  try { user = await verifyUser(body.idToken); }
  catch (error) { return res.status(error.statusCode || 401).json({ error: error.message }); }
  if (!rateLimit("account:" + user.uid, 30, 60000)) return res.status(429).json({ error: "Trop de demandes. Patientez une minute." });
  try {
    const admin = app(), db = admin.database(), action = body.action || "summary";
    let token;
    try { token = await admin.auth().verifyIdToken(body.idToken, true); }
    catch { return res.status(401).json({ error: "Reconnectez-vous pour accéder à votre compte.", code: "RECENT_LOGIN_REQUIRED" }); }
    if (["export", "request-privacy"].includes(action)) {
      if (!Number.isFinite(token.auth_time) || Date.now() / 1000 - token.auth_time > 900) {
        return res.status(401).json({ error: "Reconnectez-vous pour confirmer cette action sur vos données.", code: "RECENT_LOGIN_REQUIRED" });
      }
    }
    if (action === "summary" || action === "export") {
      const [account, access] = await Promise.all([admin.auth().getUser(user.uid), getAccessStatus(user)]);
      const summary = await accountSummary(db, user, account, access);
      return res.json(action === "export" ? await availableExport(db, user, summary) : summary);
    }
    if (action === "profile") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || name.length > 80 || /[\u0000-\u001f]/.test(name)) return res.status(400).json({ error: "Indiquez un nom de 1 à 80 caractères." });
      await admin.auth().updateUser(user.uid, { displayName: name });
      return res.json({ ok: true });
    }
    if (["privacy-list", "privacy-update"].includes(action)) {
      if (!(await isAdmin(user))) return res.status(403).json({ error: "Accès administrateur requis." });
      if (action === "privacy-list") {
        const snap = await db.ref("privacy_requests").orderByChild("status").startAt("pending").endAt("processing").limitToFirst(50).once("value");
        const items = []; snap.forEach((child) => { items.push(child.val()); });
        return res.json({ items });
      }
      const { isValidKey } = require("../../server/http");
      if (!isValidKey(body.uid) || !["processing", "completed", "rejected"].includes(body.status) ||
          typeof body.note !== "string" || body.note.trim().length < 3 || body.note.length > 1000) {
        return res.status(400).json({ error: "Indiquez une réponse et un statut valides." });
      }
      const tx = await db.ref("privacy_requests/" + body.uid).transaction((current) => {
        if (!current) return null;
        if (!["pending", "processing"].includes(current.status)) return;
        return { ...current, status: body.status, response: body.note.trim(), processedBy: user.uid, updatedAt: Date.now() };
      });
      return res.status(tx.committed && tx.snapshot.exists() ? 200 : 409).json({ ok: tx.committed && tx.snapshot.exists() });
    }
    if (action === "settings") {
      if (typeof body.analytics !== "boolean" || typeof body.pushEnabled !== "boolean") return res.status(400).json({ error: "Réglages invalides." });
      await db.ref().update({ ["account_settings/" + user.uid]: { analytics: body.analytics, pushEnabled: body.pushEnabled, updatedAt: Date.now() },
        ...(!body.pushEnabled ? { ["push_subscriptions/" + user.uid]: null, ["fcm_devices/" + user.uid]: null } : {}) });
      return res.json({ ok: true });
    }
    if (action === "request-privacy") return res.json({ request: await requestPrivacy(db, user, body.kind) });
    return res.status(400).json({ error: "Action inconnue." });
  } catch (error) {
    await reportError("account", error, { uid: user.uid });
    return res.status(error.statusCode || 503).json({ error: error.statusCode ? error.message : "Vos données sont temporairement indisponibles. Réessayez dans un instant." });
  }
}
