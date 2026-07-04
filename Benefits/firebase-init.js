// firebase-init.js — App Firebase partagée (Auth + Realtime Database), SDK modulaire v9.
// Un SEUL initializeApp pour toute l'app Benefits (évite le conflit « app [DEFAULT]
// already exists » entre firebase.js et access.js).
//
// IMPORTANT : même projet (asrar-bc059) et même origine que le hub ASRAR PRO.
// La session Google ouverte sur le hub est donc reconnue ici automatiquement
// (persistance Firebase liée à l'apiKey + l'origine) → pas de reconnexion.
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence }
  from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getDatabase, ref, get, onValue }
  from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';

const firebaseConfig = {
  apiKey:            "AIzaSyBLzPKzbiNYitUz7sv9Ftqm0oF20rA32Zk",
  authDomain:        "asrar-bc059.firebaseapp.com",
  databaseURL:       "https://asrar-bc059.firebaseio.com",
  projectId:         "asrar-bc059",
  storageBucket:     "asrar-bc059.appspot.com",
  messagingSenderId: "199810893447",
  appId:             "1:199810893447:web:044629472e10f9eb68da22"
};

export const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getDatabase(app);

// Persistance locale explicite (session conservée entre les visites).
setPersistence(auth, browserLocalPersistence).catch(() => {});

export { ref, get, onValue, onAuthStateChanged };

// Résout l'état d'auth une seule fois (utile avant getIdToken()).
export function authReady() {
  return new Promise(resolve => {
    const off = onAuthStateChanged(auth, u => { off(); resolve(u); });
  });
}
