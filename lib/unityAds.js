'use client';
// Pont natif UnityAds : LevelPlay pour les actions dans les nouveaux APK configurés.
// Crédits historiques récompensés Unity Ads — alternative à l'abonnement dans l'APK
// (« une publicité regardée = une utilisation »). Unity n'a pas de SDK web :
// l'affichage passe par le plugin natif « UnityAds »
// (android/.../UnityAdsPlugin.java). Sur le site et la PWA, ou dans un APK
// antérieur au plugin, isUnityAdsAvailable() renvoie false et l'option n'est
// pas proposée.
//
// Le crédit n'est JAMAIS accordé par l'app : seul le rappel signé des serveurs
// Unity (/api/unity-ads-callback) le crée — cf. server/adReward.js.
import { apiPost } from './api';

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
  try { return (await native.plugin.getCapabilities()).legacyRewards !== false; }
  catch { return true; } // Older APKs expose only the Unity S2S bridge.
}

// Optional hint introduced in Android 8.0.3; never authorizes an action or proves readiness.
// Old APKs keep working unchanged.
let preparationRevision = 0;
export async function prepareNativeActionAd(enabled = true) {
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Affiche une publicité récompensée et attend sa validation par le serveur.
 * @returns {Promise<{ok:true} | {ok:false, reason:'unavailable'|'no_fill'|'skipped'|'pending'|'error'}>}
 *   pending : publicité regardée mais rappel Unity pas encore reçu — le crédit
 *   sera utilisable dès son arrivée (prochaine ouverture d'un module).
 */
export async function watchRewardedAd() {
  const native = await nativeUnityAds();
  if (!native) return { ok: false, reason: 'unavailable' };

  let session;
  try {
    session = await apiPost('ad-reward', { action: 'start' });
  } catch {
    return { ok: false, reason: 'error' };
  }

  let shown;
  try {
    shown = await native.plugin.showRewarded({
      gameId: UNITY_GAME_IDS[native.platform],
      placementId: UNITY_REWARDED_PLACEMENTS[native.platform],
      serverId: session.serverId,
    });
  } catch (e) {
    return { ok: false, reason: e?.code === 'no_fill' ? 'no_fill' : 'error' };
  }
  if (!shown?.completed) return { ok: false, reason: 'skipped' };

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

// Consomme un crédit gagné : true si l'utilisation est accordée.
export async function consumeAdCredit() {
  try {
    const { ok } = await apiPost('ad-reward', { action: 'consume' });
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
  const native = await nativeUnityAds();
  if (!native || !native.plugin.showInterstitial) return { ok: false, reason: 'unavailable' };
  try {
    const result = await native.plugin.showInterstitial({ gameId: UNITY_GAME_IDS[native.platform], placementId: UNITY_INTERSTITIAL_PLACEMENTS[native.platform] });
    if (result?.shown === true && result.completed === true) return { ok: true };
    return { ok: false, reason: result?.shown && result.completed === undefined ? 'update_required' : result?.reason || 'skipped' };
  } catch { return { ok: false, reason: 'unavailable' }; }
}
