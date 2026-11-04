// lib/platform.js — Type d'appareil d'un visiteur, d'après son user-agent
// (pages/api/track.js). Pour savoir quelle part des utilisateurs est sur
// l'application Android, sur le site Android, sur iPhone ou sur ordinateur —
// décision « version iOS ou non », suivi de la migration vers l'application.
// Seule la CATÉGORIE est conservée, jamais le user-agent lui-même.
//
// L'application Android (Capacitor) charge le site dans une WebView, dont le
// user-agent contient « ; wv) » : c'est ce qui la distingue de Chrome.

/** @returns {'android_app'|'android_web'|'ios'|'desktop'} */
function platformOf(ua) {
  const s = String(ua || '');
  if (/android/i.test(s)) return /;\s*wv\)/i.test(s) ? 'android_app' : 'android_web';
  if (/iphone|ipad|ipod/i.test(s)) return 'ios';
  return 'desktop';
}

const PLATFORMS = ['android_app', 'android_web', 'ios', 'desktop'];

module.exports = { platformOf, PLATFORMS };
