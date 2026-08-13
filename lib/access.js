'use client';
// Vérification d'accès (paywall) — port de checkAccess() de js/firebase-config.js,
// en SDK modulaire. La logique reste identique : admin OU vip OU achat valide
// OU allowedUsers actif. La décision fine reste côté serveur (/api/get-content).
import { ref, get } from 'firebase/database';
import { db } from './firebase';

const SUPER_ADMIN = 'prozizou298@gmail.com';

// `level` = montant FCFA du palier (convention déjà utilisée par purchased_user.level,
// cf. REWARD_LEVEL dans pages/api/referral.js) — PAS un simple rang 1/2/3.
export const SUB_PLANS = [
  { id: 'sub_3m', dur: '3 Mois', price: '15 000', level: 15000 },
  { id: 'sub_6m', dur: '6 Mois', price: '25 000', level: 25000 },
  { id: 'sub_1y', dur: '1 An', price: '45 000', best: true, badge: 'Populaire', level: 45000 },
];

// Niveau minimum requis pour les modules haut de gamme (Al Qalam, Géomancie) :
// réservés au palier « 1 An / 45 000 FCFA ». Doit rester synchronisé avec
// PREMIUM_LEVEL dans server/access.js (barrière réelle côté serveur).
export const PREMIUM_LEVEL = 45000;

function emailToKey(email) {
  return email ? email.replace(/\./g, ',') : null;
}

// allowedUsers/{clé} peut être :
//  - une valeur héritée : true (accès à vie) ou un timestamp d'expiration,
//    sans palier connu (level 0 → n'ouvre pas les modules premium) ;
//  - un objet { until, level } écrit par grant-access, qui porte le palier
//    (SUB_PLANS[].level) réellement accordé par l'administration.
function parseAllowed(aVal) {
  if (aVal == null) return { active: false, level: 0 };
  if (aVal === true) return { active: true, level: 0 };
  if (typeof aVal === 'number') return { active: aVal > Date.now(), level: 0 };
  if (typeof aVal === 'object') {
    const until = aVal.until;
    const active = until === true || until == null || (typeof until === 'number' && until > Date.now());
    return { active, level: Number(aVal.level) || 0 };
  }
  return { active: false, level: 0 };
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
