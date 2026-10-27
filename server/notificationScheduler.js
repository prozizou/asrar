const { waitUntil } = require("@vercel/functions");
const { processNotificationQueue } = require("./notificationWorker");
const { reportError } = require("./log");

// Vercel prolonge l'exécution après la réponse HTTP. Le cron reprend les
// tâches interrompues. En local/tests, le worker est lancé explicitement.
function scheduleNotifications(db) {
  if (process.env.VERCEL !== "1") return;
  waitUntil(processNotificationQueue(db).catch((error) => reportError("notification-worker", error)));
}

module.exports = { scheduleNotifications };
