// sw.js — Service Worker RACINE d'ASRAR PRO (scope "/").
// Contrôle TOUT le site (hub + Benefits + Rouwhania + sous-apps).
//
// Mise à jour SUR PLACE : à chaque déploiement, changez SW_VERSION ci-dessous
// (ou modifiez ce fichier). Le nouveau SW s'installe, prend la main immédiatement
// (skipWaiting + clients.claim), purge les anciens caches, et pwa.js recharge la
// page automatiquement → l'utilisateur voit la nouvelle version sans rien faire.

const SW_VERSION = 'v48';                 // ← incrémenter à chaque mise à jour
const CACHE = 'asrar-' + SW_VERSION;

// Coquille minimale : pages/ressources clés. Le reste est mis en cache à la volée
// (network-first). Liste tolérante : un fichier manquant ne casse pas l'install.
const APP_SHELL = [
  '/',
  '/index.html',
  '/accueil/accueil.html',
  '/css/style.css',
  '/js/firebase-config.js',
  '/js/whatsapp.js',
  '/js/share.js',
  '/parrainage/parrainage.html',
  '/js/main.js',
  '/pwa.js',
  '/manifest.json',
  '/assets/logo-full.png',
  '/assets/logo-mark.png',
  '/assets/favicon.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png'
];

// Ne JAMAIS mettre en cache : API, liens partagés (/s → /api/share, redirection
// dynamique + comptage de clics), Firebase, gstatic, analytics tiers.
function isBypassed(url) {
  return url.pathname.startsWith('/api/') ||
         url.pathname === '/s' || url.pathname.startsWith('/s/') ||
         /(^|\.)gstatic\.com$/.test(url.hostname) ||
         /(^|\.)googleapis\.com$/.test(url.hostname) ||
         /firebaseio\.com$/.test(url.hostname) ||
         /firebasedatabase\.app$/.test(url.hostname);
}

// ── INSTALL : précache tolérant + activation immédiate ─────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(APP_SHELL.map((u) => cache.add(new Request(u, { cache: 'reload' }))))
    )
  );
});

// ── ACTIVATE : purge des anciens caches + prise de contrôle ────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : null))))
      .then(() => self.clients.claim())
  );
});

// ── MESSAGES : forcer l'activation à la demande (pwa.js) ───────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.type === 'GET_VERSION' && event.source) {
    event.source.postMessage({ type: 'VERSION', version: SW_VERSION });
  }
});

// ── FETCH ─────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin || isBypassed(url)) return; // laisser passer

  // Navigations (pages) : network-first, repli cache, puis accueil hors-ligne.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => { cachePut(req, res.clone()); return res; })
        .catch(() =>
          caches.match(req).then((c) => c || caches.match('/accueil/accueil.html') || caches.match('/'))
        )
    );
    return;
  }

  // Ressources même origine : network-first (livre les correctifs), repli cache.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') cachePut(req, res.clone());
        return res;
      })
      .catch(() => caches.match(req))
  );
});

function cachePut(req, res) {
  // On ne met en cache que les réponses complètes (évite les 206/opaques).
  if (!res || res.status !== 200 || (res.type !== 'basic' && res.type !== 'default')) return;
  caches.open(CACHE).then((cache) => cache.put(req, res)).catch(() => {});
}
