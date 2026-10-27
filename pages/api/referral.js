// api/referral.js (Vercel) — PARRAINAGE : gagner un abonnement en partageant l'app.
//
// Body (JSON) : { idToken, action, code? }
//   action="me"     → code + lien personnels, points, statistiques
//   action="claim"  → le FILLEUL déclare le code de son parrain (à sa 1re connexion)
//   action="redeem" → convertir POINTS_FOR_REWARD points en abonnement 3 mois
//
// Règle du crédit (anti-triche — voir PARTAGE_ET_PARRAINAGE.md) :
//   Les points ne sont PAS crédités au clic (un clic se répète à l'infini), mais
//   quand le lien amène un NOUVEAU compte Google :
//     • 1 seul crédit par compte filleul  (nœud `referred/{uid}`, transaction)
//     • auto-parrainage refusé            (parrain ≠ filleul)
//     • compte déjà ancien refusé         (créé il y a > MAX_ACCOUNT_AGE_MS)
//   Les clics bruts sont comptés par /api/share, pour information seulement.
//
// Nœuds écrits (Admin SDK, écriture client interdite par les règles) :
//   referrals/{uid}       = { code, email, points, clicks, invited, rewards, ... }
//   referral_codes/{code} = uid                      (index inverse)
//   referred/{uidFilleul} = { by, at, credited }     (dédoublonnage)
//   purchased_user/{cléEmail}                        (récompense = accès 3 mois)

const { verifyUser } = require("../../server/access");
const { app } = require("../../server/grant");
const { setCors, parseBody } = require("../../server/http");
const { rateLimit } = require("../../lib/rateLimit");
const { reportError } = require("../../server/log");

// ── Paramètres (source unique de vérité) ─────────────────────
const { claimReferral, POINTS_PER_INVITE } = require("../../server/referralClaim");
const { redeemReferral, POINTS_FOR_REWARD, REWARD_DAYS } = require("../../server/referralRedemption");
const MAX_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1000; // filleul = compte créé récemment

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans I, O, 0, 1 (dictée facile)

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const body = parseBody(req);

  let user;
  try { user = await verifyUser(body.idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  // "me" est un simple rafraîchissement de tableau de bord (fréquent, sans
  // effet de bord) : limite large. "claim"/"redeem" ont un effet réel (crédit
  // de points, activation d'abonnement) déjà protégé par des transactions
  // atomiques côté RTDB — la limite ici borne juste le débit d'essais.
  const limit = body.action === "me" ? { max: 30, windowMs: 60_000 } : { max: 10, windowMs: 60_000 };
  if (!rateLimit("referral:" + body.action + ":" + user.uid, limit.max, limit.windowMs)) {
    return res.status(429).json({ error: "Trop de requêtes, réessayez dans une minute." });
  }

  const db = app().database();

  try {
    switch (body.action) {

      // ── Mon tableau de bord ──────────────────────────────────
      case "me": {
        const code = await getOrCreateCode(db, user.uid, user.email);
        const v = (await db.ref("referrals/" + user.uid).once("value")).val() || {};
        const points = v.points || 0;
        return res.status(200).json({
          code,
          link: siteUrl(req) + "/s?r=" + code,
          points,
          clicks:  v.clicks  || 0,
          invited: v.invited || 0,
          rewards: v.rewards || 0,
          canRedeem: points >= POINTS_FOR_REWARD,
          pointsPerInvite: POINTS_PER_INVITE,
          pointsForReward: POINTS_FOR_REWARD,
          rewardDays: REWARD_DAYS
        });
      }

      // ── Le filleul déclare son parrain ───────────────────────
      case "claim": {
        const code = normCode(body.code);
        if (!code) return res.status(400).json({ error: "Code de parrainage manquant." });

        const sponsor = (await db.ref("referral_codes/" + code).once("value")).val();
        if (!sponsor)            return ok(res, false, "code_inconnu");
        if (sponsor === user.uid) return ok(res, false, "auto_parrainage");

        const result = await claimReferral(db, user.uid, sponsor, async () => {
          const u = await app().auth().getUser(user.uid);
          const created = Date.parse(u.metadata && u.metadata.creationTime);
          const age = Date.now() - created;
          return Number.isFinite(created) && age >= 0 && age < MAX_ACCOUNT_AGE_MS;
        });
        return res.status(200).json({ ok: true, ...result });
      }

      // ── Convertir les points en abonnement 3 mois ────────────
      case "redeem": {
        if (body.requestId != null && (typeof body.requestId !== "string" ||
          !/^[A-Za-z0-9_-]{16,80}$/.test(body.requestId))) {
          return res.status(400).json({ error: "Identifiant de conversion invalide." });
        }
        try {
          const result = await redeemReferral(db, user, body.requestId);
          return res.status(200).json({ ok: true, ...result });
        } catch (e) {
          if (e.statusCode) throw e;
          await reportError("referral:redeem", e, { uid: user.uid });
          return res.status(503).json({ error: "Conversion en cours. Réessayez pour terminer l'activation ; vos points restent réservés." });
        }
      }

      default:
        return res.status(400).json({ error: "Action inconnue." });
    }
  } catch (e) {
    if (!e.statusCode) await reportError("referral", e, { action: body.action, uid: user.uid });
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};

// ── Code de parrainage : créé une fois, unique, mémorisé ──────
async function getOrCreateCode(db, uid, email) {
  const existing = (await db.ref("referrals/" + uid + "/code").once("value")).val();
  if (existing) return existing;

  for (let i = 0; i < 10; i++) {
    const code = randomCode(6);
    // set-if-absent : la transaction abandonne (undefined) si le code est pris.
    const tx = await db.ref("referral_codes/" + code).transaction((cur) => (cur === null ? uid : undefined));
    if (tx.committed) {
      await db.ref("referrals/" + uid).update({ code, email, createdAt: Date.now() });
      await db.ref("referrals/" + uid + "/points").transaction((p) => p || 0);
      return code;
    }
  }
  const e = new Error("Impossible de générer un code de parrainage.");
  e.statusCode = 500;
  throw e;
}

function randomCode(n) {
  let s = "";
  for (let i = 0; i < n; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}
function normCode(c) { return String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12); }
function ok(res, credited, reason) { return res.status(200).json({ ok: true, credited, reason }); }
function siteUrl(req) {
  if (process.env.SITE_URL) return String(process.env.SITE_URL).replace(/\/+$/, "");
  const host = (req.headers && (req.headers["x-forwarded-host"] || req.headers.host)) || "";
  const proto = (req.headers && req.headers["x-forwarded-proto"]) || "https";
  return host ? proto + "://" + host : "";
}
