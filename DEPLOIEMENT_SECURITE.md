# Correctifs de sécurité et fiabilité

La branche `fix/security-and-reliability` corrige les accès aux contenus,
le traitement des opérations concurrentes, les notifications et les délais
réseau. Next.js passe de 14.2.35 à 15.5.28 et DOMPurify à 3.4.17. Les
versions indirectes corrigées sont verrouillées dans `package-lock.json`.

## Contrôles avant livraison

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Le workflow `ci.yml` exécute ces contrôles sur les PR. Configurer son job
`checks` comme vérification obligatoire dans les règles de branche GitHub.
Les tests de `tests/` exécutent les vrais handlers et services avec une base
simulant transactions, conflits et pannes. Ils complètent les tests Chromium
anonymes ; ils ne remplacent pas une recette avec Firebase Emulator ou sur
un projet de préproduction séparé.

Tester en préproduction : connexion Google popup/redirect et native, compte
gratuit/abonné/premium, activation/révocation, deux appareils sur le même
Zikr, conversion de points et reprise après coupure, images et vocaux,
lecture d'un livre et ouverture Meet. Les SDK Firebase 13 / Admin 14 nécessitent Node 24.12 minimum ; voir
[MIGRATION_FIREBASE.md](MIGRATION_FIREBASE.md). Les fournisseurs Auth doivent émettre
`email_verified: true` (cas normal de Google).

Voir [AUDIO_ZIKR.md](AUDIO_ZIKR.md) pour remettre en service les vocaux du Zikr.

## Cloudinary : configuration nécessaire

Les uploads exigent désormais un preset **signé** avec limites définies dans
Cloudinary. Ne pas déployer sans les avoir configurés, sinon l'API refuse
l'upload avec un statut 503.

- `CLOUDINARY_IMAGE_UPLOAD_PRESET` : formats d'image permis, taille maximale
  et dimensions adaptées aux fiches. L'ancien `CLOUDINARY_UPLOAD_PRESET`
  reste utilisable comme valeur de repli pour les images.
- `CLOUDINARY_AUDIO_UPLOAD_PRESET` : formats audio permis via le type
  Cloudinary `video`, limites de taille et durée conformes au produit.

Ces variables référencent des presets ; le serveur ne peut pas vérifier
leur configuration à partir du nom. Contrôler réellement les limites dans
Cloudinary et essayer un fichier trop volumineux et un format interdit.

## Données et reprise

Les données existantes sont conservées ; les nouveaux marqueurs sont
ajoutés lors des opérations, sans migration destructive.

Avant bascule, inspecter les anciens `referred` non crédités : le serveur
historique pouvait avoir versé des points sans marquer l'opération terminée.
Ces cas ambigus nécessitent un rapprochement avec les données existantes ;
aucun crédit historique n'est corrigé automatiquement sans cette preuve.

- Une conversion réserve les points dans
  `referrals/{uid}/pendingRedemption`, accorde un droit de base dans
  `purchased_user/{emailKey}/referralAccess`, puis écrit l'historique et
  clôt l'opération. L'identifiant client est conservé jusqu'au succès pour
  supporter une réponse perdue. Après une erreur 503, réessayer avec le même
  identifiant ; ne pas rembourser manuellement sans examiner l'octroi.
- Les échéances des achats et récompenses sont distinctes. Une récompense
  de base ne prolonge pas le niveau premium. Adapter tout outil externe
  d'administration qui ne connaît que le champ d'achat historique. La
  révocation dans cette application expire les deux sources.
- Une progression Zikr garde une génération et un point de départ sur le
  membre. Le groupe mémorise les valeurs déjà comptées ; un réessai rattrape
  une interruption sans ajouter deux fois les mêmes récitations.
- Les badges sont calculés à partir des 200 notifications retenues.
  `notifications_meta/{uid}/unread` n'est plus une source de vérité ; les
  anciens compteurs ne sont pas effacés afin de permettre une inspection.

Sauvegarder Firebase avant livraison. Les marqueurs de progression et de
conversion doivent rester disponibles lors d'un réessai ; ne pas les purger
indépendamment des comptes/opérations concernés. Un retour à l'ancien
serveur perdrait la lecture des nouveaux droits `referralAccess` : prévoir
une restauration cohérente du code ET des données ou garder les lecteurs
compatibles pendant le retour arrière.

## Ordonnancement des rappels

`reminders-cron.yml` appelle les rappels de session toutes les 10 minutes,
sous réserve des délais et de la disponibilité de GitHub Actions. Ajouter
le secret de dépôt `CRON_SECRET` identique à celui de Vercel. La variable de
dépôt `ASRAR_SITE_URL` permet de sélectionner le déploiement ; sa valeur par
défaut est le domaine public actuel. Le cron Vercel quotidien reste un repli.

**Les alarmes planétaires demandent un planificateur à la minute.** Elles
ne sont pas garanties par GitHub Actions ni par les crons quotidiens du plan
Hobby. Configurer un ordonnanceur externe ou une offre Vercel adaptée pour
appeler `/api/cron/planet-push` chaque minute, avec le secret dans l'en-tête
Authorization. La branche ne modifie pas le plan payant ni sa facturation.

## Points restant à traiter séparément

- Le deuxième lot ajoute les tests Auth/RTDB locaux et la file de
  notifications. Déployer ses index et configurer son ordonnanceur selon
  [NOTIFICATIONS.md](NOTIFICATIONS.md) ; vérifier Web Push et Android sur
  des appareils de recette.
- Vérification du manifeste Android fusionné et recette microphone sur
  appareil ; les permissions ont été ajoutées au manifeste source.
- Projet Firebase de préproduction, recette OAuth Google et parcours
  authentifiés supplémentaires au-delà de la suite d'émulation.
- Quotas partagés entre toutes les instances serveur.
- Droits des fichiers Drive/Meet et modèle commercial de temps réel.
- Compte et demandes de données : déployer les index et organiser le traitement
  manuel décrit dans [COMMANDES_ET_COMPTE.md](COMMANDES_ET_COMPTE.md). La modération
  et la recette lecteur d’écran restent à approfondir.
- Migration Firebase réalisée ; audit de production sans alerte. Les sept avis
  modérés de développement sont documentés dans [MIGRATION_FIREBASE.md](MIGRATION_FIREBASE.md).

## Chargement des dépendances Firebase sur Vercel

Conserver l’option `NODE_OPTIONS` versionnée dans `vercel.json` : elle active
`require(ESM)` sur le runtime Node 24. Sans elle, `jwks-rsa` ne charge pas
`jose` et les routes Firebase échouent avant l’authentification. Voir
[MIGRATION_FIREBASE.md](MIGRATION_FIREBASE.md) pour la reproduction et les
contrôles `test:runtime`, `/api/health` et POST anonyme → 401 en JSON.
