'use client';
// Vérification d'accès (paywall) — appelle /api/check-access (server/access.js,
// Admin SDK), PAS le SDK client Firebase Realtime Database directement.
//
// Historique : la première version faisait des get() directs sur `db`
// (lib/firebase.js) depuis le navigateur — WebSocket ouvert vers
// s-*.firebaseio.com. Sur certains réseaux (proxy/pare-feu d'entreprise,
// certains opérateurs mobiles, extensions de blocage), ce canal restait EN
// ATTENTE sans jamais aboutir ni échouer, MÊME avec une connexion par
// ailleurs rapide : symptôme observé — « Connexion trop lente » à chaque
// clic, alors que le reste de l'app (toutes les routes /api, sur simple
// HTTPS) fonctionnait normalement. D'où le passage par /api/check-access,
// qui emprunte exactement le même canal HTTPS que le reste de l'app
// (apiPost, lib/api.js — déjà robuste : délai + AbortController).
import { apiPost } from './api';
import { SUB_PLANS, PREMIUM_LEVEL } from './plans';

export { SUB_PLANS, PREMIUM_LEVEL };

export async function checkAccess(user) {
  if (!user || !user.email) return { allowed: false, admin: false, vip: false, level: 0 };

  try {
    const status = await apiPost('check-access', {});
    return {
      allowed: !!status.allowed,
      admin: !!status.admin,
      vip: !!status.vip,
      purchase: status.purchase || null,
      level: Number(status.level) || 0,
      expiresAt: status.expiresAt ?? null,
    };
  } catch (e) {
    // Distingue un délai dépassé (rien à faire ici n'est fiable : on ne SAIT
    // pas si l'utilisateur a accès ou non) d'une vraie erreur —
    // AccessProvider en a besoin pour ne pas afficher à tort « abonnement
    // requis » à un abonné dont la connexion a simplement été trop lente.
    return { allowed: false, admin: false, vip: false, level: 0, networkTimeout: !!e?.timeout };
  }
}

export function levelFromStatus(status) {
  return status ? Number(status.level) || 0 : 0;
}
