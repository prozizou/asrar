// api/client-error.js — Reçoit les erreurs non rattrapées côté client
// (app/error.js) et les journalise via le même point d'accroche que le
// serveur (server/log.js). PAS d'authentification requise : un crash peut
// survenir avant que l'utilisateur soit connecté (écran blanc sinon perdu).
// Limité en taille/fréquence pour éviter l'abus d'un endpoint public.

const { setCors, parseBody } = require("../../server/http");
const { reportError } = require("../../server/log");
const { rateLimit } = require("../../lib/rateLimit");

const RATE_LIMIT = { max: 20, windowMs: 60_000 };

function clip(v, max) {
  return (v == null ? "" : String(v)).slice(0, max);
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  // Pas d'identité fiable ici (endpoint public) : la clé de limitation est
  // l'IP telle que vue par la plateforme (x-forwarded-for côté Vercel).
  const ip = clip((req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress, 64) || "anon";
  if (!rateLimit("client-error:" + ip, RATE_LIMIT.max, RATE_LIMIT.windowMs)) {
    return res.status(204).end(); // best-effort, jamais bloquant pour le client
  }

  const { message, stack, url } = parseBody(req);
  await reportError("client", { message: clip(message, 500), stack: clip(stack, 4000) }, { url: clip(url, 300), ip });

  return res.status(204).end();
};
