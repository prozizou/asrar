# Notifications : livraison et exploitation

Les nouveaux secrets, livres, produits, validations de Zikr et messages de
discussion enregistrent leur contenu et leur tâche de notification dans une
écriture RTDB atomique. Les notifications d'activation d'accès et de boutique
passent aussi par la file, après la mise à jour métier existante.

Le producteur répond après persistance. Sur Vercel, `waitUntil` lance le
worker après la réponse ; `/api/cron/notifications` reprend les tâches
interrompues ou en attente. Les rappels horaires de sessions/planètes et les
alertes de récitation conservent leur circuit direct existant.

## Mise en service

1. Déployer les règles `rules/database.rules.json`, notamment les index de
   `notification_jobs`, `push_subscriptions` et `fcm_devices`. Ce fichier
   conserve l'interdiction des lectures/écritures privées côté client.
2. Configurer `CRON_SECRET` côté serveur et le secret GitHub du même nom ;
   vérifier la variable de dépôt `ASRAR_SITE_URL` si le domaine diffère.
3. Activer le workflow `Notification queue` et lancer une exécution manuelle.
   Son appel authentifié doit répondre HTTP 200. La planification GitHub
   toutes les cinq minutes reste indicative : elle peut être retardée.
   Pour un délai de reprise garanti par votre infrastructure, utiliser un
   ordonnanceur externe appelant l'endpoint chaque minute avec l'en-tête
   `Authorization: Bearer <CRON_SECRET>`.
4. Conserver les paramètres VAPID existants pour Web Push et les droits FCM
   du compte de service pour Android. Vérifier les deux sur des appareils de
   recette avant le déploiement général.

Une invocation traite au plus 40 tâches, quatre en parallèle, avec un
budget de boucle de 35 secondes. Chaque diffusion avance par pages de 20
comptes issus de `user_sessions`, puis crée une tâche par destinataire.
Chaque livraison traite au plus deux appareils à la fois parmi les dix
derniers abonnements Web et dix derniers appareils FCM du compte. Les
abonnements FCM désactivés sont ignorés. Un compte en panne ne bloque pas
les autres ; des invocations suivantes résorbent les gros volumes.

## Reprise et supervision

Une tâche possède un bail de trois minutes et un propriétaire unique. Un
worker peut reprendre un bail expiré après une interruption. Les erreurs
transitoires sont retentées après 1, 2, 4 et 8 minutes ; la cinquième erreur
place la tâche en `dead`. Les accusés déjà enregistrés restent conservés.
Les abonnements Web 404/410 et jetons FCM invalides sont supprimés.

La notification dans l'application garde un identifiant stable : une
reprise ne la duplique pas et conserve son état lu. Les accusés par appareil
évitent les renvois des étapes terminées. Une interruption entre
l'acceptation par le fournisseur et l'écriture de l'accusé peut toutefois
entraîner un second push : les fournisseurs ne permettent pas de garantir
exactement un envoi. Le tag reste stable pour le regroupement Web Push.

L'API administrateur reçoit `{ idToken, action: "notification-jobs" }` et
retourne le dernier passage du worker, 25 tâches récentes et jusqu'à 25
échecs définitifs, sans contenu ni jetons d'appareil. Pour relancer après
correction de la cause : `{ idToken, action: "retry-notification", jobId }`.
Une tâche encore active refuse la relance avec HTTP 409. Aucun nouveau
écran d'administration n'est ajouté.

`cron_health/notifications` conserve l'heure du dernier passage et ses
compteurs. Surveiller l'âge de ce passage (alerte conseillée au-delà de
15 minutes), les échecs du workflow et les tâches `dead`. Un passage ayant
créé un échec définitif produit un journal `notification-worker:dead` et
utilise le webhook d'erreur existant s'il est configuré.

Les tâches terminées ou mortes sont conservées 30 jours, puis supprimées
par lots de 50 par passage. Les tâches actives ne sont pas purgées. Cette
durée est aussi la fenêtre de déduplication des événements terminés ; ne
pas réutiliser d'identifiant d'événement après sa purge. Les notifications
visibles conservent la limite existante de 200 par utilisateur.

## Validation

`npm run test:auth` utilise de vrais émulateurs Auth/RTDB, sans fournisseurs
push externes. `npm test` vérifie aussi les reprises, baux, diffusions par
pages, accusés d'appareils et suppressions d'abonnements périmés.
