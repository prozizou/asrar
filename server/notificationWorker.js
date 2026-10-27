const { claimJob, expandAudience, updateOwned, retryJob, TERMINAL_TIME } = require("./notificationQueue");
const { deliverNotification, mapBounded } = require("./notificationTransport");
const { reportError } = require("./log");

async function cleanupNotificationJobs(db, now) {
  const cutoff = now - 30 * 86400000;
  const snap = await db.ref("notification_jobs").orderByChild("finishedAt")
    .startAt(1).endAt(cutoff).limitToFirst(50).once("value");
  const ids = [];
  snap.forEach((child) => { ids.push(child.key); });
  await mapBounded(ids, 4, (id) => db.ref(`notification_jobs/${id}`).transaction((job) => {
    // Une relance administrateur concurrente doit conserver sa tâche.
    if (!job) return null;
    if (["completed", "dead"].includes(job.status) && job.finishedAt > 0 && job.finishedAt <= cutoff) return null;
    return;
  }));
}

async function processNotificationQueue(db, options = {}) {
  const now = options.now || Date.now;
  const deliver = options.deliver || deliverNotification;
  const deadline = now() + (options.budgetMs || 35000);
  const maxJobs = options.maxJobs || 40;
  const stats = { processed: 0, completed: 0, retried: 0, dead: 0, busy: 0 };
  while (stats.processed < maxJobs && now() < deadline) {
    const snap = await db.ref("notification_jobs").orderByChild("availableAt")
      .startAt(0).endAt(now()).limitToFirst(Math.min(4, maxJobs - stats.processed)).once("value");
    const ids = [];
    snap.forEach((child) => { ids.push(child.key); });
    if (!ids.length) break;
    const processedBefore = stats.processed;
    await mapBounded(ids, 4, async (id) => {
      const job = await claimJob(db, id, now());
      if (!job) { stats.busy++; return; }
      stats.processed++;
      try {
        if (job.kind === "fanout") await expandAudience(db, job, now());
        else if (job.kind === "delivery") {
          const result = await deliver(db, job);
          await updateOwned(db, job.id, job.owner, (current) => ({
            ...current, status: result?.pending ? "queued" : "completed", owner: null,
            availableAt: result?.pending ? now() : TERMINAL_TIME,
            ...(result?.pending ? { attempts: 0 } : { finishedAt: now() }),
          }));
          if (!result?.pending) stats.completed++;
        } else throw Object.assign(new Error("Type de tâche inconnu."), { code: "INVALID_JOB" });
      } catch (error) {
        if (error?.code === "LEASE_LOST") { stats.busy++; return; }
        if (await retryJob(db, job, error, now())) stats.dead++;
        else stats.retried++;
      }
    });
    if (stats.processed === processedBefore) break;
  }
  await cleanupNotificationJobs(db, now());
  await db.ref("cron_health/notifications").set({ at: now(), ...stats });
  if (stats.dead) await reportError("notification-worker:dead", new Error("Notifications en échec définitif."), { count: stats.dead });
  return stats;
}

module.exports = { processNotificationQueue, cleanupNotificationJobs };
