// sw.js — service worker d'auto-désinscription (migration site statique → app React).
// Les anciens utilisateurs ayant installé la PWA avaient un SW qui mettait en
// cache les anciennes pages HTML. Ce SW le remplace, vide tous les caches, se
// désinscrit et recharge — pour qu'ils basculent proprement sur la nouvelle app.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((c) => c.navigate(c.url));
    } catch (e) { /* best effort */ }
  })());
});
