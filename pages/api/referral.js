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
//     • 1 seul crédit par compte filleul  (doc `referred/{uid}`, transaction)
//     • auto-parrainage refusé            (parrain ≠ filleul)
//     • compte déjà ancien refusé         (créé il y a > MAX_ACCOUNT_AGE_MS)
//   Les clics bruts sont comptés par /api/share, pour information seulement.
//
// MIGRATION FIRESTORE (Phase 2, voir docs/FIRESTORE_SCHEMA.md) : tout le
// parrainage (`referrals`, `referral_codes`, `referred`, sous-collection
// `referrals/{uid}/redemptions`) est désormais sur Firestore — plus aucun
// accès RTDB dans ce fichier. Amélioration notable : le crédit du filleul
// (`claim`), qui écrivait 4 chemins RTDB séparés (dont un seul dans une
// transaction), est maintenant UNE seule transaction Firestore multi-documents
// (parrain + filleul) — Firestore le permet nativement, la RTDB non (ses
// transactions sont limitées à un seul chemin).
// Collections Firestore écrites :
//   access_purchases/{cléEmail}          (récompense = accès 3 mois, Phase 1)
//   referrals/{uid}       = { code, email, points, invited, rewards, ... }
//   referral_codes/{code} = { uid }                     (index inverse)
//   referred/{uidFilleul} = { by, at, credited }        (dédoublonnage)
//   referrals/{uid}/redemptions/{id} (sous-collection)  (historique des échanges)

const { verifyUser, emailKey } = require("../../server/access");
const { app } = require("../../server/grant");
const { setCors, parseBody } = require("../../server/http");
const { rateLimit } = require("../../lib/rateLimit");
const { reportError } = require("../../server/log");

// ── Paramètres (source unique de vérité) ─────────────────────
const POINTS_PER_INVITE  = 10;      // points par filleul inscrit
const POINTS_FOR_REWARD  = 1000;    // seuil de la récompense (= 100 filleuls)
const REWARD_DAYS        = 90;      // abonnement offert : 3 mois
const REWARD_PLAN        = "sub_3m";
const REWARD_LEVEL       = 15000;   // palier équivalent (cf. getSubscriptionLevel)
const MAX_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1000; // filleul = compte créé récemment

const DAY_MS = 24 * 60 * 60 * 1000;
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
  // atomiques Firestore — la limite ici borne juste le débit d'essais.
  const limit = body.action === "me" ? { max: 30, windowMs: 60_000 } : { max: 10, windowMs: 60_000 };
  if (!rateLimit("referral:" + body.action + ":" + user.uid, limit.max, limit.windowMs)) {
    return res.status(429).json({ error: "Trop de requêtes, réessayez dans une minute." });
  }

  const firestore = app().firestore();
  const FieldValue = app().firestore.FieldValue;

  try {
    switch (body.action) {

      // ── Mon tableau de bord ──────────────────────────────────
      case "me": {
        const code = await getOrCreateCode(firestore, user.uid, user.email);
        const snap = await firestore.collection("referrals").doc(user.uid).get();
        const v = snap.exists ? snap.data() : {};
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

        const codeSnap = await firestore.collection("referral_codes").doc(code).get();
        if (!codeSnap.exists) return ok(res, false, "code_inconnu");
        const sponsor = codeSnap.data().uid;
        if (sponsor === user.uid) return ok(res, false, "auto_parrainage");

        // Un seul crédit par compte filleul — garanti par la transaction
        // (réservation "set-if-absent", même principe que la transaction RTDB
        // d'origine).
        const referredRef = firestore.collection("referred").doc(user.uid);
        let alreadyReferred = false;
        await firestore.runTransaction(async (tx) => {
          const snap = await tx.get(referredRef);
          if (snap.exists) { alreadyReferred = true; return; }
          tx.set(referredRef, { by: sponsor, at: Date.now(), credited: false });
        });
        if (alreadyReferred) return ok(res, false, "deja_parraine");

        // Le compte doit être NOUVEAU (sinon : un ancien membre cliquerait pour un ami).
        let fresh = false;
        try {
          const u = await app().auth().getUser(user.uid);
          const created = Date.parse(u.metadata && u.metadata.creationTime);
          fresh = Number.isFinite(created) && (Date.now() - created) < MAX_ACCOUNT_AGE_MS;
        } catch (e) { fresh = false; }

        if (!fresh) {
          await referredRef.update({ credited: false, reason: "compte_existant" });
          return ok(res, false, "compte_existant");
        }

        // Crédit du parrain + finalisation du filleul : UNE seule transaction
        // Firestore multi-documents (amélioration vs. les 4 écritures RTDB
        // séparées d'origine, dont une seule transactionnelle — voir en-tête).
        const sponsorRef = firestore.collection("referrals").doc(sponsor);
        await firestore.runTransaction(async (tx) => {
          const sponsorSnap = await tx.get(sponsorRef);
          const cur = sponsorSnap.exists ? sponsorSnap.data() : {};
          tx.set(sponsorRef, {
            points:  (Number(cur.points)  || 0) + POINTS_PER_INVITE,
            invited: (Number(cur.invited) || 0) + 1,
            lastAt:  Date.now()
          }, { merge: true });
          tx.update(referredRef, { credited: true, points: POINTS_PER_INVITE });
        });

        return res.status(200).json({ ok: true, credited: true, points: POINTS_PER_INVITE });
      }

      // ── Convertir les points en abonnement 3 mois ────────────
      case "redeem": {
        const referralRef = firestore.collection("referrals").doc(user.uid);

        // Débit atomique : impossible de dépenser deux fois les mêmes points.
        let debited = false;
        await firestore.runTransaction(async (tx) => {
          const snap = await tx.get(referralRef);
          const points = snap.exists ? (Number(snap.data().points) || 0) : 0;
          if (points < POINTS_FOR_REWARD) return;
          tx.update(referralRef, { points: points - POINTS_FOR_REWARD });
          debited = true;
        });
        if (!debited) {
          return res.status(400).json({ error: "Points insuffisants (" + POINTS_FOR_REWARD + " requis)." });
        }

        try {
          const key = emailKey(user.email);
          const purchaseRef = firestore.collection("access_purchases").doc(key);
          const purSnap = await purchaseRef.get();
          const cur = purSnap.exists ? purSnap.data() : {};

          if (cur.expiresAt === "lifetime") {
            await referralRef.update({ points: FieldValue.increment(POINTS_FOR_REWARD) }); // restitution
            return res.status(400).json({ error: "Vous disposez déjà d'un accès à vie." });
          }

          // Prolongation : on repart de l'échéance en cours si elle est future.
          const base = (typeof cur.expiresAt === "number" && cur.expiresAt > Date.now())
            ? cur.expiresAt : Date.now();
          const expiresAt = base + REWARD_DAYS * DAY_MS;

          await purchaseRef.set({
            token:     "REF-" + Date.now().toString(36).toUpperCase(),
            plan:      REWARD_PLAN,
            level:     Math.max(REWARD_LEVEL, Number(cur.level) || 0),
            source:    "referral",
            uid:       user.uid,
            at:        Date.now(),
            expiresAt: expiresAt
          }, { merge: true });
          await referralRef.collection("redemptions").add({
            plan: REWARD_PLAN, source: "referral", points: POINTS_FOR_REWARD,
            at: Date.now(), expiresAt: expiresAt
          });
          await referralRef.update({ rewards: FieldValue.increment(1) });

          return res.status(200).json({ ok: true, expiresAt, days: REWARD_DAYS });
        } catch (e) {
          await referralRef.update({ points: FieldValue.increment(POINTS_FOR_REWARD) }); // restitution
          await reportError("referral:redeem", e, { uid: user.uid });
          return res.status(500).json({ error: "Activation impossible. Vos points ont été restitués." });
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
async function getOrCreateCode(firestore, uid, email) {
  const referralRef = firestore.collection("referrals").doc(uid);
  const existingSnap = await referralRef.get();
  const existing = existingSnap.exists ? existingSnap.data() : null;
  if (existing && existing.code) return existing.code;

  for (let i = 0; i < 10; i++) {
    const code = randomCode(6);
    const codeRef = firestore.collection("referral_codes").doc(code);
    // set-if-absent : la transaction n'écrit rien si le code est déjà pris.
    let committed = false;
    await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(codeRef);
      if (snap.exists) return;
      tx.set(codeRef, { uid });
      committed = true;
    });
    if (committed) {
      const upd = { code, email, createdAt: Date.now() };
      if (!(existing && typeof existing.points === "number")) upd.points = 0;
      await referralRef.set(upd, { merge: true });
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
