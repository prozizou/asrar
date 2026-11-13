// pages/api/visio.js — Visioconférences Google Meet proposées par les
// utilisateurs et validées par l'administration (même principe que le Zikr
// collectif : approved:false à la création, l'administrateur approuve ou
// refuse).
//
// Données : visio_meetings/{id} = { title, description, meetUrl, startAt,
// durationMin, approved, ownerUid, ownerName, ownerEmail, createdAt }.
// Écritures uniquement par cette API (Admin SDK, règles RTDB fermées).
//
// POST, idToken requis :
//   action="list"    → { meetings, isAdmin } : réunions approuvées et non
//                      terminées pour tous ; en plus, ses propres réunions en
//                      attente ; l'administrateur voit tout (file de
//                      modération). Le lien Meet n'est jamais renvoyé pour une
//                      réunion en attente à un autre compte que son créateur.
//   action="create"  → { title, description?, meetUrl, startAt, durationMin }
//                      → { ok, id } : en attente de validation.
//   action="update"  → { meetingId, ...mêmes champs } : créateur ou admin.
//                      Modifiée par son créateur, une réunion repasse en
//                      attente (le lien diffusé à tous est toujours validé).
//   action="delete"  → { meetingId } : créateur ou admin. Une réunion en
//                      attente supprimée par l'admin = refus (créateur averti).
//   action="approve" → { meetingId } : admin. Diffuse la notification à tous.
const { verifyUser, isAdmin } = require("../../server/access");
const { app } = require("../../server/grant");
const { setCors, parseBody, isValidKey } = require("../../server/http");
const { rateLimit } = require("../../lib/rateLimit");
const { reportError } = require("../../server/log");
const { publishAndNotify, notifyUsers } = require("../../server/notify");
const { visioNotification, NOTIF_TYPES } = require("../../lib/notifyTemplates");
const { normalizeMeetingInput, MEETING_ERRORS, isListed, endOf } = require("../../lib/visioLogic");

const ROOT = "visio_meetings";
const BROADCAST_SENDER = "ASRAR PRO";
// Réunions à venir (en attente ou approuvées) qu'un même compte peut avoir :
// empêche d'inonder la file de modération.
const MAX_ACTIVE_PER_USER = 3;
// Les réunions terminées depuis plus d'un jour sont effacées à la lecture.
const PURGE_AFTER_MS = 24 * 3600 * 1000;
// Fuseau d'affichage dans la notification (Sénégal, UTC+0).
const NOTIF_TIME_ZONE = "Africa/Dakar";

function httpError(status, message) {
  return Object.assign(new Error(message), { statusCode: status });
}

function formatWhen(ms) {
  try {
    return new Date(ms).toLocaleString("fr-FR", {
      weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: NOTIF_TIME_ZONE,
    }) + " (GMT)";
  } catch { return ""; }
}

export default async function handler(req, res) {
  setCors(req, res);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const body = parseBody(req);
  const action = String(body.action || "");

  let user;
  try { user = await verifyUser(body.idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  const reading = action === "list";
  if (!rateLimit("visio:" + (reading ? "read:" : "write:") + user.uid, reading ? 60 : 10, 60_000)) {
    return res.status(429).json({ error: "Trop de requêtes. Réessayez dans une minute." });
  }

  const db = app().database();
  const id = isValidKey(body.meetingId) ? body.meetingId : "";
  try {
    switch (action) {
      case "list": return await handleList(db, res, user);
      case "create": return await handleCreate(db, res, user, body);
      case "update": return await handleUpdate(db, res, user, id, body);
      case "delete": return await handleDelete(db, res, user, id);
      case "approve": return await handleApprove(db, res, user, id);
      default: return res.status(400).json({ error: "Action inconnue." });
    }
  } catch (e) {
    if (!e.statusCode) await reportError("visio", e, { action, uid: user.uid });
    return res.status(e.statusCode || 500).json({ error: e.statusCode ? e.message : "Erreur serveur." });
  }
}

async function readAll(db) {
  const snap = await db.ref(ROOT).once("value");
  return Object.entries(snap.val() || {}).filter(([, m]) => m && typeof m === "object");
}

async function readOne(db, id) {
  if (!id) throw httpError(400, "Visioconférence manquante.");
  const m = (await db.ref(ROOT + "/" + id).once("value")).val();
  if (!m) throw httpError(404, "Visioconférence introuvable.");
  return m;
}

async function handleList(db, res, user) {
  const now = Date.now();
  const admin = await isAdmin(user);
  const all = await readAll(db);

  // Nettoyage paresseux : les réunions terminées depuis plus d'un jour.
  const stale = all.filter(([, m]) => now > endOf(m) + PURGE_AFTER_MS).map(([key]) => key);
  if (stale.length) {
    await db.ref(ROOT).update(Object.fromEntries(stale.map((key) => [key, null]))).catch(() => {});
  }

  const meetings = all
    .filter(([, m]) => isListed(m, now))
    .filter(([, m]) => m.approved === true || m.ownerUid === user.uid || admin)
    .map(([key, m]) => {
      const mine = m.ownerUid === user.uid;
      const out = {
        id: key,
        title: String(m.title || ""),
        description: String(m.description || ""),
        startAt: Number(m.startAt) || 0,
        durationMin: Number(m.durationMin) || 0,
        approved: m.approved === true,
        ownerName: String(m.ownerName || ""),
        mine,
      };
      if (out.approved || mine || admin) out.meetUrl = String(m.meetUrl || "");
      if (admin) out.ownerEmail = String(m.ownerEmail || "");
      return out;
    })
    .sort((a, b) => a.startAt - b.startAt);

  return res.status(200).json({ meetings, isAdmin: admin });
}

function validated(body) {
  const norm = normalizeMeetingInput(body, Date.now());
  if (norm.error) throw httpError(400, MEETING_ERRORS[norm.error]);
  return norm.value;
}

async function handleCreate(db, res, user, body) {
  const value = validated(body);
  const now = Date.now();
  const active = (await readAll(db)).filter(([, m]) => m.ownerUid === user.uid && now < endOf(m));
  if (active.length >= MAX_ACTIVE_PER_USER) {
    throw httpError(400, `Vous avez déjà ${MAX_ACTIVE_PER_USER} visioconférences programmées. Attendez qu'une se termine ou supprimez-en une.`);
  }
  const ref = db.ref(ROOT).push();
  await ref.set({
    ...value,
    approved: false,
    ownerUid: user.uid,
    ownerName: String(user.name || "").slice(0, 80),
    ownerEmail: String(user.email || ""),
    createdAt: now,
  });
  return res.status(200).json({ ok: true, id: ref.key });
}

async function handleUpdate(db, res, user, id, body) {
  const m = await readOne(db, id);
  const admin = await isAdmin(user);
  if (m.ownerUid !== user.uid && !admin) throw httpError(403, "Seul le créateur peut modifier cette visioconférence.");
  const value = validated(body);
  // Modifiée par son créateur : nouvelle validation (le lien et l'horaire
  // diffusés à tous restent ceux que l'administration a vus).
  const approved = admin ? m.approved === true : false;
  await db.ref(ROOT + "/" + id).update({ ...value, approved, updatedAt: Date.now() });
  return res.status(200).json({ ok: true, approved });
}

async function handleDelete(db, res, user, id) {
  const m = await readOne(db, id);
  const mine = m.ownerUid === user.uid;
  const admin = !mine && (await isAdmin(user));
  if (!mine && !admin) throw httpError(403, "Seul le créateur peut supprimer cette visioconférence.");
  await db.ref(ROOT + "/" + id).remove();
  if (admin && m.approved !== true && m.ownerUid) {
    await notifyUsers(db, [m.ownerUid], {
      type: NOTIF_TYPES.VISIO,
      title: "Visioconférence non retenue",
      body: `« ${String(m.title || "").slice(0, 90)} » n'a pas été validée par l'administration.`,
      senderName: BROADCAST_SENDER,
      targetUrl: "/visio",
    }, { eventId: "visio-rejected:" + id });
  }
  return res.status(200).json({ ok: true });
}

async function handleApprove(db, res, user, id) {
  if (!(await isAdmin(user))) throw httpError(403, "Action réservée à l'administrateur.");
  const m = await readOne(db, id);
  if (m.approved === true) return res.status(200).json({ ok: true });
  if (Date.now() >= endOf(m)) throw httpError(400, "Cette visioconférence est déjà terminée.");
  await publishAndNotify(db, ROOT + "/" + id, { approved: true, approvedAt: Date.now() }, {
    ...visioNotification({ title: m.title, when: formatWhen(m.startAt) }),
    senderName: BROADCAST_SENDER,
    targetUrl: "/visio",
    meta: { tagSuffix: id },
  }, { eventId: "visio-approved:" + id + ":" + (Number(m.updatedAt) || Number(m.createdAt) || 0) });
  return res.status(200).json({ ok: true });
}
