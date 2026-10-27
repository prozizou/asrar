// Producteurs : persistance rapide dans la file, jamais de diffusion massive
// dans la requête utilisateur. Le worker gère les envois et les reprises.
const { enqueueNotification, prepareNotification } = require("./notificationQueue");
const { scheduleNotifications } = require("./notificationScheduler");
const { MAX_PER_USER } = require("./notificationStore");

function userAudience(uids) {
  return { type: "users", uids: [...new Set(uids)].filter(Boolean).sort() };
}

async function notifyUsers(db, uids, notif, options = {}) {
  const audience = userAudience(uids);
  if (!audience.uids.length) return null;
  const id = await enqueueNotification(db, audience, notif, options.eventId);
  scheduleNotifications(db);
  return id;
}

async function notifyAllUsers(db, notif, options = {}) {
  // L'annuaire n'est lu que par pages par le worker.
  const id = await enqueueNotification(db, { type: "all" }, notif, options.eventId);
  scheduleNotifications(db);
  return id;
}

// Création de documents à clé fraîche : contenu et tâche partagent une
// écriture Firebase atomique. Réservé à ces créations, pas aux rééditions.
async function publishAndNotify(db, path, record, notif, options) {
  const audience = options.uids ? userAudience(options.uids) : { type: "all" };
  const job = prepareNotification(audience, notif, options.eventId);
  const updates = Object.fromEntries(Object.entries(record).map(([key, value]) => [`${path}/${key}`, value]));
  updates[`notification_jobs/${job.id}`] = job.value;
  await db.ref().update(updates);
  scheduleNotifications(db);
  return job.id;
}

module.exports = { notifyUsers, notifyAllUsers, publishAndNotify, MAX_PER_USER };
