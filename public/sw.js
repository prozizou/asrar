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

const SW_VERSION = 'v25';

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

// Gestionnaire 'fetch' minimal : ne fait RIEN (pas d'event.respondWith()) —
// le navigateur traite alors la requête normalement, comme en l'absence de
// service worker. Présent uniquement pour l'installabilité PWA (voir le
// commentaire d'en-tête) : la simple présence du gestionnaire suffit, il n'a
// pas besoin de répondre lui-même.
//
// PIÈGE ÉVITÉ ICI (régression constatée en production sur v24, corrigée en
// v25) : `event.respondWith(fetch(event.request))` semblait un pass-through
// neutre ("aucune mise en cache, juste relayer"), mais un fetch() émis
// DEPUIS le service worker est vérifié par le navigateur contre la CSP
// `connect-src` — PAS contre la directive native de la ressource
// (`script-src` pour un script, `font-src` pour une police…). Résultat :
// les polices Google Fonts et le loader GAPI (apis.google.com), pourtant
// autorisés par font-src/script-src, étaient bloqués dès qu'ils passaient
// par ce relais. Ne JAMAIS appeler respondWith() ici pour un simple
// pass-through — soit on répond vraiment (avec une vraie logique, ex. un
// cache), soit on n'intercepte pas du tout.
self.addEventListener('fetch', () => {});
