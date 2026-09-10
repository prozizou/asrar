// api/_lib/sellers.js — Statut BOUTIQUE (droit de vendre sur le Marché).
//
// Un vendeur = un compte Google UNIQUE (clé = uid). L'activation/prolongation
// d'une boutique est faite manuellement par l'administration (panneau admin →
// seller-action, ou console Firebase) en écrivant sellers/{uid}.shopActive=true
// avec une date d'expiration. Tant qu'elle est dans le futur (ou "lifetime"),
// le vendeur peut gérer sa boutique et ses produits (via /api/shop).
//
// MIGRATION FIRESTORE (Phase 2, voir docs/FIRESTORE_SCHEMA.md) : `sellers` et
// `shop_profiles` (ex-profile_clients) sont lus depuis Firestore. La recherche
// par e-mail (getBoutiqueByEmail) est désormais une requête indexée
// (where("email","==",...)) au lieu d'un scan intégral du nœud RTDB — gain
// identifié dans l'audit précédant la migration. Comparaison EXACTE (plus de
// .toLowerCase() des deux côtés comme sur RTDB) : les e-mails viennent du
// jeton Firebase vérifié (déjà normalisés en minuscules par Firebase Auth) ou
// ont été saisis tels quels par l'administration dans shop_profiles — les
// données de production observées sont déjà toutes en minuscules.

const { app } = require("./grant");

/** Lit le vendeur. */
async function getSeller(uid) {
  if (!uid) return null;
  const snap = await app().firestore().collection("sellers").doc(uid).get();
  return snap.exists ? snap.data() : null;
}

/** Vendeur actif = entrée existante, shopActive, et non expirée. */
async function isActiveSeller(uid) {
  const s = await getSeller(uid);
  if (!s || !s.shopActive) return false;
  return s.expiresAt === "lifetime" || (typeof s.expiresAt === "number" && s.expiresAt > Date.now());
}

/**
 * Boutique "profil" créée par l'admin dans shop_profiles avec un e-mail propriétaire.
 * Permet à ce propriétaire (détecté par son e-mail de connexion) de gérer ses produits,
 * même sans entrée sellers/{uid}. Retourne { _id, ...record } ou null.
 */
async function getBoutiqueByEmail(email) {
  if (!email) return null;
  const target = String(email).toLowerCase();
  const snap = await app().firestore().collection("shop_profiles").where("email", "==", target).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { _id: doc.id, ...doc.data() };
}

module.exports = { getSeller, isActiveSeller, getBoutiqueByEmail };
