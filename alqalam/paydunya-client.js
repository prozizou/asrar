// js/paydunya-client.js — module navigateur (sans framework).
//   import { createCheckout, confirmFromReturn } from "./js/paydunya-client.js";
//
// CONTRAT SERVEUR : /api/create-invoice attend { idToken, productId }.
//   L'identité (email + uid) et le MONTANT sont dérivés côté serveur (jeton vérifié
//   + catalogue plans.js). Le navigateur n'envoie donc QUE le productId + le jeton.
// REQUIERT : firebase-config.js (SDK compat) chargé AVANT → firebase.auth() disponible.

const FUNCTIONS_BASE = "/api"; // Vercel

/** Récupère le jeton d'identité Firebase de l'utilisateur connecté. */
async function getIdToken() {
  if (typeof firebase === "undefined" || !firebase.auth) {
    throw new Error("Firebase non initialisé.");
  }
  const auth = firebase.auth();
  const user = auth.currentUser || await new Promise((resolve) => {
    const off = auth.onAuthStateChanged((u) => { off(); resolve(u); });
  });
  if (!user) throw new Error("Connectez-vous d'abord.");
  return await user.getIdToken();
}

/** Crée la facture puis redirige vers la page de paiement PayDunya. */
export async function createCheckout({ productId }) {
  const data = await createInvoice({ productId });
  location.href = data.url;
  return data;
}

/** Crée la facture sans rediriger. Retourne { token, url }. */
export async function createInvoice({ productId }) {
  if (!productId) throw new Error("productId requis.");
  const idToken = await getIdToken();
  const r = await fetch(`${FUNCTIONS_BASE}/create-invoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, productId })   // ← idToken (plus de buyerId/email côté client)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.url) throw new Error(data.error || "Création du paiement impossible.");
  return data;
}

/**
 * À appeler au chargement : si l'URL contient ?token=..., confirme le paiement
 * et nettoie l'URL (évite la reconfirmation au refresh).
 * @returns {Promise<null|{status, productId, persisted}>}
 */
export async function confirmFromReturn() {
  const url = new URL(location.href);
  const token = url.searchParams.get("token");
  if (!token) return null;

  url.searchParams.delete("token");
  history.replaceState({}, "", url.pathname + url.search + url.hash);

  const r = await fetch(`${FUNCTIONS_BASE}/confirm-invoice?token=${encodeURIComponent(token)}`);
  return await r.json().catch(() => ({ status: "unknown" }));
}
