// lib/storeRedirect.js — Qui a le droit de voir le SITE (hors application).
//
// Sur Android, les publicités passent par AdMob, donc par l'application : un
// navigateur ou une PWA Android est dérouté vers Google Play. iPhone/iPad et
// ordinateur gardent le site (publicités Adsterra).
//   'allow'   → application Android (WebView), iPhone/iPad ou ordinateur : site normal.
//   'android' → navigateur ou PWA Android : redirection automatique vers Google Play.
// Désactivation d'urgence : NEXT_PUBLIC_IOS_WEB_ONLY=0 (lu au build).

export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.Asrar';

export function webGateEnabled(flag) {
  return String(flag ?? '') !== '0';
}

export function storeGate({ native = false, ios = false, ua = '', enabled = true } = {}) {
  if (!enabled || native || ios) return 'allow';
  return /android/i.test(String(ua)) ? 'android' : 'allow';
}

// Ouvre l'application si elle est installée, sinon Google Play (geste utilisateur requis).
export function openAppIntent() {
  return 'intent://open#Intent;scheme=asrarpro;package=com.Asrar;S.browser_fallback_url='
    + encodeURIComponent(PLAY_STORE_URL) + ';end';
}
