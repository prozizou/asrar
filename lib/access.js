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

export async function checkAccess(user) {
  if (!user || !user.email) return { allowed: false, admin: false, vip: false, level: 0 };

  const key = emailToKey(user.email);
  try {
    const [purSnap, allowedSnap, adminSnap, vipSnap] = await Promise.all([
      get(ref(db, 'purchased_user/' + key)),
      get(ref(db, 'allowedUsers/' + key)),
      get(ref(db, 'admins/' + key)),
      get(ref(db, 'vip_users/' + user.uid)),
    ]);

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

    return { allowed: isAllowed, admin: isAdmin, vip: isVip, purchase: pur || null, level };
  } catch {
    return { allowed: false, admin: false, vip: false, level: 0 };
  }
}

export function levelFromStatus(status) {
  return status ? Number(status.level) || 0 : 0;
}
