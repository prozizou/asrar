# Reprise du catalogue de l’accueil — v46.96

Un rapport v46.93 indiquait une erreur API sur `/api/list-content`, sans code
HTTP, après 1 034 ms. Cela correspond à un échec de transport côté navigateur,
avec aucune réponse HTTP exploitable ; le rapport ne permet pas d’attribuer
la cause au réseau mobile, au navigateur ou à la liaison vers l’hébergement.
Le drapeau « En ligne » indique seulement l’état déclaré par le téléphone.

Le chargement initial de l’accueil ne reprenait pas après cet échec. Les lectures
des produits et boutiques passent maintenant par `readCatalog` : au maximum deux
tentatives, séparées de 400 ms, pour une erreur réseau brève ou HTTP 502/503/504.
Un refus 4xx ou une requête ayant déjà expiré après 15 s n’est pas répété.
Aucune écriture, commande, paiement ou envoi de message ne passe par ce helper.

Le chargement possède un seul appel actif. Une remise en ligne ou un retour au
premier plan après un échec déclenche une reprise, sans rechargement de la page.
Les événements arrivés pendant l’appel sont regroupés en une seule reprise si
l’appel échoue encore. Un échec persistant affiche un bouton de reprise manuelle.
Quitter la page annule les timers et empêche de nouveaux appels ou mises à jour
d’état ; une lecture déjà partie peut finir côté serveur, sans effet sur l’UI.

Les boutiques restent facultatives pour afficher les produits. Après une lecture
partielle, leurs métadonnées sont reprises au retour du réseau. Un lien vers une
boutique absente pendant la coupure est conservé jusqu’à sa vérification effective.
Une réponse invalide n’est pas transformée en catalogue vide. L’identité Firebase
est toujours vérifiée par chaque endpoint ; aucun droit n’est mémorisé côté client.

Les diagnostics continuent de recevoir les échecs initiaux. Les nouveaux rapports
identifient les erreurs réseau par `NetworkError`, les délais par `AbortError` et
les réponses JSON invalides par `SyntaxError`. Les données sensibles et messages
libres restent exclus. L’état « À traiter » du rapport historique n’est pas modifié
automatiquement : une meilleure reprise ne supprime pas la cause d’une panne réseau.

Les tests couvrent seconde tentative, plafond, refus et délais non répétés,
absence de requête hors ligne, annulation et classification des diagnostics.
Les scénarios Auth/RTDB simulent de vraies coupures de requête dans Chromium,
la reprise manuelle, la remise en ligne et la conservation d’un lien boutique.
