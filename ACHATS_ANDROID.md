# Achats de secrets dans Android — Google Play Billing

Le travail Android est isolé sur `feat/android-secret-purchases`.
Les préparations Wave et Orange Money sont conservées **uniquement en local**,
sur `local/payments-wave-orange` (instantané `fe0f125`). Elles ne sont pas incluses
dans cette branche Android et aucun déploiement de paiement n’a été effectué.

## Situation marchande à résoudre avant l’encaissement

Le propriétaire a indiqué être au Sénégal et ne pas avoir de profil de paiements
marchand Google Play. La liste officielle consultée le 30 octobre 2026 accepte
l’inscription comme développeur au Sénégal mais n’y accepte pas l’inscription
comme marchand. Publier une application gratuite n’établit pas l’éligibilité aux
ventes de contenus numériques. Une carte bancaire permettant de payer des frais
ne constitue pas un moyen de versement marchand validé.

Le profil doit correspondre à l’identité, à l’adresse et à l’activité réelles du
vendeur. L’encaissement nécessite un profil marchand et un moyen de versement
compatibles, validés par Google. Ne pas activer de ventes ni publier une mise à
jour en annonçant des achats opérationnels avant d’avoir résolu ce point.

Sources Google :
- https://support.google.com/googleplay/android-developer/answer/9306917?hl=fr
- https://support.google.com/googleplay/android-developer/answer/3092739?hl=fr
- https://support.google.com/googleplay/android-developer/answer/13628312?hl=fr

Le titulaire peut vérifier le profil dans les paramètres de la Play Console,
section Monétisation / Profil de paiement. Selon la version de l’interface, la
création du compte marchand est aussi accessible depuis Rapports / Finance.
Le support Play Console peut confirmer les options applicables au compte réel.

## Fonctionnement préparé

Chaque secret possède un produit ponctuel **non consommable**, avec son propre
prix dans Play Console. BillingClient affiche le prix localisé et la fenêtre
Google officielle ; le navigateur Android n’encaisse pas via Google Pay.
Le plugin Java `SecretBilling` utilise Billing Library 8.3.0, avec restauration,
paiements en attente, liaison de compte obfusquée et délais de connexion.
Aucun produit n’est consommé : un secret acquis reste attaché au compte ASRAR.

L’API authentifiée vérifie package `com.Asrar`, produit, jeton, identité et état
d’achat auprès d’Android Publisher. Elle acquitte le paiement puis crée le droit,
sans accepter un prix ou un statut fourni par le client. Un reçu réutilisé par
un autre compte ou révoqué ne donne aucun accès. Une erreur de vérification ne
révèle ni jeton, ni URL de reçu, ni compte de service. Les règles RTDB globales
continuent de refuser les lectures et écritures clientes sur les achats.

Les notifications RTDN sont authentifiées par OIDC (audience et email de service
vérifié) avant interrogation de Google. Le lien privé `play_secret_accounts`
est enregistré avant la fenêtre d’achat et permet d’associer une confirmation
différée même si l’application a été fermée avant le premier reçu confirmé.
Un simple paiement en attente ne crée aucun droit. La restauration manuelle
reste disponible si le réseau ou une notification a manqué.

Le statut des droits est revérifié après une heure de cache, ou immédiatement
sur notification de remboursement. Une date de vérification absente déclenche
également une vérification. Les remboursements ne peuvent pas être annulés par
une ancienne confirmation retardée. Une copie de contenu déjà obtenue ne peut
pas être rappelée.

## Configuration, une fois l’éligibilité marchande confirmée

1. Créer un produit ponctuel par secret, option d’achat non consommable, dans
   Play Console. Fixer son tarif et ses pays. Associer l’identifiant au secret
   depuis son panneau administrateur ASRAR. L’association reste immuable.
2. Configurer exclusivement côté serveur Vercel `PLAY_BILLING_SERVICE_ACCOUNT`
   avec un compte de service autorisé sur `com.Asrar` et le scope Android
   Publisher. Le secret utilisé pour envoyer l’AAB dans GitHub ne configure
   pas automatiquement le serveur Vercel.
3. Configurer RTDN via Pub/Sub : souscription push authentifiée vers
   `https://www.asrarpro.com/api/play-notifications`, identité de service dédiée,
   variables `PLAY_RTDN_AUDIENCE` et `PLAY_RTDN_SERVICE_ACCOUNT_EMAIL`. Donner à
   Google Play le droit de publier dans le topic.
4. Préparer une nouvelle version Android contenant le plugin Billing : la
   version 7.9.5 actuellement publiée ne le contient pas. Passer d’abord par
   la piste interne, avec un compte déclaré testeur de licence. Ne pas utiliser
   un APK de débogage pour valider l’encaissement marchand réel.
5. Définir temporairement `PLAY_BILLING_TEST_UIDS` côté serveur avec les UID
   Firebase des comptes de recette, séparés par virgules. Seuls ces comptes
   voient les achats individuels avant la bascule générale. Utiliser un compte
   de test sans privilège administrateur/VIP.
6. Vérifier achat, annulation, attente, reprise réseau, fermeture/réouverture,
   confirmation différée, restauration, autre compte et remboursement.
7. Activer ensuite les achats individuels depuis le panneau administrateur.
   L’activation exige uniquement la configuration Play et les produits des
   secrets ; elle ne dépend plus de Wave ni d’Orange Money.

La bascule fige atomiquement l’échéance actuelle des abonnés. Ils gardent l’accès
jusqu’à cette date ; une reconduction ultérieure ne prolonge pas leur ancien
accès global aux secrets. Les accès existants sans échéance et les privilèges
admin/VIP restent préservés. Les abonnements aux autres rubriques sont inchangés.

La version Android 7.9.6 (code CI attendu 118) est préparée pour un envoi
uniquement sur la piste interne, sans fusion dans main ni déploiement web de
production. Aucun profil marchand, produit, paiement ou règle de production
n’est créé par cette construction. La recette avec les prestataires reste à faire.

## Validation de cette branche

827 tests unitaires et quatre parcours authentifiés d’achat passent. La
compilation Next, le lint et le contrôle des types passent. Les tests natifs
existants et la compilation APK de débogage passent. Les paiements Google et
les notifications de paiement sont simulés dans les tests ; aucun achat réel
ni versement marchand n’a été exécuté. Le test de licence sur une installation
Play interne reste indispensable lorsque le compte marchand sera éligible.
