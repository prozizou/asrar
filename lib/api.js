'use client';
// Client des fonctions /api protégées — équivalent de js/api-content.js.
// Joint automatiquement le jeton d'identité Firebase. Les appels partent en
// relatif (/api/…) puis sont proxifiés vers le backend par next.config.mjs.
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

// Sur un réseau mobile instable, une requête peut rester EN ATTENTE sans
// jamais aboutir ni échouer (pas d'erreur réseau, pas de réponse) — sans
// borne de temps, l'appelant (ex. le clic sur un secret) restait bloqué
// indéfiniment, sans le moindre retour visible pour l'utilisateur. D'où ce
// délai, sur les trois étapes qui font un aller-retour réseau : l'attente de
// l'état d'auth, le rafraîchissement du jeton, et la requête elle-même.
const TIMEOUT_MS = 15000;
const TIMEOUT_MSG = 'Connexion trop lente. Réessayez.';

function withTimeout(promise, ms = TIMEOUT_MS, message = TIMEOUT_MSG) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(message), { status: 0, timeout: true })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Résout l'état d'auth une seule fois (avant un getIdToken()). Bornée dans
// le temps par apiPost (withTimeout) — le unsub reste inutilisé si le délai
// tombe avant que onAuthStateChanged ne se déclenche, mais reste inoffensif
// (juste un listener Firebase de plus, GC avec la fonction).
export function authReady() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

// POST JSON vers /api/<path> avec le jeton injecté.
// Lève une Error (avec .status) en cas d'échec — y compris un délai dépassé.
export async function apiPost(path, payload = {}) {
  const user = auth.currentUser || (await withTimeout(authReady()));
  if (!user) throw Object.assign(new Error('Non connecté.'), { status: 401 });

  const idToken = await withTimeout(user.getIdToken());

  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let r;
  try {
    r = await fetch('/api/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, ...payload }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw Object.assign(new Error(TIMEOUT_MSG), { status: 0, timeout: true });
    throw Object.assign(new Error('Problème de connexion réseau.'), { status: 0 });
  } finally {
    clearTimeout(abortTimer);
  }

  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || 'Erreur serveur.'), { status: r.status });
  return data;
}
