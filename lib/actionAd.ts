'use client';
// Pub OBLIGATOIRE au clic sur un bouton d'action (ouvrir un secret, un
// document, Calculer, Générer…) : ouvre le Smartlink Adsterra dans un nouvel
// onglet, le site restant ouvert dans le sien. Appelée par
// AccessProvider.requireActionAd() — elle-même appelée par ensureAccess(), le
// passage obligé de toutes ces actions — seulement pour un visiteur sans
// abonnement valide (adFree === false), sur le web (jamais dans l'APK).
//
// Résultat :
//  - 'opened'  : pub ouverte → l'action continue ;
//  - 'blocked' : le navigateur a refusé l'onglet → l'action est refusée
//                (AccessProvider explique comment autoriser les pop-ups) ;
//  - 'skipped' : pas de pub à ouvrir (APK, pas de Smartlink) ou action déjà
//                « payée » par une pub ouverte il y a moins de
//                SAME_ACTION_MS (plusieurs ensureAccess() pour un même clic),
//                ou appel hors d'un geste de l'utilisateur, où le navigateur
//                bloquerait tout onglet → l'action continue.

// Smartlink Adsterra (simple lien) — aussi affiché par <SponsoredLink />
// (components/AdsterraAds.js).
export const ADSTERRA_SMARTLINK = 'https://arwf.org/4/c12b8f66b93c495d8d8a836d32401474';

const SAME_ACTION_MS = 5000;
const ACTION_AD_KEY = 'asrar_action_ad_at';

export type ActionAdResult = 'opened' | 'blocked' | 'skipped';

export function openActionAd(): ActionAdResult {
  try {
    if (!ADSTERRA_SMARTLINK || (window as any).Capacitor?.isNativePlatform?.()) return 'skipped';
    const last = Number(sessionStorage.getItem(ACTION_AD_KEY)) || 0;
    if (Date.now() - last < SAME_ACTION_MS) return 'skipped';
    if (navigator.userActivation && !navigator.userActivation.isActive) return 'skipped';
    // Sans 'noopener' : on sait si l'onglet s'est ouvert, puis on coupe
    // aussitôt son lien vers notre page.
    const tab = window.open(ADSTERRA_SMARTLINK, '_blank');
    if (!tab) return 'blocked';
    tab.opener = null;
    sessionStorage.setItem(ACTION_AD_KEY, String(Date.now()));
    return 'opened';
  } catch {
    return 'skipped'; // pub non essentielle au fonctionnement : jamais d'erreur
  }
}
