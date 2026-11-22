// server/bugReports.js — Enregistrement des bugs et lenteurs remontés par
// l'application (pages/api/client-error.js), lus par le panneau
// d'administration (onglet « Bugs », api/bugs.js d'admin-asrar-pro).
//
// Arborescence (serveur uniquement, règles RTDB read/write:false) :
//   bug_reports/groups/{empreinte}         un bug regroupé (compteurs, dernier contexte)
//   bug_reports/events/{empreinte}/{id}    ses dernières occurrences (au plus MAX_EVENTS)
//   bug_reports/daily/{AAAA-MM-JJ}         { _n, error, lag, user } — plafond et courbe
//
// Un bug marqué « résolu » par l'administration qui se reproduit repasse en
// « ouvert » avec regressed:true : une correction incomplète se voit tout de suite.

const { fingerprintOf, versionKey } = require("../lib/bugReport");

const DAILY_CAP = 5000;  // occurrences enregistrées par jour, au-delà : ignorées
const MAX_EVENTS = 20;   // occurrences détaillées gardées par bug

/**
 * @param {any} db base Admin SDK
 * @param {ReturnType<import('../lib/bugReport').sanitizeReport>[]} reports rapports déjà validés
 * @param {{platform: string, uid?: string, email?: string, now?: number}} ctx
 * @returns {Promise<number>} nombre d'occurrences enregistrées
 */
async function recordBugReports(db, reports, ctx) {
  if (!reports.length) return 0;
  const now = ctx.now || Date.now();
  const date = new Date(now).toISOString().slice(0, 10);

  const cap = await db.ref("bug_reports/daily/" + date).transaction((day) => {
    const d = day || {};
    if ((d._n || 0) >= DAILY_CAP) return; // abandon : plafond du jour atteint
    const next = { ...d, _n: (d._n || 0) + reports.length };
    for (const r of reports) next[r.kind] = (next[r.kind] || 0) + 1;
    return next;
  });
  if (!cap.committed) return 0;

  for (const r of reports) {
    const event = db.ref("bug_reports/events").push();
    const fp = fingerprintOf(r, event.key);
    await db.ref("bug_reports/groups/" + fp).transaction((g) => {
      const group = g || {
        kind: r.kind, message: r.message, label: r.label || "", page: r.page,
        firstAt: now, count: 0, status: "open",
      };
      group.count = (group.count || 0) + 1;
      group.lastAt = now;
      group.lastPage = r.page;
      if (r.stack) group.stack = r.stack;
      if (r.detail) group.detail = r.detail;
      if (r.version) group.lastVersion = r.version;
      if (r.durationMs) {
        group.maxMs = Math.max(group.maxMs || 0, r.durationMs);
        group.sumMs = (group.sumMs || 0) + r.durationMs;
      }
      group.platforms = { ...(group.platforms || {}) };
      group.platforms[ctx.platform] = (group.platforms[ctx.platform] || 0) + 1;
      group.versions = { ...(group.versions || {}) };
      const vk = versionKey(r.version);
      group.versions[vk] = (group.versions[vk] || 0) + 1;
      if (ctx.email && !group.reporter) group.reporter = ctx.email;
      if (group.status === "resolved") {
        group.status = "open";
        group.regressed = true;
        delete group.resolvedAt;
      }
      return group;
    });

    const occurrence = { at: now, page: r.page, platform: ctx.platform };
    if (r.version) occurrence.version = r.version;
    if (r.durationMs) occurrence.durationMs = r.durationMs;
    if (r.detail) occurrence.detail = r.detail;
    if (r.label) occurrence.label = r.label;
    if (r.stack && r.kind !== "lag") occurrence.stack = r.stack.slice(0, 1500);
    if (ctx.uid) occurrence.uid = ctx.uid;
    if (ctx.email) occurrence.email = ctx.email;
    await db.ref("bug_reports/events/" + fp + "/" + event.key).set(occurrence);
    await trimEvents(db, fp);
  }
  return reports.length;
}

// Ne garde que les MAX_EVENTS occurrences les plus récentes (clés push triées
// dans l'ordre chronologique).
async function trimEvents(db, fp) {
  const snap = await db.ref("bug_reports/events/" + fp).orderByKey().once("value");
  const keys = Object.keys(snap.val() || {}).sort();
  const extra = keys.slice(0, Math.max(0, keys.length - MAX_EVENTS));
  if (!extra.length) return;
  await db.ref("bug_reports/events/" + fp).update(Object.fromEntries(extra.map((k) => [k, null])));
}

module.exports = { recordBugReports, DAILY_CAP, MAX_EVENTS };
