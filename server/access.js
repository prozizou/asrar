// api/_lib/access.js — Vérifie l'identité (jeton Firebase) et l'accès actif côté serveur.
//
// C'est LA barrière réelle du paywall : aucun contenu protégé ne sort sans passer ici.
// Réutilise l'app Firebase Admin initialisée dans grant.js (même compte de service).

const { app } = require("./grant");

// Même super-admin que firebase-config.js (surchargé possible par variable d'env).
const SUPER_ADMIN = (process.env.SUPER_ADMIN_EMAIL || "prozizou298@gmail.com").toLowerCase();

// DOIT correspondre à emailToKey() du client et emailKey() de grant.js ('.' → ',').
const emailKey = (email) => (email || "").replace(/\./g, ",");

// Niveau minimum requis pour les modules haut de gamme (Al Qalam, Géomancie) :
// réservés au palier « 1 An / 45 000 FCFA ». `level` = montant FCFA du palier
// (même convention que purchased_user.level, cf. pages/api/referral.js), pas
// un simple rang 1/2/3. Doit rester synchronisé avec PREMIUM_LEVEL dans
// lib/access.js (SUB_PLANS[].level).
const PREMIUM_LEVEL = 45000;

// allowedUsers/{clé} peut être une valeur héritée : true / timestamp (sans
// palier connu → level 0), ou un objet { until, level } écrit par grant-access
// avec le palier réellement accordé.
function parseAllowed(aVal, now) {
  if (aVal == null) return { active: false, level: 0 };
  if (aVal === true) return { active: true, level: 0 };
  if (typeof aVal === "number") return { active: aVal > now, level: 0 };
  if (typeof aVal === "object") {
    const until = aVal.until;
    const active = until === true || until == null || (typeof until === "number" && until > now);
    return { active, level: Number(aVal.level) || 0 };
  }
  return { active: false, level: 0 };
}

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
