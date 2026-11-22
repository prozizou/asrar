# Diagnostics de l’application — SW v46.94

Le panneau séparé `prozizou/admin-asrar-pro` (SW admin-v38) lit les incidents
via son API `/api/diagnostics`, après vérification du jeton non révoqué et du
rôle administrateur. La rubrique « Bugs et lenteurs » est dans le menu Plus
sur mobile. Aucune configuration Firebase ni service externe supplémentaire
n’est nécessaire ; les nouveaux chemins restent privés par les règles racine.

## Ce qui remonte

- Erreurs JavaScript non interceptées, rejets de promesses, erreurs React et
  échecs de chargement des scripts/styles.
- Appels `apiPost` en erreur réseau, expiration, HTTP 5xx ou JSON invalide ;
  les refus attendus 4xx ne sont pas des bugs. Réponses réussies strictement au-delà de 1 000 ms, corps JSON et authentification compris.
- Tâches bloquantes de l’interface strictement au-delà de 1 000 ms, via
  `PerformanceObserver` Long Tasks sur Chrome/Android. Les périodes masquées
  sont exclues. Une durée de 1 000,1 ms est arrondie au supérieur pour conserver
  le franchissement du seuil dans RTDB.
- Sans Long Tasks, repli par heartbeat toutes les 250 ms : son retard strictement
  au-delà de 1 000 ms est signalé. Les longues mises en veille et les périodes
  masquées sont ignorées. Cette mesure de repli reste une estimation du retard.
- Erreurs serveur passant par `server/log.js`, avec une attente de persistance
  plafonnée à 1,5 s pour ne pas retenir la réponse d’erreur initiale.

Le suivi est best-effort. Il ne capture pas chaque comportement incorrect,
les exceptions volontairement absorbées par le code, les actions hors ligne
perdues, ni un crash natif avant le chargement du JavaScript. Aucun espionnage
de `fetch`, des formulaires, des conversations ou de `console` n’est installé.
Les positions de fichiers minifiés permettent de localiser le build concerné ;
il n’y a pas de capture d’écran automatique ni de session vidéo.

## Données et limites

Le client et le serveur appliquent le même nettoyage : type/nom d’erreur
allowlistés, positions de fichiers sans nom/arguments des fonctions, chemins
sans paramètres ni fragments (identifiants longs et e-mails masqués), version,
catégorie d’appareil, état de connexion, durée et code HTTP. Le message libre
d’Error n’est jamais persisté. Seul le serveur peut associer l’UID d’une session
vérifiée ; l’UID envoyé librement par le client est ignoré.

Les transmissions utilisent HTTPS et un éventuel jeton Firebase pour vérifier
la session ; ce jeton n’est pas enregistré dans le diagnostic. Aucun nom,
e-mail, modèle exact d’appareil, user-agent brut ni IP brute n’est conservé.
L’empreinte servant au quota d’IP change chaque jour. Les logs Vercel et
l’éventuel `ERROR_WEBHOOK_URL` préexistant gardent leur fonctionnement propre.

La file mémoire contient au plus 20 événements, avec déduplication sur une
minute pour les erreurs, au plus 12 types distincts/minute, lots de 5 toutes
les 5 secondes et
sur sortie/mise en arrière-plan. Les lenteurs répétées encore en file sont regroupées avec un compteur
d’occurrences et leur durée maximale ; le serveur cumule ces occurrences dans
RTDB. Il ne conserve pas les lenteurs de 1 000 ms ou moins. Pas de stockage
persistant ni de boucle de réessai. Le serveur limite à 20 requêtes/minute/IP en mémoire, puis applique
par transactions partagées un plafond de 2 000 tentatives/jour globalement et
100 événements/jour/source (IP ou portée serveur). Des occurrences peuvent
être écartées ; les chiffres ne sont pas un décompte exhaustif des bugs.

`app_diagnostics/{jourUTC}_{empreinte}` regroupe par type, page, fichier,
version, appareil et code HTTP. Chaque nouvelle occurrence rouvre son groupe.
La résolution admin vérifie le compteur attendu en transaction : un événement
arrivé entre la lecture et la résolution impose une actualisation. Les actions
admin sont auditées. L’API renvoie au plus 500 groupes des jours les plus récents,
avec un avertissement lorsque cette limite rend l’affichage partiel.

Le cron quotidien existant `/api/cron/reminders` nettoie les diagnostics et
quotas sur une fenêtre de 30 dates UTC, par requêtes sur clés indexées, bornées
à 3 lots de 2 000 suppressions par collection. Une panne du nettoyage apparaît
dans `cron_health/reminders` et les journaux serveur ; après une longue panne,
plusieurs passages peuvent être nécessaires pour résorber le retard.

## Enregistrer un rapport TXT sur le téléphone

Dans l’administration, ouvrir **Plus → Bugs et lenteurs** depuis le navigateur
mobile. **Enregistrer en TXT** télécharge un incident. **Exporter les résultats
en TXT** télécharge les groupes qui correspondent aux filtres actifs, dans la
limite de la liste chargée (500 groupes). Le fichier UTF-8 contient la page,
la version, les durées exactes en millisecondes, les dates UTC, les occurrences
et les positions des fichiers. Le téléchargement est initié par un clic et le
navigateur propose son enregistrement dans les téléchargements du téléphone.

Le fichier est généré localement à partir des données déjà autorisées du
panneau. Aucun tiers ne reçoit le rapport. Ce fichier reste sur l’appareil
jusqu’à sa suppression par la personne qui l’a enregistré ; la purge RTDB
ne supprime pas les copies exportées. Le partage du fichier pour correction
reste une action volontaire de l’administrateur. L’application Android ne
requiert pas de nouveau binaire pour le seuil ; cet export est disponible dans
le navigateur qui ouvre l’administration.

## Vérification

`tests/diagnostics.test.js` couvre confidentialité, déduplication, concurrence,
quotas, rétention, réouverture, identités vérifiées, heartbeat et erreurs API.
`e2e/authenticated/diagnostics.spec.ts` utilise les vrais émulateurs Auth/RTDB
pour vérifier réception, confidentialité, refus de lecture directe et envoi
navigateur automatique. Les tests du dépôt admin couvrent les permissions,
la résolution atomique et les parcours mobile/ordinateur.
