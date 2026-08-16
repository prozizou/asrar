// sw.js — Service Worker d'ASRAR PRO (app Next.js unifiée, scope "/").
// Objectif : rendre l'app installable (PWA) + fonctionner hors-ligne, SANS
// jamais servir de vieux contenu quand l'utilisateur est en ligne.
//
// Stratégies :
//   • Navigations (pages) → NETWORK-FIRST : on tente le réseau (dernière version),
//     repli sur le cache si hors-ligne. → pas de page figée en ligne.
//   • Assets versionnés (/_next/static/*, /assets/*) → CACHE-FIRST (immuables).
//   • Images distantes Cloudinary → STALE-WHILE-REVALIDATE : on sert l'image
//     depuis le cache immédiatement (pas de re-téléchargement) tout en la
//     rafraîchissant en arrière-plan. Cache borné (IMG_MAX) → on garde les
//     dernières images sans faire grossir le stockage indéfiniment.
//   • /api/*, /s, Firebase/Google et APIs tierces → JAMAIS mis en cache.
//
// Mise à jour : incrémenter SW_VERSION à chaque changement de stratégie de cache.
// skipWaiting + clients.claim → le nouveau SW prend la main immédiatement.

const SW_VERSION = 'v17';
const CACHE = 'asrar-pwa-' + SW_VERSION;
const IMG_CACHE = 'asrar-img-' + SW_VERSION; // cache dédié aux images distantes.
const IMG_MAX = 60; // nombre d'images conservées (LRU approximatif).

// Image hébergée sur Cloudinary (cross-origin) → éligible au cache images.
function isCloudinaryImage(url) {
  return /(^|\.)res\.cloudinary\.com$/.test(url.hostname);
}

// Repli ultime : garantit TOUJOURS un vrai Response à respondWith(), même si
// le réseau ET le cache échouent tous les deux. Sans ça, une chaîne qui finit
// par résoudre `undefined` fait planter le navigateur avec
// "TypeError: Failed to convert value to 'Response'" au lieu d'une simple
// erreur réseau propre.
function offlineFallback() {
  return new Response('', { status: 503, statusText: 'Offline' });
}

// Limite la taille d'un cache : supprime les entrées les plus anciennes (FIFO).
async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

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

// Répond à une demande de version depuis la page (voir components/AppDrawer.js
// « Version de l'app » — reflète désormais la version du SW réellement actif
// sur l'appareil, plus fidèle que package.json qui n'est presque jamais bumpé).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_VERSION' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ version: SW_VERSION });
  }
});

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
      .then((keys) =>
        Promise.all(keys.map((k) => (k !== CACHE && k !== IMG_CACHE ? caches.delete(k) : null)))
      )
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
  // Images Cloudinary (cross-origin) → stale-while-revalidate dans un cache borné.
  if (isCloudinaryImage(url)) {
    event.respondWith(
      caches.open(IMG_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          const network = fetch(req)
            .then((res) => {
              // On ne met en cache que les réponses exploitables (200 ou opaques).
              if (res && (res.ok || res.type === 'opaque')) {
                cache.put(req, res.clone());
                trimCache(IMG_CACHE, IMG_MAX);
              }
              return res;
            })
            .catch(() => cached || offlineFallback()); // hors-ligne, rien en cache → repli garanti.
          return cached || network; // cache d'abord (rapide), sinon réseau.
        })
      )
    );
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
        .catch(() =>
          caches
            .match(req)
            .then((c) => c || caches.match('/'))
            .then((c) => c || offlineFallback())
        )
    );
    return;
  }

  // Reste → réseau, repli cache.
  event.respondWith(fetch(req).catch(() => caches.match(req).then((c) => c || offlineFallback())));
});
