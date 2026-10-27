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

const { getApps, getApp, initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getDatabase } = require("firebase-admin/database");
const { getMessaging } = require("firebase-admin/messaging");
const { emulatorConfig } = require("../lib/emulatorConfig");

function app() {
  const emulator = emulatorConfig(process.env);
  if (getApps().length) return services(getApp());
  if (emulator) return services(initializeApp(emulator));
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT manquant (JSON brut ou base64).");
  const txt = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const initialized = initializeApp({
    credential: cert(JSON.parse(txt)),
    databaseURL: process.env.FIREBASE_DB_URL
  });
  return services(initialized);
}

function services(instance) {
  return { auth: () => getAuth(instance), database: () => getDatabase(instance), messaging: () => getMessaging(instance) };
}

module.exports = { app };
