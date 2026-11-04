# Abonnements sans publicités — WhatsApp et liens Wave

L’accès reste gratuit (`FREE_FOR_ALL = true`). Un abonnement valide retire
les publicités, avec les droits, échéances et commandes d’activation existants.

Formules : 3 mois / 15 000 FCFA, 6 mois / 25 000 FCFA, 1 an / 45 000 FCFA.
Le bénéficiaire Wave est celui des liens fournis par le propriétaire :
`https://pay.wave.com/m/M_sn_6W-tuxFYYkZa/c/sn/`.
Les montants sont construits uniquement depuis les formules connues, sans
ponctuation finale. Il s’agit de liens marchands publics, pas de clés API.

Le portail et Mon compte utilisent le même composant. Sur Android, le lien
HTTPS est confié au système, qui ouvre Wave si l’application et l’association
le permettent ; sinon la page Wave est ouverte dans le navigateur. Sur le site,
un nouvel onglet est réservé pendant le clic pour éviter le blocage des popups.
Un retour ou une ouverture du lien n’accorde aucun abonnement.

Après paiement, le bouton de confirmation WhatsApp prépare un message avec
le compte ASRAR, la formule, le montant et la mention « Paiement à vérifier ».
L’utilisateur peut joindre son justificatif dans WhatsApp. L’administrateur
vérifie le paiement réellement reçu et utilise le mécanisme d’activation
existant. Aucune clé Wave, API de paiement ou notification Wave n’est utilisée.
Aucun abonnement n’est activé automatiquement ni renouvelé automatiquement.
Le numéro WhatsApp reste configuré côté serveur par `WHATSAPP_NUMBER`.

Google Play Billing : SDK, plugin, permission Android et interfaces d’achat
retirés ; anciennes actions publiques arrêtées avec HTTP 410. La vérification
CI du bundle interdit désormais la permission `com.android.vending.BILLING`.
Les données historiques et le serveur de rapprochement des anciens reçus
restent conservés, sans nouvel achat accessible dans l’application.
Une nouvelle version native est nécessaire pour retirer le SDK des appareils.

Cette préparation ne crée aucun produit, ne supprime aucune commande de la
Play Console et n’envoie aucun paiement. Ne pas réutiliser les secrets Orange
ou les anciennes coordonnées de carte communiquées dans la discussion.

Avant une publication Play Store : la suppression du SDK Billing ne dispense
pas des règles Google sur les abonnements numériques, y compris sans publicités.
Les liens de paiement externes dans l’application doivent être autorisés pour
le pays et le programme concernés. Le parcours web peut être déployé séparément.
Aucune publication Play Store n’est déclenchée par ces modifications locales.

Validation locale : 869 tests unitaires réussis, lint et types validés.
La suite authentifiée complète a validé 81 scénarios ; deux assertions sur le
statut sans publicités ont révélé un compte partagé déjà abonné par un test
précédent. Les données de ces scénarios sont désormais sauvegardées, isolées
et restaurées. Les cinq parcours ciblés Wave / WhatsApp / retrait Billing
repassent ensuite tous, avec compilation Next à jour et capture mobile.
Tests natifs et APK de débogage réussis ; `aapt dump permissions` confirme
l’absence de `com.android.vending.BILLING`. Aucun paiement réel exécuté.
