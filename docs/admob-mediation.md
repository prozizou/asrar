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

Configurez également le bloc interstitiel récompensé `ca-app-pub-3895250961868134/3047224257` avec la même URL SSV, puis activez `ADMOB_REWARDED_INTERSTITIAL_SSV=1` dans Vercel. Les blocs d’affichage sont réservés aux comptes Android sans abonnement. La bannière AdMob apparaît à l’accueil, le format natif dans le menu et la bannière Adsterra dans Ressources.

Le fichier `public/.well-known/assetlinks.json` contient l’empreinte du certificat de signature Play. Après déploiement, vérifiez les liens `https://www.asrarpro.com` sur Android 8.3.0. Le blocage du site hors iOS est actif par défaut (`NEXT_PUBLIC_IOS_WEB_ONLY=0` au build pour le couper) : Android est redirigé vers Google Play, l’ordinateur voit un écran d’installation. Le domaine sans `www` redirige actuellement vers `www`. Son association Android directe exige de servir aussi `/.well-known/assetlinks.json` sans redirection sur ce domaine.
