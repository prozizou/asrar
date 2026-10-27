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

function withTimeout(promise, ms = TIMEOUT_MS, message = TIMEOUT_MSG, onTimeout = () => {}) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      onTimeout();
      reject(Object.assign(new Error(message), { status: 0, timeout: true }));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Attend l'état d'auth puis détache l'écouteur, y compris après expiration.
export function authReady() {
  return new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    let settled = false;
    const finish = (error, user = null) => {
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      if (error) reject(error);
      else resolve(user);
    };
    const timer = setTimeout(() => finish(Object.assign(new Error(TIMEOUT_MSG), { status: 0, timeout: true })), TIMEOUT_MS);
    unsubscribe = onAuthStateChanged(auth, (user) => finish(null, user), (error) => finish(error));
    if (settled) unsubscribe();
  });
}

// POST JSON vers /api/<path> avec le jeton injecté.
// Lève une Error (avec .status) en cas d'échec — y compris un délai dépassé
// ou une réponse 200 dont le corps est tronqué/invalide (voir plus bas :
// incident constaté en prod, app/zikr/page.tsx plantait sur `g.members.filter`
// après avoir reçu `{}` en silence).
export async function apiPost(path, payload = {}) {
  const user = auth.currentUser || (await authReady());
  if (!user) throw Object.assign(new Error('Non connecté.'), { status: 401 });

  const idToken = await withTimeout(user.getIdToken());

  const controller = new AbortController();
  const readResponse = async () => {
    let r;
    try {
      r = await fetch('/api/' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, idToken }),
        signal: controller.signal,
      });
    } catch (e) {
      if (e.name === 'AbortError') throw Object.assign(new Error(TIMEOUT_MSG), { status: 0, timeout: true });
      throw Object.assign(new Error('Problème de connexion réseau.'), { status: 0 });
    }

    // Un échec de parsing JSON sur une réponse 200 (OK) NE DOIT PAS être avalé
    // en silence : renvoyer `{}` comme si c'était une réponse valide laissait
    // chaque appelant recevoir un objet vide, indiscernable d'une vraie
    // réponse incomplète — tout code qui suppose ensuite la présence d'un
    // champ (ex. `g.members.filter(...)`, app/zikr/page.tsx) plante alors sur
    // un TypeError, sur un réseau juste assez instable pour tronquer le corps
    // de la réponse sans faire échouer la requête elle-même. Sur une réponse
    // en ERREUR (!r.ok), le corps échoue plus souvent à parser (proxy/CDN qui
    // renvoie du HTML) — `{}` y reste un repli sûr, seul `data.error` en
    // dépend, avec son propre message par défaut juste en dessous.
    let data;
    try {
      data = await r.json();
    } catch (e) {
      if (e.name === 'AbortError') throw Object.assign(new Error(TIMEOUT_MSG), { status: 0, timeout: true });
      if (!r.ok) data = {};
      else throw Object.assign(new Error('Réponse invalide du serveur.'), { status: r.status });
    }
    if (!r.ok) {
      const message = r.status >= 500 ? 'Le service est temporairement indisponible. Réessayez dans un instant.' :
        data.error || (r.status === 401 ? 'Reconnectez-vous pour continuer.' : r.status === 403 ? 'Votre compte ne permet pas cette action.' :
          r.status === 429 ? 'Trop de demandes. Patientez une minute.' : 'La demande ne peut pas être traitée. Vérifiez les informations.');
      throw Object.assign(new Error(message), { status: r.status, code: data.code });
    }
    return data;
  };
  // La limite couvre les en-têtes ET le corps JSON, y compris un corps qui
  // reste suspendu après une réponse 200.
  return withTimeout(readResponse(), TIMEOUT_MS, TIMEOUT_MSG, () => controller.abort());
}
