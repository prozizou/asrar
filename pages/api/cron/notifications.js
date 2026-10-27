const { app } = require("../../../server/grant");
const { authorized } = require("../../../server/cronAuth");
const { processNotificationQueue } = require("../../../server/notificationWorker");
const { reportError } = require("../../../server/log");

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (!authorized(req)) return res.status(401).json({ error: "Non autorisé." });
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ error: "Méthode non autorisée." });
  res.setHeader("Cache-Control", "no-store");
  try {
    const stats = await processNotificationQueue(app().database());
    return res.status(200).json({ ok: true, ...stats });
  } catch (error) {
    await reportError("cron:notifications", error);
    return res.status(500).json({ error: "Traitement des notifications indisponible." });
  }
}
