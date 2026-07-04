// api/_lib/grant.js — Initialisation partagée de Firebase Admin.
//
// Fournit app() : l'instance Firebase Admin (réutilisée par access.js, sellers.js,
// admin.js, shop.js). L'activation d'accès n'est plus faite par paiement en ligne :
// elle est réalisée manuellement par l'administration (voir api/admin.js →
// grant-access / revoke-access, ou la console Firebase), en écrivant dans
// allowedUsers/{cléEmail} ou purchased_user/{cléEmail}.
//
// Variables d'environnement :
//   FIREBASE_SERVICE_ACCOUNT   JSON brut OU base64 du compte de service
//   FIREBASE_DB_URL            URL de la Realtime Database

const admin = require("firebase-admin");

function app() {
  if (admin.apps.length) return admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT manquant (JSON brut ou base64).");
  const txt = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(txt)),
    databaseURL: process.env.FIREBASE_DB_URL
  });
  return admin;
}

module.exports = { app };
