'use client';
// Vérification d'accès (paywall) — port de checkAccess() de js/firebase-config.js,
// en SDK modulaire. La logique reste identique : admin OU vip OU achat valide
// OU allowedUsers actif. La décision fine reste côté serveur (/api/get-content).
import { ref, get } from 'firebase/database';
import { db } from './firebase';

const SUPER_ADMIN = 'prozizou298@gmail.com';

export const SUB_PLANS = [
  { id: 'sub_3m', dur: '3 Mois', price: '15 000' },
  { id: 'sub_6m', dur: '6 Mois', price: '25 000' },
  { id: 'sub_1y', dur: '1 An', price: '45 000', best: true, badge: 'Populaire' },
];

function emailToKey(email) {
  return email ? email.replace(/\./g, ',') : null;
}

export async function checkAccess(user) {
  if (!user || !user.email) return { allowed: false, admin: false, vip: false };

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

    const aVal = allowedSnap.val();
    const allowedLegacy = aVal === true || (typeof aVal === 'number' && aVal > Date.now());

    const isAllowed = isAdmin || isVip || hasToken || allowedLegacy;
    return { allowed: isAllowed, admin: isAdmin, vip: isVip, purchase: pur || null };
  } catch {
    return { allowed: false, admin: false, vip: false };
  }
}

export function levelFromStatus(status) {
  if (!status) return 0;
  if (status.admin || status.vip) return 999999;
  const p = status.purchase;
  return p && Number(p.level) ? Number(p.level) : 0;
}
