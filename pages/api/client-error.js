// api/client-error.js — Reçoit les bugs et lenteurs rencontrés dans
// l'application (components/BugReporter.js, components/ReportProblem.js,
// app/error.js) et les enregistre pour l'administration (onglet « Bugs »,
// server/bugReports.js). Les erreurs restent aussi journalisées via
// server/log.js (logs Vercel, webhook éventuel).
//
// PAS d'authentification requise : un plantage peut survenir avant que
// l'utilisateur soit connecté (écran blanc sinon perdu). Si un idToken est
// joint et valide, l'e-mail du compte accompagne le rapport (pour pouvoir
// recontacter l'utilisateur) ; un jeton absent ou invalide n'empêche rien.
//
// Corps accepté :
//   { reports: [{ kind, message, stack, detail, page, label, durationMs, version }, …], idToken? }
//   { message, stack, url }   ← ancien format (une erreur), toujours lu
//
// Endpoint public : taille bornée, débit limité par IP (plus strict pour les
// signalements écrits), plafond quotidien d'écritures (server/bugReports.js).

const { setCors, parseBody } = require("../../server/http");
const { reportError } = require("../../server/log");
const { rateLimit } = require("../../lib/rateLimit");
const { platformOf } = require("../../lib/platform");
const { sanitizeReport, MAX_BATCH } = require("../../lib/bugReport");
const { recordBugReports } = require("../../server/bugReports");
const { app } = require("../../server/grant");

export const config = { api: { bodyParser: { sizeLimit: "64kb" } } };

const RATE_LIMIT = { max: 30, windowMs: 60_000 };
const USER_RATE_LIMIT = { max: 5, windowMs: 10 * 60_000 };

async function identity(idToken) {
  if (typeof idToken !== "string" || !idToken || idToken.length > 4096) return {};
  try {
    const decoded = await app().auth().verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email || "" };
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  // Pas d'identité fiable ici (endpoint public) : la clé de limitation est
  // l'IP telle que vue par la plateforme (x-forwarded-for côté Vercel).
  const ip = String((req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "anon").slice(0, 64);
  if (!rateLimit("client-error:" + ip, RATE_LIMIT.max, RATE_LIMIT.windowMs)) {
    return res.status(204).end(); // best-effort, jamais bloquant pour le client
  }

  const body = parseBody(req);
  const raw = Array.isArray(body.reports) ? body.reports.slice(0, MAX_BATCH) : [{ ...body, kind: "error", page: body.url }];
  let reports = raw.map(sanitizeReport).filter(Boolean);
  if (reports.some((r) => r.kind === "user") && !rateLimit("client-error:user:" + ip, USER_RATE_LIMIT.max, USER_RATE_LIMIT.windowMs)) {
    reports = reports.filter((r) => r.kind !== "user");
  }
  if (!reports.length) return res.status(204).end();

  const platform = platformOf(req.headers["user-agent"]);
  const who = await identity(body.idToken);

  for (const r of reports) {
    if (r.kind !== "error") continue;
    await reportError("client", { message: r.message, stack: r.stack }, { page: r.page, platform, ip });
  }

  try {
    await recordBugReports(app().database(), reports, { platform, ...who });
  } catch (e) {
    await reportError("client-error:store", e);
  }
  return res.status(204).end();
}
