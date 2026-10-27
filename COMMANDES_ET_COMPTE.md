# Commandes, compte et données personnelles

## Demande, achat et paiement

Le bouton du marché prépare une **demande WhatsApp**, pas une vente. Le serveur
relit `det_produits/{key}`, retrouve le compte Auth vérifié du propriétaire et
vérifie ses droits vendeur (ou son profil boutique historique). Prix, devise,
coordonnées et vendeur du navigateur ne sont jamais utilisés pour créer la demande.
La quantité est une unité. Le prix est figé lors de la première création ; une
modification ultérieure du catalogue ne modifie pas cette demande.

`orders_v2/{sha256(buyerUid:requestId)}` conserve le snapshot et son historique.
Une référence réutilisée après une coupure retrouve la même demande. Le vendeur
ou un administrateur peut effectuer les étapes suivantes :

| État | Signification | Étape suivante |
| --- | --- | --- |
| `whatsapp_request` | Demande de contact enregistrée | Confirmation ou annulation |
| `confirmed` | Commande acceptée par la boutique | Paiement déclaré ou annulation |
| `paid` | Réception du paiement déclarée manuellement | Livraison déclarée |
| `delivered` | Livraison déclarée | État final |
| `cancelled` | Demande annulée | État final |

L’acheteur peut annuler sa demande initiale ; il ne peut déclarer ni paiement
ni livraison. Chaque changement enregistre acteur, rôle, date et note éventuelle.
Aucun prestataire de paiement ne confirme automatiquement les paiements.

Le lien WhatsApp contient une capacité aléatoire valable quinze minutes,
renouvelable par l’acheteur authentifié. Son ouverture est journalisée une fois,
sans confirmer une commande. Ne pas partager ou conserver ces liens dans des
outils statistiques. Aucun appel WhatsApp réel n’est effectué par les tests.

- `/commandes` : demandes personnelles et historique, pagination par 50.
- `/commandes?vue=boutique` : demandes reçues et changements de statut.
- `/commandes?vue=administration` : cent dernières demandes, accès administrateur.
- Les anciens `orders/{uid}` restent des demandes **non vérifiées** ; ils ne
  deviennent jamais des ventes ni des paiements. Les anciens compteurs de clics
  `orders_count` sont conservés mais ne servent plus de statistiques de vente.

## Compte et confidentialité

`/compte` affiche le nom, l’adresse, le palier et l’échéance effective. Le nom
est modifiable pour son propre compte. Les statistiques facultatives sont
refusées par défaut. Leur désactivation ne purge pas l’historique existant.
La dernière session reste une donnée opérationnelle.

Désactiver les notifications externes supprime les inscriptions Web Push/FCM
et empêche leur réinscription automatique ; la boîte de notifications interne
reste disponible. Réactiver ce réglage peut nécessiter une nouvelle inscription
ou autorisation sur chaque appareil.

L’export immédiat couvre le compte, l’abonnement, les réglages, jusqu’à 500
commandes acheteur et 500 anciennes demandes, les 200 notifications retenues et
la dernière session. Le fichier indique son périmètre et une éventuelle troncature.
Il exclut les secrets d’accès et les jetons d’appareil. Ce n’est pas un export
exhaustif des contenus partagés. Export et demandes exigent une connexion récente
(quinze minutes) ; les sessions révoquées sont refusées.

**La suppression est une demande suivie, pas un effacement automatique.** Le
compte reste actif pendant l’examen. La page administrateur du compte permet de
prendre en charge la demande et de communiquer une réponse visible par son auteur.
Une seule demande en attente est conservée par compte ; les demandes closes peuvent
être remplacées par une nouvelle demande. Ne pas utiliser cette liste comme archive
juridique immuable.

## Traitement administratif d’une demande

1. Examiner `privacy_requests/{uid}` et vérifier l’identité du demandeur. Passer
   la demande en cours de traitement depuis le compte administrateur.
2. Pour un export complet, inventorier les données par UID **et** adresse e-mail :
   Auth, droits, boutique/produits, commandes acheteur/vendeur, parrainage, sessions,
   Zikr et contributions, commentaires, fichiers externes et journaux. Le téléchargement
   immédiat ne couvre qu’une partie de cet inventaire.
3. Pour une suppression, déterminer les obligations de conservation des transactions
   et contenus partagés ; anonymiser ou supprimer les enregistrements concernés,
   retirer les abonnements push, révoquer les sessions puis traiter le compte Auth.
   Utiliser un outil administratif contrôlé : aucun effacement global n’est lancé
   par cette interface. Appliquer également la politique de rétention des sauvegardes.
4. Enregistrer une réponse explicite et ne clôturer qu’après le traitement effectif.
   Conserver une preuve de traitement dans le dispositif administratif adapté.

## Déploiement et recette

Utiliser Node 24.12 minimum (voir `.nvmrc`) et lire [MIGRATION_FIREBASE.md](MIGRATION_FIREBASE.md).
Comparer les règles actives puis déployer les index versionnés :
`orders_v2` : `buyerSort`, `sellerSort`, `buyerUid`, `sellerUid`, `at` ;
`orders/{uid}` : `at` ; `privacy_requests` : `status`.
Ces nœuds, ainsi que `account_settings`, restent fermés au SDK client par la règle
racine. Les API utilisent l’Admin SDK. Ne pas remplacer les règles de production
sans comparaison avec la configuration réellement active.

Après livraison, tester un prix modifié, une boutique expirée, une coupure réseau,
les trois étapes vendeur, un accès à une demande tierce, les réglages push et un
traitement administratif réel. Les principales fenêtres utilisent un dialogue natif,
une boucle Tab, Échap et le retour au déclencheur ; vérifier aussi les lecteurs
d’écran et le WebView Android sur appareil.
