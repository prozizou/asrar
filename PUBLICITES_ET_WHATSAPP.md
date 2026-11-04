# Publicités obligatoires et messages WhatsApp — préparation locale

Toutes les modifications restent locales jusqu’à ordre explicite de publication.
Elles complètent la version 8.0.2 préparée avec les abonnements WhatsApp / Wave.
Aucun push, déploiement, message externe ou paiement réel n’est effectué ici.

## Actions contrôlées

Les ouvertures et calculs qui passent par `ensureAccess` exigent une publicité
pour un compte sans abonnement valide. Une erreur publicitaire, une annonce
absente, une réponse d’abonnement incomplète ou un simple délai n’accordent
plus l’action. Un abonnement expiré invalide immédiatement son exemption en
cache. Un abonné confirmé conserve l’accès sans publicité.

Dans Android, Unity doit confirmer `shown: true` ET `completed: true`.
Une annonce interrompue, un chargement échoué, un plugin absent ou un délai
entre deux affichages laisse l’action refusée. La fenêtre propose de patienter,
de réessayer l’action ou de choisir un abonnement. Les limites de fréquence
existantes sont conservées : elles ne constituent plus un passage gratuit.
Une nouvelle version native est nécessaire : les anciens APK qui n’envoient
pas `completed` ne peuvent pas confirmer une lecture complète.

Sur le site, l’ouverture du Smartlink est seulement une tentative. Même si
le popup est bloqué, un bloc publicitaire dans la page peut satisfaire l’action.
Le bouton Continuer exige une iframe chargée de dimensions suffisantes,
au moins à moitié visible, et cinq secondes cumulées au premier plan. Le temps
en arrière-plan ne compte pas. Une publicité absente ou retirée ne laisse pas
continuer. Annuler, fermer la fenêtre ou choisir un abonnement ne valide pas
l’action en attente. Deux actions simultanées ne partagent pas une autorisation.

Limite technique : le navigateur ne permet pas d’inspecter le contenu d’une
iframe d’un autre domaine. Chargement et visibilité sont des signaux techniques,
pas une certification de l’impression, du contenu créatif ou des revenus par
la régie. Une garantie serveur nécessiterait un SDK ou un rappel publicitaire
vérifiable. Ce contrôle d’interface ne remplace pas une autorisation serveur ;
l’application reste gratuite et les calculs locaux restent exécutables côté client.

## Messages WhatsApp

Les demandes du Marché utilisent les données de la commande côté serveur.
Le message comporte un titre, des rubriques en gras WhatsApp, des lignes aérées,
un prix formaté (30 000 FCFA) et la référence courte de 12 caractères déjà
utilisée dans l’interface des commandes. La clé complète de la commande et le
jeton de contact restent inchangés ; le message ne constitue aucun paiement.

Exemple :

```text
Assalamou aleykoum 🌙

*DEMANDE DE DISPONIBILITÉ*

📦 *Article :* Livre protection
🏪 *Boutique :* Asrar Pro boutique
💰 *Prix affiché :* 30 000 FCFA

Cet article est-il disponible ?
Merci de m’indiquer les modalités de paiement et de livraison.

🔖 *Référence :* 3eb1d4306191

_Cette demande ne confirme aucun achat._
```

Les messages d’abonnement regroupent aussi formule, montant, compte ASRAR et,
le cas échéant, paiement Wave à vérifier. Les libellés de données sont nettoyés
pour éviter l’injection de fausses rubriques ou de balisage WhatsApp.

Validation finale locale : 879 tests unitaires, 22 parcours authentifiés ciblés,
compilation Next, lint et contrôle des types réussis. Les tests natifs et la
compilation APK passent également. Les scénarios couvrent notamment l’absence
de pub, le script sans annonce, l’arrière-plan, les doubles clics, une nouvelle
pub pour le calcul suivant, les vidéos interrompues, les délais natifs, les
abonnés et les demandes WhatsApp avec prix serveur. Toutes les annonces des
tests navigateur sont fictives ; aucune régie réelle n’est contactée.
