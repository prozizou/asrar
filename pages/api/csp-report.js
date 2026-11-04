// api/csp-report.js — Reçoit les rapports de violation de la CSP (lib/csp.js,
// directives report-uri / report-to) et les AGRÈGE par jour, directive et
// domaine bloqué dans analytics/csp/{AAAA-MM-JJ}/{directive}/{domaine} — lu par
// l'administration (onglet Publicités). Sert à savoir quels domaines des
// régies publicitaires la CSP bloque chez les vrais visiteurs, avant de
// l'assouplir en connaissance de cause.
//
// Endpoint public (le navigateur l'appelle sans session) : corps borné,
// débit limité par IP, rapports d'autres sites ignorés, et plafond quotidien
// d'écritures pour qu'un envoi abusif ne fasse pas grossir la base.

const { app } = require("../../server/grant");
const { rateLimit } = require("../../lib/rateLimit");
const { reportError } = require("../../server/log");
const { normalizeSiteUrl } = require("../../lib/site");
const { parseCspReports, firebaseKey } = require("../../lib/cspReport");

// Les navigateurs envoient application/csp-report ou application/reports+json,
// que le décodeur de Next ne lit pas : on lit le flux brut, borné.
export const config = { api: { bodyParser: false } };

const MAX_BYTES = 64 * 1024;
const RATE_LIMIT = { max: 30, windowMs: 60_000 };
const DAILY_CAP = 20_000; // violations enregistrées par jour, au-delà : ignorées

function siteHosts() {
  const site = normalizeSiteUrl(process.env.SITE_URL, "https://www.asrarpro.com");
  let host = "";
  try { host = new URL(site).hostname; } catch { /* repli ci-dessous */ }
  return new Set([host, host.replace(/^www\./, ""), "www." + host.replace(/^www\./, ""), "localhost", "127.0.0.1"].filter(Boolean));
}

function isOwnHost(host) {
  return siteHosts().has(host) || /\.vercel\.app$/.test(host);
}

function readBody(req) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BYTES) { req.destroy(); resolve(null); return; }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => resolve(null));
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "anon").split(",")[0].trim().slice(0, 64);
  if (!rateLimit("csp-report:" + ip, RATE_LIMIT.max, RATE_LIMIT.windowMs)) return res.status(204).end();

  const text = await readBody(req);
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  const reports = parseCspReports(body, isOwnHost);
  if (!reports.length) return res.status(204).end();

  const date = new Date().toISOString().slice(0, 10);
  const db = app().database();
  try {
    const cap = await db.ref("analytics/csp/" + date + "/_n").transaction((n) => {
      if ((n || 0) >= DAILY_CAP) return; // abandon : plafond du jour atteint
      return (n || 0) + reports.length;
    });
    if (!cap.committed) return res.status(204).end();
    const counts = new Map();
    for (const r of reports) {
      const path = r.directive + "/" + firebaseKey(r.blocked);
      counts.set(path, (counts.get(path) || 0) + 1);
    }
    await Promise.all([...counts].map(([path, n]) =>
      db.ref("analytics/csp/" + date + "/" + path).transaction((c) => (c || 0) + n)));
  } catch (e) {
    await reportError("csp-report", e);
  }
  return res.status(204).end();
}
