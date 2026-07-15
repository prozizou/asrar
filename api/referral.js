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

const { verifyUser, emailKey } = require("./_lib/access");
const { app } = require("./_lib/grant");
const { setCors, parseBody } = require("./_lib/http");

// ── Paramètres (source unique de vérité) ─────────────────────
const POINTS_PER_INVITE  = 10;      // points par filleul inscrit
const POINTS_FOR_REWARD  = 1000;    // seuil de la récompense (= 100 filleuls)
const REWARD_DAYS        = 90;      // abonnement offert : 3 mois
const REWARD_PLAN        = "sub_3m";
const REWARD_LEVEL       = 15000;   // palier équivalent (cf. getSubscriptionLevel)
const MAX_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1000; // filleul = compte créé récemment

const DAY_MS = 24 * 60 * 60 * 1000;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans I, O, 0, 1 (dictée facile)

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const body = parseBody(req);

  let user;
  try { user = await verifyUser(body.idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

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

        // Un seul crédit par compte filleul — garanti par la transaction.
        const rRef = db.ref("referred/" + user.uid);
        const tx = await rRef.transaction((cur) =>
          cur === null ? { by: sponsor, at: Date.now(), credited: false } : undefined);
        if (!tx.committed) return ok(res, false, "deja_parraine");

        // Le compte doit être NOUVEAU (sinon : un ancien membre cliquerait pour un ami).
        let fresh = false;
        try {
          const u = await app().auth().getUser(user.uid);
          const created = Date.parse(u.metadata && u.metadata.creationTime);
          fresh = Number.isFinite(created) && (Date.now() - created) < MAX_ACCOUNT_AGE_MS;
        } catch (e) { fresh = false; }

        if (!fresh) {
          await rRef.update({ credited: false, reason: "compte_existant" });
          return ok(res, false, "compte_existant");
        }

        await db.ref("referrals/" + sponsor + "/points").transaction((p) => (p || 0) + POINTS_PER_INVITE);
        await db.ref("referrals/" + sponsor + "/invited").transaction((n) => (n || 0) + 1);
        await db.ref("referrals/" + sponsor + "/lastAt").set(Date.now());
        await rRef.update({ credited: true, points: POINTS_PER_INVITE });

        return res.status(200).json({ ok: true, credited: true, points: POINTS_PER_INVITE });
      }

      // ── Convertir les points en abonnement 3 mois ────────────
      case "redeem": {
        const pRef = db.ref("referrals/" + user.uid + "/points");

        // Débit atomique : impossible de dépenser deux fois les mêmes points.
        const tx = await pRef.transaction((p) =>
          (p || 0) >= POINTS_FOR_REWARD ? p - POINTS_FOR_REWARD : undefined);
        if (!tx.committed) {
          return res.status(400).json({ error: "Points insuffisants (" + POINTS_FOR_REWARD + " requis)." });
        }

        try {
          const key = emailKey(user.email);
          const cur = (await db.ref("purchased_user/" + key).once("value")).val() || {};

          if (cur.expiresAt === "lifetime") {
            await pRef.transaction((p) => (p || 0) + POINTS_FOR_REWARD); // restitution
            return res.status(400).json({ error: "Vous disposez déjà d'un accès à vie." });
          }

          // Prolongation : on repart de l'échéance en cours si elle est future.
          const base = (typeof cur.expiresAt === "number" && cur.expiresAt > Date.now())
            ? cur.expiresAt : Date.now();
          const expiresAt = base + REWARD_DAYS * DAY_MS;

          await db.ref("purchased_user/" + key).update({
            token:     "REF-" + Date.now().toString(36).toUpperCase(),
            plan:      REWARD_PLAN,
            level:     Math.max(REWARD_LEVEL, Number(cur.level) || 0),
            source:    "referral",
            uid:       user.uid,
            at:        Date.now(),
            expiresAt: expiresAt
          });
          await db.ref("purchases/" + user.uid).push({
            plan: REWARD_PLAN, source: "referral", points: POINTS_FOR_REWARD,
            at: Date.now(), expiresAt: expiresAt
          });
          await db.ref("referrals/" + user.uid + "/rewards").transaction((n) => (n || 0) + 1);

          return res.status(200).json({ ok: true, expiresAt, days: REWARD_DAYS });
        } catch (e) {
          await pRef.transaction((p) => (p || 0) + POINTS_FOR_REWARD); // restitution
          console.error("referral redeem:", e.message);
          return res.status(500).json({ error: "Activation impossible. Vos points ont été restitués." });
        }
      }

      default:
        return res.status(400).json({ error: "Action inconnue." });
    }
  } catch (e) {
    console.error("referral:", e.message);
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
