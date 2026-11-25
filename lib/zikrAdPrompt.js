// lib/zikrAdPrompt.js — Zikr collectif : proposer une publicité récompensée
// tous les 100 grains. Logique pure (aucun React, aucun réseau).
//
// La publicité reste FACULTATIVE : la règle AdMob impose qu'une publicité
// récompensée soit proposée à l'utilisateur, jamais imposée. Ici l'application
// affiche une invitation ; la vidéo ne démarre que sur appui sur « Regarder ».

export const ZIKR_AD_EVERY = 100;
// Un appui sur le chapelet ajoute 1 grain. Un saut plus grand est une
// restauration du compteur (stockage local, autre appareil), pas une récitation :
// il ne doit déclencher aucune invitation.
export const ZIKR_AD_MAX_STEP = 3;

/** Vrai quand le compteur vient de franchir un multiple de `every` en tapant. */
export function crossedAdThreshold(previous, next, every = ZIKR_AD_EVERY) {
  if (!Number.isFinite(previous) || !Number.isFinite(next)) return false;
  const step = next - previous;
  if (step <= 0 || step > ZIKR_AD_MAX_STEP) return false;
  return Math.floor(next / every) > Math.floor(previous / every);
}

/** Palier atteint (100, 200, …) pour le texte de l'invitation. */
export function adThresholdReached(total, every = ZIKR_AD_EVERY) {
  const value = Math.floor(Number(total) / every) * every;
  return value > 0 ? value : every;
}
