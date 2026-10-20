'use client';
// Publicités récompensées Unity Ads — alternative à l'abonnement dans l'APK
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
  return !!(await nativeUnityAds());
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
