const crypto = require("crypto");

// Valeur exclue par la requête du worker (startAt(0)).
const TERMINAL_TIME = -1;
const PAGE_SIZE = 20;
const MAX_ATTEMPTS = 5;
const LEASE_MS = 180000;

const eventKey = (value) => crypto.createHash("sha256").update(value).digest("hex");

function prepareNotification(audience, notif, eventId = crypto.randomUUID()) {
  if (!notif || typeof notif.title !== "string" || typeof notif.body !== "string" ||
      typeof notif.type !== "string" || typeof notif.targetUrl !== "string" ||
      !notif.targetUrl.startsWith("/") || notif.targetUrl.startsWith("//")) {
    throw new Error("Notification invalide.");
  }
  const now = Date.now();
  return {
    id: eventKey(eventId),
    value: {
      kind: "fanout", status: "queued", attempts: 0, availableAt: now, createdAt: now,
      audience, cursor: null,
      notification: {
        type: notif.type, title: notif.title, body: notif.body,
        senderName: notif.senderName || null, targetUrl: notif.targetUrl,
        createdAt: now, read: false, ...(notif.meta ? { meta: notif.meta } : {}),
        ...(Number.isFinite(notif.expiresAt) ? { expiresAt: notif.expiresAt } : {}),
      },
    },
  };
}

async function enqueueNotification(db, audience, notif, eventId) {
  const job = prepareNotification(audience, notif, eventId);
  // Une nouvelle tentative du même événement ne réinitialise jamais une
  // tâche louée, terminée ou partiellement livrée.
  await db.ref(`notification_jobs/${job.id}`).transaction((current) => current || job.value);
  return job.id;
}

async function claimJob(db, id, now = Date.now()) {
  const owner = crypto.randomUUID();
  const tx = await db.ref(`notification_jobs/${id}`).transaction((job) => {
    if (!job) return null;
    if (!["queued", "retry", "processing"].includes(job.status) || job.availableAt > now) return;
    return { ...job, status: "processing", owner, availableAt: now + LEASE_MS,
      attempts: (job.attempts || 0) + 1, startedAt: now };
  });
  const job = tx.snapshot.val();
  return tx.committed && job?.owner === owner ? { id, ...job } : null;
}

async function updateOwned(db, id, owner, update) {
  const tx = await db.ref(`notification_jobs/${id}`).transaction((job) => {
    if (!job) return null;
    if (job.status !== "processing" || job.owner !== owner) return;
    return update(job);
  });
  const result = tx.snapshot.val();
  if (!tx.committed || !result) throw Object.assign(new Error("Bail de notification perdu."), { code: "LEASE_LOST" });
  return result;
}

async function ackDelivery(db, job, channel, key) {
  await updateOwned(db, job.id, job.owner, (current) => ({
    ...current,
    progress: channel === "inApp" ? { ...current.progress, inApp: true } : {
      ...current.progress, [channel]: { ...current.progress?.[channel], [key]: true },
    },
  }));
}

async function failDevice(db, job, channel, key, error, now) {
  return updateOwned(db, job.id, job.owner, (current) => {
    const failures = current.progress?.failures || {};
    const attempts = (failures[channel]?.[key]?.attempts || 0) + 1;
    return { ...current, progress: { ...current.progress, failures: {
      ...failures, [channel]: { ...failures[channel], [key]: {
        attempts, availableAt: now + Math.min(3600000, 60000 * 2 ** (attempts - 1)),
        code: String(error?.errorInfo?.code || error?.code || error?.statusCode || "DELIVERY_ERROR").slice(0, 100),
      } },
    } } };
  });
}

async function expandAudience(db, job, now = Date.now()) {
  let uids, more;
  if (job.audience.type === "all") {
    let query = db.ref("user_sessions").orderByKey();
    if (job.cursor) query = query.startAfter(job.cursor);
    const snap = await query.limitToFirst(PAGE_SIZE + 1).once("value");
    const keys = [];
    snap.forEach((child) => { keys.push(child.key); });
    more = keys.length > PAGE_SIZE;
    uids = keys.slice(0, PAGE_SIZE);
  } else {
    const start = Number(job.cursor) || 0;
    uids = job.audience.uids.slice(start, start + PAGE_SIZE);
    more = start + uids.length < job.audience.uids.length;
  }
  // Petits lots, pas un Promise.all sur l'annuaire entier.
  for (const uid of uids) {
    const id = eventKey(`${job.id}:${uid}`);
    await db.ref(`notification_jobs/${id}`).transaction((current) => current || {
      kind: "delivery", uid, notificationId: job.id, notification: job.notification,
      status: "queued", attempts: 0, availableAt: now, createdAt: job.createdAt,
    });
  }
  await updateOwned(db, job.id, job.owner, (current) => ({
    ...current, status: more ? "queued" : "completed", owner: null, attempts: 0,
    availableAt: more ? now : TERMINAL_TIME,
    ...(more ? {} : { finishedAt: now }),
    cursor: job.audience.type === "all" ? uids.at(-1) || job.cursor : (Number(job.cursor) || 0) + uids.length,
  }));
  return { completed: !more };
}

async function retryJob(db, job, error, now = Date.now()) {
  const dead = job.attempts >= MAX_ATTEMPTS;
  const delay = Math.min(3600000, 60000 * 2 ** Math.max(0, job.attempts - 1));
  await updateOwned(db, job.id, job.owner, (current) => ({
    ...current, owner: null, status: dead ? "dead" : "retry",
    availableAt: dead ? TERMINAL_TIME : now + delay,
    lastError: { code: String(error?.code || error?.statusCode || "DELIVERY_ERROR").slice(0, 100), at: now },
    ...(dead ? { finishedAt: now } : {}),
  }));
  return dead;
}

async function retryDeadJob(db, id) {
  const tx = await db.ref(`notification_jobs/${id}`).transaction((job) => {
    if (!job) return null;
    if (job.status !== "dead") return;
    return { ...job, status: "queued", availableAt: Date.now(), attempts: 0, finishedAt: null, lastError: null,
      ...(job.progress ? { progress: { ...job.progress, failures: null } } : {}) };
  });
  return !!tx.committed && tx.snapshot.val()?.status === "queued";
}

module.exports = { prepareNotification, enqueueNotification, claimJob, updateOwned, ackDelivery, failDevice,
  expandAudience, retryJob, retryDeadJob, TERMINAL_TIME, MAX_ATTEMPTS, PAGE_SIZE, LEASE_MS };
