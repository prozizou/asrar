'use client';
// Initialisation Firebase (SDK modulaire v10) — équivalent de js/firebase-config.js
// mais sans les <script> compat globaux. Les clés sont publiques (déjà livrées
// dans le client statique) : rien de sensible ici.
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyBLzPKzbiNYitUz7sv9Ftqm0oF20rA32Zk',
  authDomain: 'asrar-bc059.firebaseapp.com',
  databaseURL: 'https://asrar-bc059.firebaseio.com',
  projectId: 'asrar-bc059',
  storageBucket: 'asrar-bc059.appspot.com',
  messagingSenderId: '199810893447',
};

// getApps() évite la double-init en dev (Fast Refresh) et côté client.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
export { app };

// Clé publique VAPID (Firebase Console → Cloud Messaging → Certificats Web
// Push). Publique par nature — sert uniquement à demander un jeton FCM au
// navigateur, ne donne aucun droit d'envoi (voir lib/push.js).
export const VAPID_KEY = 'BK5fMjRfY_JiN_gSjr52pd9BAvtufncwbeh5vJaaFSgbq4Vn2nmn9ksS3qDJd491cn7SH0UHDbP5hqXBHdapRI4';

export const ASRAR_CONFIG = { siteUrl: 'https://asrar-hub.vercel.app' };
