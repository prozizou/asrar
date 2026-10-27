# Réduire les transferts Realtime Database

Cette application utilise Realtime Database. Sa facture dépend notamment du
stockage et des données téléchargées, pas d'un prix fixe par lecture comme
Firestore. Les optimisations réduisent donc les sondages et les données
transférées, en conservant les vérifications d'identité et de droits.

| Parcours | Avant | Après |
|---|---|---|
| Cloche et centre de notifications visibles | Sondage toutes les 12 s | Toutes les 30 s, soit au plus 120/h au lieu de 300/h, hors chargement initial |
| Page masquée ou appareil hors ligne | Sondages poursuivis | Aucun nouveau sondage ; reprise immédiate au retour |
| Badge de la cloche | Historique des 200 notifications | Requête indexée sur les notifications non lues, y compris les anciennes sans champ `read` |
| Discussion Zikr | Les 200 derniers messages toutes les 4 s | Seulement les nouveaux messages ; réconciliation complète chaque minute |
| Liste des groupes Zikr | Toutes les 6 s | Toutes les 15 s ; détail du groupe toujours toutes les 4 s au premier plan |
| Rappels de session | Tous les groupes à chaque passage | Requête indexée sur la fenêtre de rappel : de 10 minutes après à 30 minutes avant la session |
| Consultations répétées du catalogue | Relecture de la collection | Métadonnées filtrées partagées pendant 30 s dans chaque instance serveur |

Les push reçus au premier plan rafraîchissent les notifications immédiatement.
Les événements simultanés sont regroupés ; un sondage lent ne chevauche pas
le suivant. Les sondages sociaux sont aussi suspendus hors ligne et quand
la page est masquée.

## Isolation et fraîcheur

Le cache du catalogue conserve uniquement le résultat public de
`listFields`, sans PDF ni texte payant complet. Le volume JSON conservé est limité à 8 Mio par
connexion de base, 2 Mio par entrée et 32 entrées ; les réponses trop grosses
ne sont pas conservées. Les requêtes simultanées partagent leur lecture en
cours. Une erreur ne reste pas en cache. Une invalidation empêche aussi une
ancienne requête en cours de réintroduire des métadonnées périmées.

Les modifications effectuées par les API admin/boutique invalident le cache
de l'instance concernée. Les autres instances ou modifications provenant de
la console Firebase peuvent rester visibles avec un délai maximal de
30 secondes. Cette optimisation n'ajoute aucun cache persistant dans le navigateur.

Chaque requête vérifie toujours l'identité. Côté serveur, les autorisations d'abonnement,
les contenus payants, les commandes et les adhésions Zikr ne sont pas mis
en cache. La lecture incrémentale de la discussion revérifie l'adhésion à
chaque appel ; les réponses en retard d'un ancien groupe sont ignorées.
La réconciliation complète de la discussion prend en compte les corrections
et suppressions administratives au plus tard au prochain rafraîchissement
complet, tant que la page est active.

## Mise en service et mesure

Déployer les règles/index de `rules/database.rules.json` :

- `notifications/$uid` : index `read`, en plus de `createdAt` ;
- `zikr_groups` : index `sessionAt`.

Les horaires `sessionAt` doivent être des timestamps numériques, comme ceux
écrits par l'application. Vérifier les anciennes données saisies à la main
si elles contiennent des dates en texte. Les permissions privées restent
interdites aux lectures/écritures directes du client.

Les tests de `tests/firebase-cost.test.js` instrumentent le nombre de
lectures et le volume JSON retourné par les requêtes sur des fixtures :

- 200 notifications dont 190 lues : même badge, moins de 6 % du volume de
  l'historique ;
- 50 consultations concurrentes du catalogue : une seule lecture ;
- 200 messages inchangés : résultat incrémental vide, moins de 0,1 % du
  volume du premier chargement, contrôle d'adhésion inclus ;
- 1 000 groupes hors fenêtre et un groupe imminent : seul le groupe
  imminent est téléchargé, moins de 0,1 % du volume de la collection.

Ces mesures contrôlées excluent le protocole réseau, les mécanismes de
cache du SDK et la consommation réelle des utilisateurs. Elles ne prédisent
pas une baisse identique de la facture globale. Comparer les téléchargements
et connexions dans la console Firebase avant/après déploiement, à trafic
comparable. Aucun montant d'économie en production n'est annoncé sans ces
mesures.

Les statistiques sociales globales, les compteurs administrateur, le scan
des achats pour les rappels d'abonnement et les annuaires de boutique restent
des pistes suivantes : leur remplacement demande des agrégats/index métier
et une migration des données existantes. Ils ne bénéficient pas implicitement
du cache public ajouté ici.
