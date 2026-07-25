'use client';
// Client des fonctions /api protégées — équivalent de js/api-content.js.
// Joint automatiquement le jeton d'identité Firebase. Les appels partent en
// relatif (/api/…) puis sont proxifiés vers le backend par next.config.mjs.
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

// Résout l'état d'auth une seule fois (avant un getIdToken()).
export function authReady() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

// POST JSON vers /api/<path> avec le jeton injecté.
// Lève une Error (avec .status) en cas d'échec.
export async function apiPost(path, payload = {}) {
  const user = auth.currentUser || (await authReady());
  if (!user) throw Object.assign(new Error('Non connecté.'), { status: 401 });

  const idToken = await user.getIdToken();
  const r = await fetch('/api/' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, ...payload }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || 'Erreur serveur.'), { status: r.status });
  return data;
}
