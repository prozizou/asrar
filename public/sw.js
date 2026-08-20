// sw.js — Service Worker d'ASRAR PRO (app Next.js unifiée, scope "/").
//
// Rôle UNIQUE : satisfaire les critères d'installabilité PWA (bannière
// « Installer l'application » sur Android/Chrome — un service worker
// enregistré, avec un gestionnaire 'fetch', reste vérifié par certains
// navigateurs). PAS de mode hors-ligne : toutes les données de l'app
// viennent de Firebase/des API `/api/*`, qui ont de toute façon besoin du
// réseau — mettre les pages/assets en cache ne servirait qu'à risquer de
// servir du contenu périmé (voir l'historique : SW_VERSION < v24 faisait du
// cache-first sur les assets et du network-first-avec-repli-cache sur les
// pages, ce qui exigeait un rechargement — parfois un vidage de cache manuel
// — après chaque déploiement).
//
// Donc : AUCUNE mise en cache, ici. Chaque requête part directement au
// réseau, sans jamais passer par `caches`. Le contenu est TOUJOURS frais.
//
// Mise à jour : incrémenter SW_VERSION à chaque changement de ce fichier
// (purge les caches laissés par d'anciennes versions, cf. activate).
// skipWaiting + clients.claim → le nouveau SW prend la main immédiatement ;
// components/PwaGate.js écoute 'controllerchange' et recharge la page une
// fois pour que le JS déjà chargé en mémoire reparte du nouveau build.

const SW_VERSION = 'v24';

// Répond à une demande de version depuis la page (voir components/AppDrawer.js
// « Version de l'app » — reflète la version du SW réellement actif sur
// l'appareil, plus fidèle que package.json qui n'est presque jamais bumpé).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_VERSION' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ version: SW_VERSION });
  }
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Purge tout cache laissé par une version antérieure (avant v24, qui
  // mettait pages/assets/images en cache) — sans ça, ces entrées périmées
  // resteraient indéfiniment dans le stockage du navigateur sans jamais
  // être relues (plus aucun code ne les consulte).
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Gestionnaire 'fetch' minimal : laisse tout passer au réseau, sans jamais
// lire ni écrire dans `caches`. Présent uniquement pour l'installabilité —
// voir le commentaire d'en-tête.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
