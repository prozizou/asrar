const { isValidKey } = require("./http");
const { retryDeadJob } = require("./notificationQueue");
const { scheduleNotifications } = require("./notificationScheduler");

function summary(snapshot) {
  const jobs = [];
  snapshot.forEach((child) => {
    const value = child.val();
    const failedDevices = ["web", "fcm"].reduce((count, channel) => count + Object.entries(value.progress?.failures?.[channel] || {})
      .filter(([key]) => !value.progress?.[channel]?.[key]).length, 0);
    jobs.push({ id: child.key, kind: value.kind, status: value.status,
      attempts: value.attempts || 0, createdAt: value.createdAt,
      availableAt: value.availableAt, lastError: value.lastError || null, failedDevices });
  });
  return jobs;
}

async function notificationHealth(db) {
  const [health, recent, dead] = await Promise.all([
    db.ref("cron_health/notifications").once("value"),
    db.ref("notification_jobs").orderByChild("createdAt").limitToLast(25).once("value"),
    db.ref("notification_jobs").orderByChild("status").equalTo("dead").limitToFirst(25).once("value"),
  ]);
  return { health: health.val(), jobs: summary(recent), deadJobs: summary(dead) };
}

async function retryNotification(db, id) {
  if (!isValidKey(id)) return { status: 400, error: "Identifiant de tâche invalide." };
  if (!(await retryDeadJob(db, id))) return { status: 409, error: "Seule une tâche en échec définitif peut être relancée." };
  scheduleNotifications(db);
  return { status: 200 };
}

module.exports = { notificationHealth, retryNotification };
