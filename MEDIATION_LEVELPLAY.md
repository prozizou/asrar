# Médiation Android LevelPlay — préparation locale

Le plugin Capacitor conserve son nom UnityAds pour rester compatible avec le site.
Lorsque LEVELPLAY_ENABLED=true, showInterstitial affiche une **publicité récompensée
LevelPlay**, après acceptation explicite de l’utilisateur. Le nom de méthode historique
ne désigne plus le format utilisé. Un interstitiel fermé ne prouve pas un visionnage
complet : l’action attend affichage + récompense + fermeture.

## Configuration

Les identifiants publics sont dans android/levelplay.properties (ou variables ASRAR_
portant les mêmes noms). App Key 237ff501d, unité récompensée evijfgcicz1kfdt9.
L’interstitiel tvah9k0xm07abinp reste dans la console pour un futur usage approprié.
L’App ID AdMob est ca-app-pub-3895250961868134~5473242896.
LEVELPLAY_ENABLED=true dans la configuration. L’ajout Chartboost ci-dessous est
préparé pour Android 8.0.4 ; cette nouvelle version n’est pas encore publiée.
Le build refuse une activation avec des identifiants absents ou invalides.
Aucun secret réseau, OAuth ou clé de rappel serveur n’est inclus dans l’APK.

SDK 9.5.0 ; adaptateurs Unity Ads 5.15.0, Google AdMob 5.19.0, BIGO 5.15.0,
Chartboost 5.12.0 (SDK Chartboost 9.14.1).
Les SDK des réseaux sont fournis transitivement par les adaptateurs.
Le compte ironSource doit être approuvé ; les instances doivent être configurées et
actives pour l’unité Rewards dans LevelPlay. Le fichier app-ads.txt Google est déjà
publié, mais la validation AdMob reste gérée par Google. Les éventuelles autres lignes
app-ads.txt doivent provenir des régies concernées, jamais être inventées.

## Préparation Chartboost — Android 8.0.4

L’adaptateur est inclus dans l’application complète et le diagnostic séparé.
Le dépôt Maven officiel Chartboost est limité aux groupes du SDK et de son OM SDK.
AGP 8.13.2 fournit R8 8.13.19, requis pour la dépendance Kotlin 2.3.0 du SDK.
Le signal `CHARTBOOST_COPPA=NO` est transmis avant l’initialisation de LevelPlay,
conformément à la politique du service non destiné aux moins de 13 ans.
Les App ID, App Signature et ad locations Chartboost restent configurés dans
LevelPlay ; aucun secret Chartboost n’est ajouté au dépôt ou à l’APK.

La console Chartboost indique « Pending: Waiting for SDK integration and ad
request submission ». Installer la nouvelle version native puis vérifier une
requête via LevelPlay sur téléphone avec le compte et l’application configurés.
La compilation seule ne confirme ni la réception de la requête, ni la validation
du compte, ni la disponibilité d’une annonce.

Le fichier public `app-ads.txt` conserve les déclarations existantes. Les lignes
Chartboost restent à récupérer dans Monetization > Tools > App-ads.txt, une fois
l’application éligible, ou auprès du support Chartboost. Le Publisher ID doit
provenir du compte : l’App ID ne peut pas le remplacer. Publier les lignes complètes
avec les éventuels revendeurs, puis relancer le scan. Un ajout au fichier texte
n’installe pas l’adaptateur dans les versions Android déjà diffusées.

Sources :
- https://docs.unity.com/en-us/grow/levelplay/sdk/android/networks/guides/chartboost
- https://developer.android.com/build/releases/agp-8-13-0-release-notes
- https://docs.chartboost.com/en/monetization/publishing/app-ads-txt/

## Consentement et cycle de vie

UMP 4.0.0 actualise le consentement avant toute demande LevelPlay. Configurer les
messages appropriés dans AdMob > Confidentialité et messages. Un échec sans choix
valide empêche l’annonce. Les signaux TCF/consentement sont gérés par les SDK ; le code
ne force pas un consentement positif. Le bouton de gestion des choix est disponible
dans Mon compte lorsque UMP indique qu’il est requis.

Un appel à la fois ; consentement/chargement bornés ; aucun affichage si l’activité
n’est pas au premier plan ; fermeture/destruction annule la demande. Les callbacks
anciens sont ignorés. Une récompense peut arriver après fermeture (attente 5 secondes).
Aucun accès en cas d’erreur, absence d’annonce, abandon ou timeout.
Le préchargement prépare les annonces en amont ; aucune attente liée à un intervalle
JS n’est imposée lorsqu’une annonce est prête.

## Crédits historiques

Les récompenses de cette médiation débloquent l’action gratuite côté interface,
comme le mécanisme précédent ; elles ne créent ni abonnement ni crédit serveur.
Le protocole signé Unity S2S historique n’est pas interchangeable avec celui de
LevelPlay. Son option reste disponible en mode Unity direct, mais est masquée en mode
LevelPlay pour éviter une double initialisation du SDK et de faux crédits. Les crédits
existants et les endpoints de réception historiques sont conservés. Le mode actuel
FREE_FOR_ALL n’utilise pas cette ancienne offre de crédits pour ses actions gratuites.
Une éventuelle remise en service de modules payants exige d’abord une intégration
séparée des callbacks signés LevelPlay.

## Validation avant diffusion

Une compilation ne démontre pas la diffusion réelle. Installer un APK de test,
activer les appareils de test dans LevelPlay/les régies, vérifier chaque réseau via
l’Integration Helper/Test Suite et exercer : abandon, absence réseau, rotation,
retour arrière, double clic, consentement refusé et récompense terminée.
Aucune requête publicitaire réelle n’est effectuée par les tests automatisés.
La publication de la version Android 8.0.2 en production a été demandée explicitement
par le propriétaire après les tests sur téléphone.

Sources officielles :
- https://docs.unity.com/en-us/grow/levelplay/sdk/android/sdk-integration
- https://docs.unity.com/en-us/grow/levelplay/sdk/android/rewarded-ads-integration
- https://docs.unity.com/en-us/grow/levelplay/sdk/android/mediation-networks

## Vérifications locales effectuées

Compilation Java, APK debug et tests Android : 20 tests réussis, dont 7 nouveaux
cas de médiation. Compilation release optimisée R8 réussie (environ 8 minutes). Tests JS ciblés : 10 réussis ; typecheck et lint réussis.
La compilation de validation du chemin activé utilise ponctuellement l’App ID
Google de démonstration via une variable de commande, sans modifier la configuration
persistée et sans installer ni diffuser l’APK. Cet artefact n’est pas une version
prête pour les utilisateurs. Recompiler avec les identifiants réels avant test appareil.

Configuration réelle ensuite compilée en APK debug avec succès et tests Android réussis.
App ID AdMob dans le manifeste APK et LEVELPLAY_ENABLED=true vérifiés.
Le test de diffusion sur téléphone reste à effectuer ; aucun APK publié.

## Diagnostic autonome sur téléphone

`./gradlew :mediation-test:assembleDebug` construit un APK signé avec la clé de test
Android, paquet `com.Asrar.mediationtest`, intitulé « ASRAR — Test pubs ».
Il s’installe à côté de l’application Play Store, sans la désinstaller ni utiliser
sa signature de production. Aucun compte ASRAR, connexion Firebase, achat, abonnement
ou message n’est traité par ce diagnostic.

Il actualise UMP puis initialise uniquement LevelPlay en mode `is_test_suite`, et
ouvre l’outil officiel avec le contexte application. Il n’appelle pas les méthodes
de chargement/affichage habituelles. Le mode test-suite est retiré du parcours
normal de l’application : il est réservé à ce diagnostic.

Les versions SDK/adaptateurs et les identifiants publics sont ceux de la préparation
Android. Le paquet du diagnostic diffère du paquet Play Store : il sert d’abord à
vérifier les SDK et la configuration des régies. Il ne démontre pas le fonctionnement
de l’authentification, du déblocage métier, de l’exemption des abonnés ni la diffusion
dans le paquet de production ; ceux-ci exigent ensuite le test de l’application
complète, idéalement signée via la piste interne de Google Play.

Installer l’APK, ouvrir « ASRAR — Test pubs », puis « Ouvrir le diagnostic LevelPlay ».
Si Android demande l’autorisation d’installation pour le navigateur/téléchargement,
la donner pour ce fichier. L’outil présente les réseaux et les formats ; transmettre
les captures de leur état (ou du message d’erreur) pour poursuivre les corrections.
Le diagnostic autonome reste un outil local ; seul le bundle du module app est
destiné à la publication Play Store.

Source : https://docs.unity.com/en-us/grow/levelplay/sdk/android/integration-test-suite

Validation diagnostic : assembleDebug et lintDebug réussis ; signature APK vérifiée
(apksigner v2) ; paquet indépendant com.Asrar.mediationtest confirmé. Les 20 tests
Android de l’application passent après retrait du mode test-suite de son parcours
normal. Aucun téléphone connecté : l’exécution réelle du diagnostic reste à vérifier.
APK disponible dans /workspace/shared/asrar-test-pubs.apk.

## Résultats sur téléphone — 4 novembre 2026

Le propriétaire a installé le diagnostic et confirmé le chargement, l’affichage et
la fermeture des annonces récompensées ironSource et Unity Ads. Les captures de
la Test Suite indiquent le succès de l’affichage pour Unity Ads.
Google a renvoyé « Mediation No fill ». Son compte est en cours de validation.
La fiche Play Store référençait un ancien domaine Blogger portant un autre
identifiant éditeur. Le site développeur a été corrigé vers https://www.asrarpro.com
et vérifié sur la fiche publique ; app-ads.txt fournit le bon identifiant. Le délai
d’actualisation AdMob et son approbation restent à terminer. BIGO n’a pas encore été
confirmé dans la Test Suite. Ces points n’empêchent pas les réseaux disponibles de
participer à la médiation ; aucun eCPM ou revenu réel n’est garanti par ces tests.
