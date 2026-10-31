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

export const AD_WAIT_MS = 5000; // attente avant le résultat — components/AdCountdown.js
const SAME_ACTION_MS = 5000;
const ACTION_AD_KEY = 'asrar_action_ad_at';

export type ActionAdResult = 'opened' | 'blocked' | 'skipped';

// ── Mesure : l'utilisateur ferme-t-il l'onglet de pub aussitôt ? ──────────────
// Le navigateur ne dit pas si la pub a chargé ni si elle a été vue, mais
// `tab.closed` reste lisible et donne la durée de vie de l'onglet. Résultat
// classé en trois groupes (compteurs agrégés, aucune donnée personnelle) :
//  - quick  : fermé en moins de QUICK_CLOSE_MS (pub « sautée ») ;
//  - closed : fermé avant la fin de l'attente (AD_WAIT_MS) ;
//  - open   : encore ouvert à la fin de l'attente (pub laissée ou regardée).
// Mesure approximative : `closed` n'est relevé que toutes les 250 ms, et plus
// tard si le navigateur ralentit notre page pendant que la pub est au premier
// plan (le relevé reprend dès que l'utilisateur revient).
export const QUICK_CLOSE_MS = 2000;
const STATS_KEY = 'asrar_ad_stats';
const FLUSH_KEY = 'asrar_ad_stats_flush';
const FLUSH_EVERY_MS = 10 * 60 * 1000; // au plus un envoi toutes les 10 min
const FLUSH_AT_COUNT = 20;

export type AdStats = { opened: number; quick: number; closed: number; open: number };
const EMPTY: AdStats = { opened: 0, quick: 0, closed: 0, open: 0 };

let tracked: { tab: Window; openedAt: number; closedAt: number } | null = null;

function readStats(): AdStats {
  try {
    const raw = JSON.parse(localStorage.getItem(STATS_KEY) || 'null');
    return raw ? { ...EMPTY, ...raw } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

/** Relevé périodique (appelé par AdCountdown) : date de fermeture de l'onglet. */
export function sampleAdTab() {
  if (tracked && !tracked.closedAt && tracked.tab.closed) tracked.closedAt = Date.now();
}

/**
 * Classe l'onglet de la pub en cours et l'ajoute aux compteurs locaux ; à
 * appeler quand l'utilisateur touche « Continuer » (fin de l'attente).
 */
export function recordAdOutcome(flush?: (stats: AdStats) => void) {
  const t = tracked;
  tracked = null;
  if (!t) return;
  try {
    if (!t.closedAt && t.tab.closed) t.closedAt = Date.now();
    const stats = readStats();
    stats.opened += 1;
    if (t.closedAt && t.closedAt - t.openedAt < QUICK_CLOSE_MS) stats.quick += 1;
    else if (t.closedAt && t.closedAt - t.openedAt < AD_WAIT_MS) stats.closed += 1;
    else stats.open += 1;
    const last = Number(localStorage.getItem(FLUSH_KEY)) || 0;
    if (flush && (stats.opened >= FLUSH_AT_COUNT || Date.now() - last >= FLUSH_EVERY_MS)) {
      localStorage.setItem(FLUSH_KEY, String(Date.now()));
      localStorage.removeItem(STATS_KEY);
      flush(stats);
    } else {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    }
  } catch {
    /* mesure non essentielle */
  }
}

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
    tracked = { tab, openedAt: Date.now(), closedAt: 0 };
    return 'opened';
  } catch {
    return 'skipped'; // pub non essentielle au fonctionnement : jamais d'erreur
  }
}
