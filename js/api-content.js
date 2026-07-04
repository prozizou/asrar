// js/api-content.js — Appels aux fonctions /api protégées.
// Joint automatiquement le jeton d'identité Firebase à chaque requête.
// REQUIERT : firebase-config.js chargé AVANT (définit `auth`).

// Résout l'état d'auth Firebase une seule fois (utile avant un getIdToken()).
function authReady() {
  return new Promise(resolve => {
    const unsub = auth.onAuthStateChanged(user => { unsub(); resolve(user); });
  });
}

// POST JSON vers /api/<path> avec le jeton d'identité injecté.
// Lève une Error (avec .status) en cas d'échec.
async function apiPost(path, payload = {}) {
  const user = auth.currentUser || await authReady();
  if (!user) throw Object.assign(new Error("Non connecté."), { status: 401 });

  const idToken = await user.getIdToken();
  const r = await fetch("/api/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, ...payload })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || "Erreur serveur."), { status: r.status });
  return data;
}
