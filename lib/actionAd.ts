'use client';
// Pub au clic sur un bouton d'action (ouvrir un secret, un document,
// Calculer, Générer…) : ouvre le Smartlink Adsterra dans un nouvel onglet, le
// site restant ouvert dans le sien. Appelée par AccessProvider.ensureAccess(),
// le passage obligé de toutes ces actions, et seulement pour un visiteur sans
// abonnement valide (adFree === false), sur le web (jamais dans l'APK).
// Uniquement pendant un vrai geste de l'utilisateur (sinon le navigateur la
// bloque) et au plus une fois par ACTION_AD_INTERVAL_MS, pour ne pas ouvrir
// un onglet à chaque clic d'une même séance de calcul.

// Smartlink Adsterra (simple lien) — aussi affiché par <SponsoredLink />
// (components/AdsterraAds.js).
export const ADSTERRA_SMARTLINK = 'https://arwf.org/4/c12b8f66b93c495d8d8a836d32401474';

const ACTION_AD_INTERVAL_MS = Number(process.env.NEXT_PUBLIC_ACTION_AD_INTERVAL_SECONDS || 60) * 1000;
const ACTION_AD_KEY = 'asrar_action_ad_at';

export function openActionAd() {
  try {
    if (!ADSTERRA_SMARTLINK || (window as any).Capacitor?.isNativePlatform?.()) return;
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    const last = Number(sessionStorage.getItem(ACTION_AD_KEY)) || 0;
    if (Date.now() - last < ACTION_AD_INTERVAL_MS) return;
    // 'noopener' rend toujours null : sans lui, on sait si l'onglet s'est
    // ouvert (un seul onglet par clic — ex. Bibliothèque, qui ouvre déjà le
    // document) et l'on coupe aussitôt le lien vers notre page.
    const tab = window.open(ADSTERRA_SMARTLINK, '_blank');
    if (!tab) return;
    tab.opener = null;
    sessionStorage.setItem(ACTION_AD_KEY, String(Date.now()));
  } catch {
    /* pub non essentielle : jamais bloquante pour l'action */
  }
}
