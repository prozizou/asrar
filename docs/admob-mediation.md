# Android 8.2.0 / SW v46.99 — AdMob comme médiation

Application Google : ca-app-pub-3895250961868134~5473242896.
Bloc récompensé : ca-app-pub-3895250961868134/9551701662.
Google Mobile Ads 25.5.0 ; SDK Unity Ads 4.21.0, adaptateurs AdMob Unity 4.21.0.0, BIGO 6.2.0.1, Chartboost 9.14.1.0 ; UMP 4.0.0. Les anciennes dépendances du moteur LevelPlay sont retirées de l’application principale. Le module séparé mediation-test reste un outil historique LevelPlay et n’est pas utilisé par cette application.

## Configuration à effectuer dans AdMob

Dans l’application ASRAR PRO, ouvrir le bloc récompensé puis la vérification côté serveur (SSV) et renseigner :

https://www.asrarpro.com/api/admob-ssv

Cocher aussi « Appliquer à tous les réseaux des groupes de médiation » pour que les réseaux tiers bénéficient du même rappel Google.

Le SDK transmet custom_data (UID.session générée côté serveur) pour chaque visionnage. Ne pas définir une valeur fixe à la place de cette donnée dynamique. Google signe le rappel ; le serveur vérifie le message ECDSA SHA-256 en conservant l’ordre des paramètres et le décodage des caractères échappés du vérificateur Tink officiel avec les clés publiques Google, le bloc, la date, la session et le dédoublonnage. Ne jamais fabriquer de clé secrète SSV.

Créer/configurer les groupes de médiation et associer les instances des régies dans la console AdMob ; leurs identifiants LevelPlay ne sont pas réutilisables. La présence d’un adaptateur dans l’APK ne configure pas les comptes ou les enchères côté console. Les paramètres de confidentialité et messages UMP doivent être disponibles dans AdMob. Le fichier public app-ads.txt conserve l’entrée Google du compte éditeur.

## Parcours et limites

Sur Android, un compte sans abonnement choisit « Regarder une publicité » pour gagner 1 point après confirmation serveur. Chaque action éligible coûte 10 points. Le SDK confirme affichage, récompense et fermeture ; le client attend ensuite le crédit confirmé par Google (30 s, puis possibilité de retrouver le crédit plus tard). Le rappel peut arriver après fermeture ; une fermeture seule ne crédite jamais. Une récompense est associée à une session dédiée, sans préchargement de la publicité suivante avec la même session. Les points AdMob inutilisés restent disponibles. Pour un secret ou un document, les dix points et le passe à usage unique lié au contenu sont enregistrés dans la même transaction.

Les paiements Wave, PI-SPI et WhatsApp restent disponibles. Les abonnés passent sans pub. Les modules du palier supérieur restent payants. ADS_PAUSED reste true pour les formats web et anciens SDK ; seule la capacité adMobRewards du nouveau pont autorise l’offre Google. Le serveur accepte uniquement les crédits/passes provider=admob pendant cette pause, jamais des récompenses auto-déclarées par le client. Les anciens APK gardent l’abonnement manuel.

Une nouvelle installation/mise à jour Android est nécessaire pour changer le moteur de médiation. Le déploiement web seul ne remplace pas le SDK dans un APK existant. Les builds debug utilisent les identifiants Google officiels de démonstration ; ils ne peuvent pas créer de crédits de production. Les essais automatisés utilisent des clés locales et émulateurs, sans affichage publicitaire réel. L’affichage et les revenus réels restent à vérifier sur appareil avec la console AdMob configurée.

## Blocs « high » (Android 8.3.6)

L’application essaie d’abord le bloc « high » de chaque format, puis le bloc par défaut s’il ne remplit pas (`android/app/src/main/java/com/asrarpro/app/AdUnitChain.java`). Les blocs « high » récompensés doivent avoir la même URL SSV que les blocs par défaut : `High ecpm` (`2847200667`) et `high int_recomp` (`6939945186`). Le serveur accepte les deux (`server/admobVerification.js`).

Configurez également le bloc interstitiel récompensé `ca-app-pub-3895250961868134/3047224257` avec la même URL SSV, puis activez `ADMOB_REWARDED_INTERSTITIAL_SSV=1` dans Vercel. Les blocs d’affichage sont réservés aux comptes Android sans abonnement. La bannière AdMob apparaît à l’accueil, le format natif dans le menu et la bannière Adsterra dans Ressources.

Le fichier `public/.well-known/assetlinks.json` contient l’empreinte du certificat de signature Play. Après déploiement, vérifiez les liens `https://www.asrarpro.com` sur Android 8.3.0. Le blocage du site hors iOS est actif par défaut (`NEXT_PUBLIC_IOS_WEB_ONLY=0` au build pour le couper) : Android est redirigé vers Google Play, l’ordinateur voit un écran d’installation. Le domaine sans `www` redirige actuellement vers `www`. Son association Android directe exige de servir aussi `/.well-known/assetlinks.json` sans redirection sur ce domaine.

## Nouvelle tentative automatique

Quand le chargement d’une publicité récompensée échoue (aucune annonce, erreur réseau ou SDK), l’application redemande une annonce au lieu d’abandonner : jusqu’à 3 nouvelles tentatives, espacées de 1,5 s, 3 s puis 5 s, pendant que la fenêtre « Chargement de la publicité… » reste affichée. Chaque tentative relance la mise en concurrence AdMob / Unity Ads (et des autres régies ajoutées). Le consentement refusé, l’application en arrière-plan, l’annulation par l’utilisateur et un chargement dépassant 60 s ne sont pas réessayés. Après la dernière tentative, le message « Aucune publicité disponible » s’affiche et aucun point n’est accordé. Nécessite une nouvelle version de l’APK (code natif).

## Préchargement de la publicité récompensée

Android 8.3.2 garde une annonce récompensée chargée en attente (`RewardedPreloader`, `PreloadedSlot`) pour supprimer l'attente du chargement (latence moyenne mesurée ≈ 3,8 s, 50 % des annonces trouvées jamais affichées). Le site l'active par `preloadRewarded({ enabled })` pour un compte sans abonnement dont le serveur propose les récompenses, et la coupe sinon. `AdMobAdPlatform.load()` prend l'annonce en attente à la place d'une nouvelle demande et pose l'identifiant SSV de la demande courante juste avant l'affichage ; à la fermeture, la suivante se recharge. Garde-fous : un seul chargement à la fois, annonce jetée après 50 min, demandes espacées de 1 à 15 min après un échec, aucune demande si le consentement n'est pas obtenu (sans fenêtre). Dans AdMob, le taux de diffusion baisse mécaniquement : suivre impressions et revenus.

## Liftoff Monetize (ex-Vungle) — Android 8.3.5

- Adaptateur `com.google.ads.mediation:vungle` ajouté dans `android/app/build.gradle` (actif à partir de l'APK 8.3.5).
- `public/app-ads.txt` : ligne DIRECT `vungle.com, 6b0940e8824b51cafc14acbd` et revendeurs fournis par Liftoff (doublons déjà présents ignorés).
- Liftoff (publisher.vungle.com) : ajouter l'application Android `com.Asrar`, puis créer les emplacements (Rewarded, Interstitial, Banner, App Open) et noter l'App ID et les Reference ID.
- AdMob → Médiation → Sources d'annonces : activer Liftoff Monetize en enchères, saisir l'App ID et les Reference ID, puis l'ajouter aux groupes de médiation existants (récompensée, interstitiel, bannière, ouverture d'application).
