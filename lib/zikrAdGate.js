// lib/zikrAdGate.js — Zikr collectif : verrou « une vidéo tous les 100 grains ».
// Logique pure (état persistant et décision après une tentative), sans React.
//
// À chaque centaine récitée, le compteur d'un compte sans abonnement est figé jusqu'à ce
// qu'il regarde une vidéo récompensée JUSQU'AU BOUT ou qu'il s'abonne. Aucune levée
// automatique : une vidéo absente, une coupure réseau ou une erreur laissent le verrou
// (choix de l'éditeur ; auparavant le verrou se levait après deux échecs, ce qui laissait
// compter sans limite avec un bloqueur de publicités ou en mode avion). La vidéo ne démarre
// jamais seule (règle AdMob : lancée par l'utilisateur).

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

// Le sous-titre de la fenêtre propose déjà l'abonnement : les messages restent courts.
const NO_AD_MESSAGE = 'Aucune vidéo disponible pour le moment. Réessayez dans un instant.';
const OFFLINE_MESSAGE = 'Vidéo indisponible. Vérifiez votre connexion puis réessayez.';
const DEVICE_MESSAGE = 'Vidéo indisponible sur cet appareil.';

/**
 * Décision après une tentative de lecture (résultat de watchRewardedAd).
 * Seule une vidéo regardée jusqu'au bout lève le verrou (ou un abonnement, géré par l'appelant).
 * @param {{ok: boolean, reason?: string}} result
 * @param {number} failures échecs déjà constatés pour ce palier (libellé « Réessayer »)
 * @returns {{unlock: boolean, failures: number, message: string}}
 */
export function resolveAttempt(result, failures = 0) {
  if (result && result.ok) return { unlock: true, failures: 0, message: '' };
  const reason = result && result.reason;
  // Vidéo regardée mais crédit pas encore confirmé par le serveur : elle a bien été vue.
  if (reason === 'pending') return { unlock: true, failures: 0, message: '' };
  // Annulé avant l'ouverture de la vidéo : le verrou reste, sans message.
  if (reason === 'cancelled') return { unlock: false, failures, message: '' };
  // Vidéo interrompue par l'utilisateur.
  if (reason === 'skipped') return { unlock: false, failures, message: 'Regardez la vidéo jusqu’au bout pour continuer.' };
  // Aucune vidéo, hors ligne ou erreur : le verrou RESTE ; réessayer ou s'abonner.
  const message = reason === 'no_fill' ? NO_AD_MESSAGE : reason === 'error' ? OFFLINE_MESSAGE : DEVICE_MESSAGE;
  return { unlock: false, failures: failures + 1, message };
}
