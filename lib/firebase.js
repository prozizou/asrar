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

// Firestore (Phase 3 de la migration RTDB → Firestore, voir
// docs/FIRESTORE_SCHEMA.md) : chargé à la demande (import() dynamique)
// plutôt qu'en haut de ce fichier. lib/firebase.js est importé par quasiment
// toutes les pages (pour `auth`/`db`) — un import statique de
// 'firebase/firestore' ici gonflerait le First Load JS de TOUTES les pages
// d'environ 65 Ko (mesuré), alors que Firestore ne sert qu'aux 3 lectures de
// secours à froid de lib/alqalam.js/benefits.js/rouwhania.js
// (sourate/verset_refs/asma_ul_husna, jamais de listener temps réel ni
// d'écriture — voir firestore.rules), rarement atteintes en pratique (cache
// local + API serveur suffisent dans l'immense majorité des cas). Chaque
// appelant importe 'firebase/firestore' lui-même au moment où il en a besoin ;
// getFirestore(app) est idempotent (SDK), donc rappeler cette fonction
// plusieurs fois ne recrée rien.
export async function getFirestoreLazy() {
  const { getFirestore } = await import('firebase/firestore');
  return getFirestore(app);
}

export const ASRAR_CONFIG = { siteUrl: 'https://www.asrarpro.com' };
