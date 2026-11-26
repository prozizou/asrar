'use client';
// Nom historique du pont Capacitor. AdMob accorde les points via le rappel
// signé confirmé par le serveur. Le client n'accorde aucune récompense.
import { apiPost } from './api';
import { ADS_PAUSED } from './plans';

// Identifiants du jeu Unity (tableau de bord Unity Ads → Monétisation).
// iOS : pas encore d'app iPhone native dans ce dépôt — prêt pour le jour où
// elle existera (même plugin à porter côté Swift).
export const UNITY_GAME_IDS = { android: '6204107', ios: '6204106' };
// Unités publicitaires récompensées créées par défaut avec chaque jeu Unity.
export const UNITY_REWARDED_PLACEMENTS = { android: 'Rewarded_Android', ios: 'Rewarded_iOS' };

// Délai d'attente du rappel Unity après la fin de la publicité.
const CONFIRM_TIMEOUT_MS = 30_000;
const CONFIRM_POLL_MS = 1500;

async function nativeUnityAds() {
  try {
    const { Capacitor, registerPlugin } = await import('@capacitor/core');
    const platform = Capacitor.getPlatform();
    if (!Capacitor.isNativePlatform() || !UNITY_GAME_IDS[platform] || !Capacitor.isPluginAvailable('UnityAds')) return null;
    return { plugin: registerPlugin('UnityAds'), platform };
  } catch {
    return null;
  }
}

export async function isUnityAdsAvailable() {
  const native = await nativeUnityAds();
  if (!native) return false;
  try { const caps = await native.plugin.getCapabilities(); return caps.adMobRewards === true || (!ADS_PAUSED && caps.legacyRewards !== false); }
  catch { return !ADS_PAUSED; } // Older APKs expose only the Unity S2S bridge.
}

// Optional hint introduced in Android 8.0.3; never authorizes an action or proves readiness.
// Old APKs keep working unchanged.
let preparationRevision = 0;
export async function prepareNativeActionAd(enabled = true) {
  enabled = enabled && !ADS_PAUSED;
  const revision = ++preparationRevision;
  try {
    const native = await nativeUnityAds();
    if (!native) return false;
    const capabilities = await native.plugin.getCapabilities();
    if (revision !== preparationRevision || capabilities?.actionAdPreload !== true) return false;
    await native.plugin.prepareActionAd({ enabled });
    return true;
  } catch { return false; }
}

// Préchargement d'une publicité récompensée « en attente » (APK 8.3.2+, capacité rewardedPreload) :
// elle s'affiche alors sans délai quand l'utilisateur la demande, et une autre se recharge dès
// qu'elle est fermée. Réservé aux comptes sans abonnement ; `false` coupe et jette l'annonce en attente.
// Indication seulement : n'autorise jamais une action et ne prouve rien (le crédit reste serveur).
// Les anciens APK n'ont pas la capacité : aucun effet.
let rewardedPreloadRevision = 0;
export async function prepareRewardedAd(enabled = true) {
  const revision = ++rewardedPreloadRevision;
  try {
    const native = await nativeUnityAds();
    if (!native) return false;
    const capabilities = await native.plugin.getCapabilities();
    if (revision !== rewardedPreloadRevision || capabilities?.rewardedPreload !== true || capabilities?.adMobRewards !== true) return false;
    await native.plugin.preloadRewarded({ enabled });
    return true;
  } catch { return false; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Traduit l'issue d'une lecture native qui n'est pas allée jusqu'au bout.
 * Le pont Android RÉSOUT (sans rejeter) avec une raison quand l'annonce n'a pas pu s'ouvrir :
 * la confondre avec une vidéo interrompue donnait un faux message (« regardez-la jusqu'au bout »)
 * et empêchait de lever un blocage quand aucune annonce n'était disponible.
 * @returns {'cancelled'|'skipped'|'no_fill'|'unavailable'|'error'}
 */
export function nativeOutcomeReason(result) {
  const reason = result?.reason;
  if (reason === 'cancelled') return 'cancelled';
  if (result?.shown) return 'skipped'; // vidéo ouverte puis fermée avant la fin
  if (reason === 'skipped') return 'cancelled'; // « Annuler » de l'ancienne fenêtre Android, avant l'affichage
  if (['no_fill', 'timeout', 'load', 'init'].includes(reason)) return 'no_fill';
  if (reason === 'consent') return 'unavailable';
  return 'error';
}

/**
 * Affiche une publicité récompensée et attend sa validation par le serveur.
 * @param {boolean} [interstitial]
 * @param {{onPhase?: (phase: 'loading'|'validating') => void}} [options] étapes pour l'interface :
 *   « loading » pendant l'ouverture de la vidéo, « validating » pendant la confirmation serveur.
 * @returns {Promise<{ok:true} | {ok:false, reason:'paused'|'unavailable'|'no_fill'|'skipped'|'cancelled'|'pending'|'error'}>}
 *   pending : publicité regardée mais rappel pas encore reçu — le crédit sera utilisable dès son
 *   arrivée. cancelled : l'utilisateur a annulé avant l'ouverture de la vidéo (aucun message).
 */
export async function watchRewardedAd(interstitial = false, { onPhase } = {}) {
  const native = await nativeUnityAds();
  if (!native) return { ok: false, reason: ADS_PAUSED ? 'paused' : 'unavailable' };

  let capabilities = {};
  try { capabilities = (await native.plugin.getCapabilities()) || {}; } catch { /* older bridge */ }
  const admob = capabilities.adMobRewards === true;
  // APK 8.3.3+ : l'attente est affichée par la page (AdLoadingState), sans fenêtre Android.
  const silent = capabilities.rewardedSilentLoading === true;
  if (ADS_PAUSED && !admob) return { ok: false, reason: 'paused' };
  onPhase?.('loading');
  let session;
  try {
    session = await apiPost('ad-reward', { action: 'start', ...(admob ? { provider: 'admob' } : {}), ...(interstitial ? { interstitial: true } : {}) });
  } catch {
    return { ok: false, reason: 'error' };
  }

  let shown;
  try {
    shown = await native.plugin.showRewarded({
      gameId: UNITY_GAME_IDS[native.platform],
      placementId: UNITY_REWARDED_PLACEMENTS[native.platform],
      serverId: session.serverId,
      ...(interstitial ? { interstitial: true } : {}),
      ...(silent ? { silent: true } : {}),
    });
  } catch (e) {
    return { ok: false, reason: e?.code === 'no_fill' ? 'no_fill' : 'error' };
  }
  if (!shown?.completed) return { ok: false, reason: nativeOutcomeReason(shown) };

  onPhase?.('validating');
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const { rewarded } = await apiPost('ad-reward', { action: 'status', nonce: session.nonce });
      if (rewarded) return { ok: true };
    } catch {
      /* réseau : on réessaie jusqu'à l'échéance */
    }
    await sleep(CONFIRM_POLL_MS);
  }
  return { ok: false, reason: 'pending' };
}

/** « Annuler » pendant l'ouverture de la vidéo (APK 8.3.3+). Sans effet une fois la vidéo affichée. */
export async function cancelRewardedAd() {
  try {
    const native = await nativeUnityAds();
    if (!native) return false;
    const capabilities = await native.plugin.getCapabilities();
    if (capabilities?.rewardedSilentLoading !== true) return false;
    await native.plugin.cancelRewarded();
    return true;
  } catch { return false; }
}

// Débite les points de l’action.
export async function consumeAdCredit(content) {
  if (ADS_PAUSED && !(await isUnityAdsAvailable())) return false;
  try {
    const { ok } = await apiPost('ad-reward', { action: 'consume', ...(content ? { content } : { localAction: true }) });
    return !!ok;
  } catch {
    return false;
  }
}

// ── Publicité plein écran aux actions (application Android uniquement) ──────
// Équivalent natif de la pub au clic du site (lib/actionAd.ts).
// Chaque action peut demander une publicité immédiatement. Le SDK gère le
// chargement et confirme son affichage complet ; aucun délai local n'est imposé.
// Emplacement interstitiel créé par défaut avec chaque jeu Unity.
export const UNITY_INTERSTITIAL_PLACEMENTS = { android: 'Interstitial_Android', ios: 'Interstitial_iOS' };

/** Une publicité absente ou interrompue n’accorde aucun accès. */
export async function showNativeActionAd() {
  if (ADS_PAUSED) return { ok: false, reason: 'paused' };
  const native = await nativeUnityAds();
  if (!native || !native.plugin.showInterstitial) return { ok: false, reason: 'unavailable' };
  try {
    const result = await native.plugin.showInterstitial({ gameId: UNITY_GAME_IDS[native.platform], placementId: UNITY_INTERSTITIAL_PLACEMENTS[native.platform] });
    if (result?.shown === true && result.completed === true) return { ok: true };
    return { ok: false, reason: result?.shown && result.completed === undefined ? 'update_required' : result?.reason || 'skipped' };
  } catch { return { ok: false, reason: 'unavailable' }; }
}

export async function configureDisplayAds(enabled, surface, isCurrent) {
  const native = await nativeUnityAds();
  if (native?.platform !== 'android') return;
  try {
    const capabilities = await native.plugin.getCapabilities();
    if (capabilities.adMobDisplayAds && isCurrent()) {
      await native.plugin.configureDisplayAds({ enabled, surface });
    }
  } catch { /* Older builds and unavailable ads leave the interface usable. */ }
}

export async function supportsRewardedInterstitial() {
  const native = await nativeUnityAds();
  if (native?.platform !== 'android') return false;
  try { return (await native.plugin.getCapabilities()).adMobRewardedInterstitial === true; }
  catch { return false; }
}
