// lib/androidApp.js — Application Android (Google Play) pour les visiteurs
// Android du site. Logique pure, sans React : décision de redirection et liens.
//
// Sur Android, ASRAR PRO s'utilise avec l'application (publicités Unity, plus
// rentables que les publicités web) ; iPhone et ordinateur restent sur le site.
// L'application charge ce même site (capacitor.config.ts → server.url) : la
// redirection ne doit JAMAIS s'appliquer dans l'application elle-même.

export const ANDROID_PACKAGE = 'com.Asrar';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=' + ANDROID_PACKAGE;
// « Plus tard » réservé aux visiteurs qui ne peuvent pas installer (téléphone
// sans Google Play, version d'Android trop ancienne) : 7 jours sur le site.
export const SKIP_KEY = 'asrar_android_web_until';
export const SKIP_MS = 7 * 24 * 60 * 60 * 1000;

// Robots et aperçus de liens (Googlebot smartphone a un user-agent Android) :
// jamais redirigés, sinon le site disparaîtrait des moteurs de recherche.
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegrambot|lighthouse|headlesschrome|preview/i;

/**
 * @param {{ ua?: string, native?: boolean, flag?: string, skipUntil?: number, now?: number }} p
 *   flag : NEXT_PUBLIC_ANDROID_APP_REDIRECT ('0' désactive la redirection).
 */
export function shouldRedirectToApp({ ua = '', native = false, flag, skipUntil = 0, now = Date.now() } = {}) {
  if (flag === '0' || native) return false;
  if (!/android/i.test(ua) || BOT.test(ua)) return false;
  return !(skipUntil > now);
}

// Lien d'ouverture : lance l'application si elle est installée (intent-filter
// asrarpro://open, AndroidManifest.xml), sinon Chrome suit la page Google Play
// (S.browser_fallback_url). Une application installée sans ce lien (version
// plus ancienne) mène aussi à Google Play, qui propose « Ouvrir » ou « Mettre à jour ».
export function openAppIntentUrl() {
  return 'intent://open#Intent;scheme=asrarpro;package=' + ANDROID_PACKAGE +
    ';S.browser_fallback_url=' + encodeURIComponent(PLAY_STORE_URL) + ';end';
}
