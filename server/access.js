// api/_lib/access.js — Vérifie l'identité (jeton Firebase) et l'accès actif côté serveur.
//
// C'est LA barrière réelle du paywall : aucun contenu protégé ne sort sans passer ici.
// Réutilise l'app Firebase Admin initialisée dans grant.js (même compte de service).

const { app } = require("./grant");
// Source unique (partagée avec lib/access.js côté client) : SUPER_ADMIN_EMAIL,
// PREMIUM_LEVEL et parseAllowed() ne sont plus dupliqués ni à resynchroniser
// manuellement entre client et serveur — voir lib/plans.js.
const { SUPER_ADMIN_EMAIL, PREMIUM_LEVEL, FREE_FOR_ALL } = require("../lib/plans");

// Même super-admin que lib/plans.js (surchargé possible par variable d'env, serveur only).
const { effectiveAccess } = require("../lib/accessStatus");

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
 * `picture` (photo de profil Google) et `name` (nom Google, si connu du
 * jeton) sont optionnels — les appelants qui n'en ont pas besoin les
 * laissent simplement de côté. `name` sert par exemple à afficher un pseudo
 * plutôt que l'email brut dans la discussion d'un zikr collectif
 * (app/zikr/page.tsx) — absent pour un compte email/mot de passe (pas de
 * claim Google), le client retombe alors sur la partie locale de l'email.
 * @returns {Promise<{uid:string, email:string, picture?:string, name?:string}>}
 */
async function verifyUser(idToken, checkRevoked = false) {
  if (!idToken) throw httpError(401, "Authentification requise.");
  let decoded;
  try {
    decoded = await app().auth().verifyIdToken(idToken, checkRevoked);
  } catch (e) {
    throw httpError(401, "Session invalide ou expirée. Reconnecte-toi.");
  }
  if (!decoded.email) throw httpError(401, "Compte sans adresse e-mail.");
  if (decoded.email_verified !== true) throw httpError(403, "Vérifiez votre adresse e-mail avant de continuer.");
  return { uid: decoded.uid, email: decoded.email, picture: decoded.picture || "", name: decoded.name || "" };
}

/**
 * Détermine si l'utilisateur a un accès actif :
 *   super-admin OU admin OU vip OU achat/activation valide (token + non expiré)
 *   OU grant manuel (allowedUsers : true / timestamp futur).
 * Contrairement à l'ancien code client, l'EXPIRATION est ici appliquée.
 * @param {{uid:string, email:string}} user
 * @returns {Promise<boolean>}
 */
async function hasActiveAccess(user) {
  return (await getAccessStatus(user)).allowed;
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
async function getAccessLevel(user) {
  return (await getAccessStatus(user)).level;
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
  const access = effectiveAccess(pur, allowedSnap.val());
  const privileged = isAdminUser || isVip;
  const allowed = privileged || access.allowed;
  const level = privileged ? Infinity : access.level;
  const expiresAt = privileged ? null : access.expiresAt;

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
