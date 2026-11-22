# Diagnostics de l’application — SW v46.93

Le panneau séparé `prozizou/admin-asrar-pro` (SW admin-v37) lit les incidents
via son API `/api/diagnostics`, après vérification du jeton non révoqué et du
rôle administrateur. La rubrique « Bugs et lenteurs » est dans le menu Plus
sur mobile. Aucune configuration Firebase ni service externe supplémentaire
n’est nécessaire ; les nouveaux chemins restent privés par les règles racine.

## Ce qui remonte

- Erreurs JavaScript non interceptées, rejets de promesses, erreurs React et
  échecs de chargement des scripts/styles.
- Appels `apiPost` en erreur réseau, expiration, HTTP 5xx ou JSON invalide ;
  les refus attendus 4xx ne sont pas des bugs. Réponses réussies dépassant 5 s.
- Retard du heartbeat d’interface de 3,5 s à moins de 30 s, seulement lorsque
  la page est visible depuis plus de 5 s. Le temps attendu de 1 s est soustrait.
  Les périodes masquées et les mises en veille longues sont ignorées.
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
minute, au plus 12 événements/minute, lots de 5, envoi dès le prochain tick et
sur sortie/mise en arrière-plan. Pas de stockage persistant ni de boucle de
réessai. Le serveur limite à 20 requêtes/minute/IP en mémoire, puis applique
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

## Vérification

`tests/diagnostics.test.js` couvre confidentialité, déduplication, concurrence,
quotas, rétention, réouverture, identités vérifiées, heartbeat et erreurs API.
`e2e/authenticated/diagnostics.spec.ts` utilise les vrais émulateurs Auth/RTDB
pour vérifier réception, confidentialité, refus de lecture directe et envoi
navigateur automatique. Les tests du dépôt admin couvrent les permissions,
la résolution atomique et les parcours mobile/ordinateur.
