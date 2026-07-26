// sw.js — Service Worker d'ASRAR PRO (app Next.js unifiée, scope "/").
// Objectif : rendre l'app installable (PWA) + fonctionner hors-ligne, SANS
// jamais servir de vieux contenu quand l'utilisateur est en ligne.
//
// Stratégies :
//   • Navigations (pages) → NETWORK-FIRST : on tente le réseau (dernière version),
//     repli sur le cache si hors-ligne. → pas de page figée en ligne.
//   • Assets versionnés (/_next/static/*, /assets/*) → CACHE-FIRST (immuables).
//   • /api/*, /s, Firebase/Google et APIs tierces → JAMAIS mis en cache.
//
// Mise à jour : incrémenter SW_VERSION à chaque changement de stratégie de cache.
// skipWaiting + clients.claim → le nouveau SW prend la main immédiatement.

const SW_VERSION = 'v1';
const CACHE = 'asrar-pwa-' + SW_VERSION;

// Coquille minimale précachée (tolérante : un manquant ne casse pas l'install).
const CORE = [
  '/',
  '/manifest.json',
  '/assets/logo-mark.png',
  '/assets/favicon.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
];

// Ressources à ne JAMAIS intercepter/mettre en cache.
function isBypassed(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.pathname === '/s' ||
    url.pathname.startsWith('/_next/data/') ||
    /(^|\.)gstatic\.com$/.test(url.hostname) ||
    /(^|\.)googleapis\.com$/.test(url.hostname) ||
    /(^|\.)google\.com$/.test(url.hostname) ||
    /firebaseio\.com$/.test(url.hostname) ||
    /firebasedatabase\.app$/.test(url.hostname) ||
    /firebaseapp\.com$/.test(url.hostname) ||
    /bigdatacloud\.net$/.test(url.hostname) ||
    /sunrise-sunset\.org$/.test(url.hostname)
  );
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(CORE.map((u) => cache.add(new Request(u, { cache: 'reload' }))))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : null))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return; // cross-origin → laisser passer
  if (isBypassed(url)) return;

  // Assets versionnés → cache-first.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          })
      )
    );
    return;
  }

  // Navigations / HTML → network-first, repli cache puis '/'.
  const accept = req.headers.get('accept') || '';
  if (req.mode === 'navigate' || accept.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('/')))
    );
    return;
  }

  // Reste → réseau, repli cache.
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
