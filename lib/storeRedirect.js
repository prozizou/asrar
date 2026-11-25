// lib/storeRedirect.js — Qui a le droit de voir le SITE (hors application).
//
// Les publicités (AdMob, récompenses) ne fonctionnent que dans l'application
// Android. Le site et la PWA sont donc réservés à iOS ; tout autre navigateur
// (Android, ordinateur) est dérouté vers Google Play.
//   'allow'   → application Android (WebView) ou iPhone/iPad : site normal.
//   'android' → navigateur ou PWA Android : redirection automatique vers Google Play.
//   'other'   → ordinateur : écran invitant à installer l'application (pas de
//               redirection automatique, un ordinateur ne peut pas installer l'APK).
// Désactivation d'urgence : NEXT_PUBLIC_IOS_WEB_ONLY=0 (lu au build).

export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.Asrar';

export function webGateEnabled(flag) {
  return String(flag ?? '') !== '0';
}

export function storeGate({ native = false, ios = false, ua = '', enabled = true } = {}) {
  if (!enabled || native || ios) return 'allow';
  return /android/i.test(String(ua)) ? 'android' : 'other';
}

// Ouvre l'application si elle est installée, sinon Google Play (geste utilisateur requis).
export function openAppIntent() {
  return 'intent://open#Intent;scheme=asrarpro;package=com.Asrar;S.browser_fallback_url='
    + encodeURIComponent(PLAY_STORE_URL) + ';end';
}
