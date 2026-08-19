// api/_lib/access.js — Vérifie l'identité (jeton Firebase) et l'accès actif côté serveur.
//
// C'est LA barrière réelle du paywall : aucun contenu protégé ne sort sans passer ici.
// Réutilise l'app Firebase Admin initialisée dans grant.js (même compte de service).

const { app } = require("./grant");
// Source unique (partagée avec lib/access.js côté client) : SUPER_ADMIN_EMAIL,
// PREMIUM_LEVEL et parseAllowed() ne sont plus dupliqués ni à resynchroniser
// manuellement entre client et serveur — voir lib/plans.js.
const { SUPER_ADMIN_EMAIL, PREMIUM_LEVEL, parseAllowed } = require("../lib/plans");

// Même super-admin que lib/plans.js (surchargé possible par variable d'env, serveur only).
const SUPER_ADMIN = (process.env.SUPER_ADMIN_EMAIL || SUPER_ADMIN_EMAIL).toLowerCase();

// DOIT correspondre à emailToKey() du client et emailKey() de grant.js ('.' → ',').
const emailKey = (email) => (email || "").replace(/\./g, ",");

// Crée une erreur portant un code HTTP, pour des réponses propres.
function httpError(status, message) {
  const e = new Error(message);
  e.statusCode = status;
  return e;
}

/**
 * Vérifie le jeton d'identité Firebase envoyé par le client (auth.currentUser.getIdToken()).
 * @returns {Promise<{uid:string, email:string}>}
 */
async function verifyUser(idToken) {
  if (!idToken) throw httpError(401, "Authentification requise.");
  let decoded;
  try {
    decoded = await app().auth().verifyIdToken(idToken);
  } catch (e) {
    throw httpError(401, "Session invalide ou expirée. Reconnecte-toi.");
  }
  if (!decoded.email) throw httpError(401, "Compte sans adresse e-mail.");
  return { uid: decoded.uid, email: decoded.email };
}

/**
 * Détermine si l'utilisateur a un accès actif :
 *   super-admin OU admin OU vip OU achat/activation valide (token + non expiré)
 *   OU grant manuel (allowedUsers : true / timestamp futur).
 * Contrairement à l'ancien code client, l'EXPIRATION est ici appliquée.
 * @param {{uid:string, email:string}} user
 * @returns {Promise<boolean>}
 */
async function hasActiveAccess({ uid, email }) {
  if (email && email.toLowerCase() === SUPER_ADMIN) return true;

  const db  = app().database();
  const key = emailKey(email);
  const now = Date.now();

  const [purSnap, allowedSnap, adminSnap, vipSnap] = await Promise.all([
    db.ref("purchased_user/" + key).once("value"),
    db.ref("allowedUsers/"  + key).once("value"),
    db.ref("admins/"        + key).once("value"),
    uid ? db.ref("vip_users/" + uid).once("value")
        : Promise.resolve({ exists: () => false })
  ]);

  if (adminSnap.val() === true) return true;
  if (vipSnap.exists())         return true;

  // — Achat/activation : token présent ET non expiré —
  const pur = purSnap.val();
  if (pur && pur.token) {
    const exp = pur.expiresAt;
    // exp absent (anciennes entrées) → considéré actif pour ne pas bloquer les acheteurs existants.
    const active = exp === "lifetime" || exp == null ||
                   (typeof exp === "number" && exp > now);
    if (active) return true;
  }

  // — Grant manuel admin (legacy raw OU objet { until, level }) —
  if (parseAllowed(allowedSnap.val(), now).active) return true;

  return false;
}

/**
 * Palier d'accès de l'utilisateur (0 = aucun, 15000|25000|45000 = montant FCFA
 * du forfait — cf. SUB_PLANS[].level dans lib/access.js —, Infinity = admin/vip).
 * Sert à réserver Al Qalam et Géomancie au palier « 1 An / 45 000 FCFA »
 * (PREMIUM_LEVEL) sans casser l'accès général des autres abonnés (voir
 * hasActiveAccess, inchangé).
 * @param {{uid:string, email:string}} user
 * @returns {Promise<number>}
 */
async function getAccessLevel({ uid, email }) {
  if (email && email.toLowerCase() === SUPER_ADMIN) return Infinity;

  const db  = app().database();
  const key = emailKey(email);
  const now = Date.now();

  const [purSnap, allowedSnap, adminSnap, vipSnap] = await Promise.all([
    db.ref("purchased_user/" + key).once("value"),
    db.ref("allowedUsers/"  + key).once("value"),
    db.ref("admins/"        + key).once("value"),
    uid ? db.ref("vip_users/" + uid).once("value")
        : Promise.resolve({ exists: () => false })
  ]);

  if (adminSnap.val() === true) return Infinity;
  if (vipSnap.exists())         return Infinity;

  let level = 0;

  const pur = purSnap.val();
  if (pur && pur.token) {
    const exp = pur.expiresAt;
    const active = exp === "lifetime" || exp == null || (typeof exp === "number" && exp > now);
    if (active) level = Math.max(level, Number(pur.level) || 0);
  }

  const allowedInfo = parseAllowed(allowedSnap.val(), now);
  if (allowedInfo.active) level = Math.max(level, allowedInfo.level);

  return level;
}

/**
 * Vrai si l'utilisateur est administrateur : super-admin (e-mail) OU admins/{clé}===true.
 * @param {{uid:string, email:string}} user
 * @returns {Promise<boolean>}
 */
async function isAdmin({ email }) {
  if (email && email.toLowerCase() === SUPER_ADMIN) return true;
  const snap = await app().database().ref("admins/" + emailKey(email)).once("value");
  return snap.val() === true;
}

module.exports = { verifyUser, hasActiveAccess, getAccessLevel, PREMIUM_LEVEL, isAdmin, emailKey, httpError };
