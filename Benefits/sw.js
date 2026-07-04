// sw.js (Benefits) — DÉSACTIVÉ : remplacé par le SW racine /sw.js (scope "/").
// Ce fichier "kill switch" purge les anciens caches et se désenregistre lui-même
// chez les utilisateurs qui avaient l'ancienne version installée.
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => (k.startsWith('asma-') ? caches.delete(k) : null))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll())
      .then((clients) => clients.forEach((c) => c.navigate(c.url))) // rebranche sur le SW racine
  );
});
