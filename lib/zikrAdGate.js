// lib/zikrAdGate.js — Zikr collectif : verrou « une vidéo tous les 100 grains ».
// Logique pure (état persistant et décision après une tentative), sans React.
//
// À chaque centaine récitée, le compteur est figé jusqu'à ce que l'utilisateur
// regarde une vidéo récompensée. La vidéo ne démarre jamais seule (règle AdMob :
// lancée par l'utilisateur) et le verrou ne peut pas enfermer l'utilisateur par
// NOTRE faute : si aucune publicité n'est disponible, il est levé.

// Échecs consécutifs (aucune annonce, erreur, indisponible) avant de lever le verrou.
export const FAILURES_BEFORE_RELEASE = 2;

const FAILURE_REASONS = ['no_fill', 'error', 'unavailable', 'paused'];

const gateKey = (groupId, uid) => `zikr_ad_gate_${groupId}_${uid}`;

/** Palier verrouillé (100, 200…) conservé entre deux ouvertures de l'application, 0 sinon. */
export function readGate(groupId, uid) {
  try { return parseInt(localStorage.getItem(gateKey(groupId, uid)) || '', 10) || 0; }
  catch { return 0; }
}

export function writeGate(groupId, uid, threshold) {
  try { localStorage.setItem(gateKey(groupId, uid), String(threshold)); } catch { /* stockage indisponible */ }
}

export function clearGate(groupId, uid) {
  try { localStorage.removeItem(gateKey(groupId, uid)); } catch { /* stockage indisponible */ }
}

export function isAdFailure(reason) {
  return FAILURE_REASONS.includes(reason);
}

/**
 * Décision après une tentative de lecture (résultat de watchRewardedAd).
 * @param {{ok: boolean, reason?: string}} result
 * @param {number} failures échecs déjà constatés pour ce palier
 * @returns {{unlock: boolean, failures: number, message: string}}
 */
export function resolveAttempt(result, failures = 0) {
  if (result && result.ok) return { unlock: true, failures: 0, message: '' };
  const reason = result && result.reason;
  // Vidéo regardée mais crédit pas encore confirmé par le serveur : elle a bien été vue.
  if (reason === 'pending') return { unlock: true, failures: 0, message: '' };
  // Vidéo interrompue par l'utilisateur : le verrou reste, ce n'est pas une panne.
  if (reason === 'skipped') {
    return { unlock: false, failures, message: 'Regardez la vidéo jusqu’au bout pour continuer.' };
  }
  const count = failures + 1;
  if (!isAdFailure(reason) || count >= FAILURES_BEFORE_RELEASE) {
    return { unlock: true, failures: 0, message: 'Aucune vidéo disponible pour le moment : vous pouvez continuer.' };
  }
  return { unlock: false, failures: count, message: 'Vidéo indisponible. Vérifiez votre connexion puis réessayez.' };
}
