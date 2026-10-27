# Qualité des vues — premier lot

## Défauts constatés et corrections

| Défaut observé | Correction |
| --- | --- |
| Le rappel d’abonnement comprime son texte en colonne : le bouton de fermeture hérite de la largeur pleine page. | Largeurs explicites, rappel pleine largeur, texte lisible et fermeture de 44 × 44 px. |
| Menu personnel avec des liens sans repères, une petite bascule de thème et une version de repli sans rapport avec le build. | Identité, rubriques et icônes cohérentes, cibles tactiles de 44 px, pied de menu stable, version du build issue du SW si aucun contrôleur ne répond. |
| Compte, commandes et notifications avec des titres, retours et états d’attente différents. | En-tête et composant d’état partagés, retour visible sur téléphone, actions et espacements cohérents. |
| Échec initial des notifications masqué par un chargement sans fin. | Erreur visible, action Réessayer et récupération sans rechargement de l’application. |
| Marquage groupé affiché comme réussi même si l’API échoue. | Confirmation serveur avant rafraîchissement, conservation des non-lues après échec et message utile. |
| Historique difficile à parcourir. | Filtres Toutes / Non lues calculés localement, sans lectures Firebase supplémentaires au changement de filtre. |
| Messages de succès/erreur peu contrastés en thème clair. | Couleurs sémantiques distinctes selon le thème, focus clavier visible. |
| Discussion Zikr ignorant les marges injectées par Capacitor, réservant encore la hauteur de navigation quand le clavier la masque. | Variables de safe area partagées, compensation de navigation annulée au clavier et saisie qui grandit jusqu’à 120 px. |
| Retour vocal peu lisible et toast au niveau de la navigation. | Erreur audio persistante encadrée, récupération du vocal délimitée et toast au-dessus de la navigation. |
| Zoom utilisateur désactivé. | Retrait de maximumScale: 1 ; champs de saisie du chat en 16 px. |

La palette violette, la police Calibri/Carlito et les fonctions des modules sont
conservées. Les API, règles et autorisations ne sont pas modifiées par ce lot.
Le dialogue de confirmation reste ouvert pendant une requête en cours ; une
session expirée rend la reconnexion accessible hors de la fenêtre.

## Vérification

- Vues mobiles de 320 à 390 px, ordinateur 1440 px, thèmes clair et sombre.
- Rappel d’échéance, compte Basic, nom long en français et arabe, états vides,
  panne réseau simulée, reprise et échec du marquage des notifications.
- Navigation clavier, focus après fermeture et contrôle des débordements.
- Safe areas Android et ouverture du clavier simulées dans Chromium. Une
  vérification sur WebView Android réel reste nécessaire pour les particularités
  du clavier système et de la barre gestuelle.
- Scénarios dans `e2e/authenticated/ui-layout.spec.ts` ; suites publiques et
  authentifiées habituelles, lint, types, build et test du runtime Vercel.

Les captures de contrôle sont produites avec les comptes et données fictifs des
émulateurs. Elles ne contiennent pas de données de production.

## Suite de la revue visuelle

Les vues métier complexes demandent encore une revue dédiée avec des données
réalistes : fiches du marché et formulaires vendeur, lecteur de bibliothèque,
secrets longs et leurs interactions, tableaux et exports des outils de calcul.
Tester notamment de longs titres, les écritures arabes et les documents volumineux.
Ce lot traite le socle et les principaux parcours personnels ; il ne constitue
pas une certification d’accessibilité de toutes les pages.

## Aperçus du build compilé

Captures sur les émulateurs, avec des données fictives :

| Compte, thème sombre | Notifications, thème clair | Menu personnel |
| --- | --- | --- |
| ![Compte](docs/ui/compte-mobile.png) | ![Notifications](docs/ui/notifications-mobile.png) | ![Profil](docs/ui/profil-mobile.png) |
