// lib/inFeedAds.js — Règles des encarts publicitaires dans les listes et des
// bannières fixes de l'application (voir components/InFeedAd.js et
// components/AndroidDisplayAds.js).

// Un encart après chaque groupe de IN_FEED_EVERY cartes, jamais en fin de
// liste : il y a toujours plus de contenu que de publicité (règle AdMob/Play).
export const IN_FEED_EVERY = 6;

export function inFeedAdAfter(index, total, every = IN_FEED_EVERY) {
  const position = index + 1;
  return position % every === 0 && position < total;
}

// Écran → bannière native AdMob (UnityAdsPlugin.configureDisplayAds) :
// bannière fixe en bas pour le Marché, les Secrets mystiques et la
// Bibliothèque ; encart natif pour le menu.
export function displaySurface(path) {
  if (path === '/') return 'home';
  if (path === '/menu') return 'menu';
  if (path === '/asrar') return 'secrets';
  if (path === '/bibliotheque') return 'library';
  return '';
}
