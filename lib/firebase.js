'use client';
// Initialisation Firebase (SDK modulaire v10) — équivalent de js/firebase-config.js
// mais sans les <script> compat globaux. Les clés sont publiques (déjà livrées
// dans le client statique) : rien de sensible ici.
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyC4Y2pbLhGmT2nNJ5bxLdWG2AoBecpvzLg',
  authDomain: 'asrar-bc059.firebaseapp.com',
  databaseURL: 'https://asrar-bc059.firebaseio.com',
  projectId: 'asrar-bc059',
  storageBucket: 'asrar-bc059.appspot.com',
  messagingSenderId: '199810893447',
  appId: '1:199810893447:web:165ed3d51093d83c68da22',
};

// getApps() évite la double-init en dev (Fast Refresh) et côté client.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
export { app };

export const ASRAR_CONFIG = { siteUrl: 'https://www.asrarpro.com' };
