// server/shopOwners.js — Qui prévenir ? Propriétaire d'une boutique / d'un
// produit du Marché, et comptes de l'administration. Partagé par
// pages/api/product-requests.js, pages/api/social.js et pages/api/book-social.js.

const { app } = require("./grant");
const { vendorKey, emailVendorKey } = require("../lib/market");

// Uid(s) du propriétaire d'une boutique (`vendorId` = vendorKey, lib/market.js).
// Ordre : uid mémorisé (product_request_owners, écrit quand le propriétaire
// consulte ses demandes), ancienne boutique identifiée par uid, sinon uid des
// produits / de la fiche boutique dont l'e-mail correspond à la clé.
async function findShopOwnerUids(db, vendorId) {
  const cached = (await db.ref("product_request_owners/" + vendorId).once("value")).val();
  if (typeof cached === "string" && cached) return [cached];
  if (!String(vendorId).startsWith("v_")) return [vendorId];
  const uids = new Set();
  const [prods, shops] = await Promise.all([
    db.ref("det_produits").once("value"),
    db.ref("profile_clients").once("value"),
  ]);
  prods.forEach((c) => {
    const v = c.val() || {};
    if (v.uid && vendorKey(v) === vendorId) uids.add(v.uid);
  });
  shops.forEach((c) => {
    const v = c.val() || {};
    if (v.uid && typeof v.email === "string" && emailVendorKey(v.email) === vendorId) uids.add(v.uid);
  });
  return [...uids];
}

// Propriétaire d'un produit : uid porté par la fiche (ou ancien vendeurId).
async function productOwner(db, productKey) {
  const p = (await db.ref("det_produits/" + productKey).once("value")).val();
  if (!p) return null;
  return { uid: p.uid || p.vendeurId || "", name: String(p.produit || "").slice(0, 120) };
}

// Uids de l'administration : super-admin (SUPER_ADMIN_EMAIL) + admins/{emailKey}.
// Résolus par e-mail via Firebase Auth, mis en cache 10 min par instance.
let adminCache = { at: 0, uids: [] };
async function adminUids(db, { now = Date.now() } = {}) {
  if (now - adminCache.at < 600000 && adminCache.uids.length) return adminCache.uids;
  const emails = new Set();
  const superAdmin = String(process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
  if (superAdmin) emails.add(superAdmin);
  const snap = await db.ref("admins").once("value");
  snap.forEach((c) => { if (c.val() === true) emails.add(String(c.key).replace(/,/g, ".").toLowerCase()); });
  const uids = [];
  for (const email of emails) {
    try { uids.push((await app().auth().getUserByEmail(email)).uid); }
    catch (_) { /* compte absent : ignoré */ }
  }
  adminCache = { at: now, uids: [...new Set(uids)].sort() };
  return adminCache.uids;
}

function resetAdminCache() { adminCache = { at: 0, uids: [] }; }

// Nom affiché d'un utilisateur dans une notification (jamais l'e-mail complet).
function shortName(user) {
  const n = String(user?.name || "").trim();
  if (n) return n.slice(0, 60);
  return String(user?.email || "").split("@")[0].slice(0, 60) || "Un utilisateur";
}

module.exports = { findShopOwnerUids, productOwner, adminUids, resetAdminCache, shortName };
