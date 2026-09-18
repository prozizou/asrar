// api/_lib/sellers.js — Statut BOUTIQUE (droit de vendre sur le Marché).
//
// Un vendeur = un compte Google UNIQUE (clé = uid). L'activation/prolongation
// d'une boutique est faite manuellement par l'administration (panneau admin →
// seller-action, ou console Firebase) en écrivant sellers/{uid}.shopActive=true
// avec une date d'expiration. Tant qu'elle est dans le futur (ou "lifetime"),
// le vendeur peut gérer sa boutique et ses produits (via /api/shop).

const { app } = require("./grant");

/** Lit le vendeur. */
async function getSeller(uid) {
  if (!uid) return null;
  return (await app().database().ref("sellers/" + uid).once("value")).val();
}

/** Vendeur actif = entrée existante, shopActive, et non expirée. */
async function isActiveSeller(uid) {
  const s = await getSeller(uid);
  if (!s || !s.shopActive) return false;
  return s.expiresAt === "lifetime" || (typeof s.expiresAt === "number" && s.expiresAt > Date.now());
}

/**
 * Boutique "profil" créée par l'admin dans profile_clients avec un e-mail propriétaire.
 * Permet à ce propriétaire (détecté par son e-mail de connexion) de gérer ses produits,
 * même sans entrée sellers/{uid}. Retourne { _id, ...record } ou null.
 */
async function getBoutiqueByEmail(email) {
  if (!email) return null;
  const target = String(email).toLowerCase();
  const snap = await app().database().ref("profile_clients").once("value");
  let found = null;
  snap.forEach((c) => {
    const v = c.val() || {};
    if (v && typeof v.email === "string" && v.email.toLowerCase() === target) {
      found = { _id: c.key, ...v };
      return true; // stoppe l'itération
    }
    return false;
  });
  return found;
}

module.exports = { getSeller, isActiveSeller, getBoutiqueByEmail };
