// lib/plans.js — Paliers d'abonnement & barrière d'accès : SOURCE UNIQUE.
//
// Auparavant dupliqué (SUPER_ADMIN / PREMIUM_LEVEL / SUB_PLANS / parseAllowed)
// entre lib/access.js (client) et server/access.js (Admin SDK), avec un
// commentaire « doit rester synchronisé » de chaque côté — un oubli lors
// d'une modification pouvait rendre l'UI incohérente avec la vraie barrière
// serveur. Ce module n'a AUCUNE dépendance React ni Firebase : il est
// importable tel quel côté client (import) et côté serveur (require), le
// bundler Next assurant l'interop ESM/CommonJS entre les deux mondes.
//
// La barrière réelle du paywall reste `hasActiveAccess`/`getAccessLevel`
// dans server/access.js (Admin SDK) — ce fichier ne fait que porter la
// configuration et la logique pure qu'ils partagent avec le client.

// E-mail super-admin par défaut (surchargeable par la variable d'environnement
// SUPER_ADMIN_EMAIL côté serveur — voir server/access.js).
export const SUPER_ADMIN_EMAIL = 'prozizou298@gmail.com';

// `level` = montant FCFA du palier réellement payé (PAS un simple rang 1/2/3) —
// convention reprise par purchased_user.level et allowedUsers.{clé}.level.
export const SUB_PLANS = [
  { id: 'sub_3m', dur: '3 Mois', price: '15 000', level: 15000 },
  { id: 'sub_6m', dur: '6 Mois', price: '25 000', level: 25000 },
  { id: 'sub_1y', dur: '1 An', price: '45 000', best: true, badge: 'Populaire', level: 45000 },
];

// Niveau minimum requis pour les modules haut de gamme (Al Qalam, Géomancie) :
// réservés au palier « 1 An / 45 000 FCFA ».
export const PREMIUM_LEVEL = 45000;

// Interrupteur temporaire : rend TOUTE l'application gratuite (y compris les
// modules premium) sans démonter le paywall — hasActiveAccess/getAccessLevel/
// getAccessStatus (server/access.js) court-circuitent leurs lectures RTDB et
// répondent « accès total » dès que ce drapeau est actif, exactement comme un
// admin/vip. Les achats, grants manuels et le code du paywall restent intacts
// et inchangés : ils recommenceront à s'appliquer normalement dès que ce
// drapeau repasse à `false` (seul geste nécessaire pour réactiver le
// paywall — aucune autre modification à faire).
export const FREE_FOR_ALL = false;

// allowedUsers/{clé} peut être une valeur héritée : true / timestamp (sans
// palier connu → level 0), ou un objet { until, level } écrit par grant-access
// avec le palier réellement accordé. Fonction pure — testée dans plans.test.js.
export function parseAllowed(aVal, now = Date.now()) {
  if (aVal == null) return { active: false, level: 0 };
  if (aVal === true) return { active: true, level: 0 };
  if (typeof aVal === 'number') return { active: aVal > now, level: 0 };
  if (typeof aVal === 'object') {
    const until = aVal.until;
    const active = until === true || until == null || (typeof until === 'number' && until > now);
    return { active, level: Number(aVal.level) || 0 };
  }
  return { active: false, level: 0 };
}
