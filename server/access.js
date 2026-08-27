// api/_lib/access.js — Vérifie l'identité (jeton Firebase) et l'accès actif côté serveur.
//
// C'est LA barrière réelle du paywall : aucun contenu protégé ne sort sans passer ici.
// Réutilise l'app Firebase Admin initialisée dans grant.js (même compte de service).

const { app } = require("./grant");
// Source unique (partagée avec lib/access.js côté client) : SUPER_ADMIN_EMAIL,
// PREMIUM_LEVEL et parseAllowed() ne sont plus dupliqués ni à resynchroniser
// manuellement entre client et serveur — voir lib/plans.js.
const { SUPER_ADMIN_EMAIL, PREMIUM_LEVEL, FREE_FOR_ALL, parseAllowed } = require("../lib/plans");

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
 * `picture` (photo de profil Google, si connu du jeton) est optionnel — les
 * appelants qui n'en ont pas besoin le laissent simplement de côté.
 * @returns {Promise<{uid:string, email:string, picture?:string}>}
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
  return { uid: decoded.uid, email: decoded.email, picture: decoded.picture || "" };
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
  // Voir FREE_FOR_ALL (lib/plans.js) : application temporairement gratuite —
  // court-circuite les lectures RTDB ci-dessous sans y toucher.
  if (FREE_FOR_ALL) return true;

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
  // Voir FREE_FOR_ALL (lib/plans.js) : application temporairement gratuite —
  // débloque aussi les modules premium (Al Qalam, Géomancie), sans toucher
  // aux lectures RTDB ci-dessous.
  if (FREE_FOR_ALL) return Infinity;

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

/**
 * Statut d'accès complet en UNE seule volée de lectures (contrairement à
 * hasActiveAccess()+getAccessLevel() appelés séparément, qui liraient les
 * 4 mêmes chemins deux fois). Même forme que checkAccess() côté client
 * (lib/access.js), pour que /api/check-access puisse simplement renvoyer ce
 * résultat tel quel — voir la note de cet endpoint sur la raison d'être de
 * ce doublon serveur (lecture Admin SDK, pas le SDK client RTDB).
 * @param {{uid:string, email:string}} user
 * @returns {Promise<{allowed:boolean, admin:boolean, vip:boolean, level:number, purchase:object|null, expiresAt:number|null}>}
 */
async function getAccessStatus({ uid, email }) {
  const emailLower = (email || "").toLowerCase();
  if (emailLower === SUPER_ADMIN) {
    return { allowed: true, admin: true, vip: false, level: Infinity, purchase: null, expiresAt: null };
  }
  // Voir FREE_FOR_ALL (lib/plans.js) : application temporairement gratuite —
  // admin/vip restent `false` (pas de mensonge sur le vrai statut du compte),
  // seul l'accès l'est. Les lectures RTDB ci-dessous restent inchangées.
  if (FREE_FOR_ALL) {
    return { allowed: true, admin: false, vip: false, level: Infinity, purchase: null, expiresAt: null };
  }

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

  const isAdminUser = adminSnap.val() === true;
  const isVip = vipSnap.exists();

  const pur = purSnap.val();
  const notExpired =
    !pur ||
    pur.expiresAt === "lifetime" ||
    pur.expiresAt == null ||
    (typeof pur.expiresAt === "number" && pur.expiresAt > now);
  const hasToken = !!(pur && pur.token) && notExpired;

  const allowedInfo = parseAllowed(allowedSnap.val(), now);

  const allowed = isAdminUser || isVip || hasToken || allowedInfo.active;
  const level = isAdminUser || isVip
    ? Infinity
    : Math.max(allowedInfo.level, hasToken && pur ? Number(pur.level) || 0 : 0);

  // Même calcul d'expiration unifiée que lib/access.js (rappel J-3) — la plus
  // proche des deux sources d'accès actives.
  const allowedVal = allowedSnap.val();
  const allowedNumericUntil =
    allowedVal && typeof allowedVal === "object" ? allowedVal.until
    : typeof allowedVal === "number" ? allowedVal
    : null;
  const expiryCandidates = [
    typeof pur?.expiresAt === "number" ? pur.expiresAt : null,
    typeof allowedNumericUntil === "number" ? allowedNumericUntil : null,
  ].filter((v) => v != null);
  const expiresAt = isAdminUser || isVip || !expiryCandidates.length ? null : Math.min(...expiryCandidates);

  return { allowed, admin: isAdminUser, vip: isVip, purchase: pur || null, level, expiresAt };
}

module.exports = {
  verifyUser,
  hasActiveAccess,
  getAccessLevel,
  getAccessStatus,
  PREMIUM_LEVEL,
  isAdmin,
  emailKey,
  httpError,
};
