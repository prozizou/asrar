'use client';
// Vérification d'accès (paywall) — port de checkAccess() de js/firebase-config.js,
// en SDK modulaire. La logique reste identique : admin OU vip OU achat valide
// OU allowedUsers actif. La décision fine reste côté serveur (/api/get-content).
import { ref, get } from 'firebase/database';
import { db } from './firebase';
// Source unique (partagée avec server/access.js, la barrière réelle côté
// serveur) : SUB_PLANS, PREMIUM_LEVEL et la lecture d'allowedUsers ne sont
// plus dupliqués ni à resynchroniser manuellement — voir lib/plans.js.
import { SUPER_ADMIN_EMAIL, SUB_PLANS, PREMIUM_LEVEL, parseAllowed } from './plans';

const SUPER_ADMIN = SUPER_ADMIN_EMAIL;

export { SUB_PLANS, PREMIUM_LEVEL };

function emailToKey(email) {
  return email ? email.replace(/\./g, ',') : null;
}

// Sur une connexion mobile instable, get() peut rester EN ATTENTE sans jamais
// aboutir ni échouer (le SDK Firebase n'a pas de délai par défaut) — sans
// borne de temps, un clic sur un secret/produit restait bloqué indéfiniment,
// avant même d'atteindre l'API : ensureAccess() (AccessProvider) attend ce
// résultat pour décider d'ouvrir le contenu ou le portail d'abonnement.
const ACCESS_TIMEOUT_MS = 15000;

export async function checkAccess(user) {
  if (!user || !user.email) return { allowed: false, admin: false, vip: false, level: 0 };

  const key = emailToKey(user.email);
  try {
    const reads = Promise.all([
      get(ref(db, 'purchased_user/' + key)),
      get(ref(db, 'allowedUsers/' + key)),
      get(ref(db, 'admins/' + key)),
      get(ref(db, 'vip_users/' + user.uid)),
    ]);
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), ACCESS_TIMEOUT_MS);
    });
    const [purSnap, allowedSnap, adminSnap, vipSnap] = await Promise.race([reads, timeout]).finally(() =>
      clearTimeout(timer)
    );

    const isAdmin = user.email === SUPER_ADMIN || adminSnap.val() === true;
    const isVip = vipSnap.exists();

    const pur = purSnap.val();
    const notExpired =
      !pur ||
      pur.expiresAt === 'lifetime' ||
      pur.expiresAt == null ||
      (typeof pur.expiresAt === 'number' && pur.expiresAt > Date.now());
    const hasToken = !!(pur && pur.token) && notExpired;

    const allowedInfo = parseAllowed(allowedSnap.val());

    const isAllowed = isAdmin || isVip || hasToken || allowedInfo.active;
    const level = isAdmin || isVip
      ? 999999
      : Math.max(allowedInfo.level, hasToken && pur ? Number(pur.level) || 0 : 0);

    // Expiration unifiée, pour le rappel J-3 (SubscriptionExpiryBanner) : la
    // plus proche des deux sources d'accès actives (achat/parrainage OU grant
    // admin — un même utilisateur peut cumuler les deux). null = pas
    // d'expiration connue (admin/vip, accès à vie, ou pas d'accès du tout) —
    // le rappel ne s'affiche alors jamais, volontairement (rien à annoncer).
    const allowedUntil = allowedSnap.val();
    const allowedNumericUntil =
      allowedUntil && typeof allowedUntil === 'object' ? allowedUntil.until
      : typeof allowedUntil === 'number' ? allowedUntil
      : null;
    const expiryCandidates = [
      typeof pur?.expiresAt === 'number' ? pur.expiresAt : null,
      typeof allowedNumericUntil === 'number' ? allowedNumericUntil : null,
    ].filter((v) => v != null);
    const expiresAt = isAdmin || isVip || !expiryCandidates.length ? null : Math.min(...expiryCandidates);

    return { allowed: isAllowed, admin: isAdmin, vip: isVip, purchase: pur || null, level, expiresAt };
  } catch (e) {
    // Distingue un timeout (rien à faire ici n'est fiable : on ne SAIT pas si
    // l'utilisateur a accès ou non) d'une vraie erreur — AccessProvider en a
    // besoin pour ne pas afficher à tort « abonnement requis » à un abonné
    // dont la connexion a simplement été trop lente.
    return { allowed: false, admin: false, vip: false, level: 0, networkTimeout: e?.message === 'timeout' };
  }
}

export function levelFromStatus(status) {
  return status ? Number(status.level) || 0 : 0;
}
