# ASRAR PRO — coquille Android (Capacitor)

Ce dossier a été généré par `npx cap add android` (voir `../capacitor.config.ts`).
**Ce n'est pas un build statique embarqué** : l'app charge le site déjà
déployé (`server.url` = `https://www.asrarpro.com`) dans une WebView native —
chaque mise à jour du site se reflète sans nouvelle publication sur le Play
Store. Seules les notifications push (FCM) passent par du code natif, via
`@capacitor/push-notifications` et `../lib/fcmNative.js`.

## Ce qui manque encore pour un vrai build

Rien de ce qui suit n'a pu être fait dans l'environnement où ce dossier a été
généré (pas de SDK Android, pas d'accès à la console Firebase) :

1. **SDK Android** — installer Android Studio (ou les command-line tools) et
   définir `ANDROID_HOME`. `compileSdk`/`targetSdk` = 36, `minSdk` = 24
   (voir `../variables.gradle`).

2. **`google-services.json`** — dans la console Firebase du projet
   (`asrar-bc059`), enregistrer une app Android avec le package
   `com.asrarpro.app`, télécharger le fichier généré et le placer à
   `android/app/google-services.json`. Sans lui, le plugin push compile
   mais `PushNotifications.register()` échouera au runtime
   (« Default FirebaseApp is not initialized »).

3. **Plugin Google Services** — une fois le fichier en place, ajouter :
   - dans `android/build.gradle` (bloc `dependencies` du `buildscript`) :
     `classpath 'com.google.gms:google-services:4.4.2'`
   - en bas de `android/app/build.gradle` :
     `apply plugin: 'com.google.gms.google-services'`

   (`@capacitor/push-notifications` déclare déjà sa propre dépendance
   `firebase-messaging` — rien à ajouter de ce côté.)

4. **Sons de notification** — deux fichiers à déposer dans
   `android/app/src/main/res/raw/` :
   - `asrar_notification.mp3` (canaux FCM ordinaires, `lib/fcmNative.js`,
     et choix « Son ASRAR » des alarmes d'heure planétaire).
   - `asrar_notification_douce.mp3` (choix « Sonnerie douce » des alarmes
     d'heure planétaire, `lib/planetAlarms.js` `SOUND_CHOICES`).

   Sans eux, le canal compile et fonctionne mais reste **silencieux** — voir
   la note de contrainte Android ci-dessous, ce n'est PAS un repli sur la
   sonnerie système.

5. **Icônes** — les icônes/splash actuels sont ceux par défaut de Capacitor.
   Les régénérer depuis le vrai logo (`public/assets/icon-512.png`) avec
   `npx @capacitor/assets generate --android` une fois `@capacitor/assets`
   installé en devDependency.

6. **Signature + Play Store** — keystore de release, fiche Play Console,
   cycle de review Google : aucun de ces éléments n'est dans ce dépôt.

## Workflow une fois le SDK en place

```sh
npm run cap:sync     # recopie capacitor.config.ts vers android/ après tout changement de config
cd android
./gradlew assembleDebug   # ou ouvrir ce dossier dans Android Studio
```

## Ce qui fonctionne déjà (vérifié sans SDK)

- Le web app (`npm run build`) est totalement inchangé : `@capacitor/core`
  et `@capacitor/push-notifications` ne sont importés que dynamiquement
  (`lib/fcmNative.js`), donc absents du bundle partagé — confirmé en
  inspectant `.next/static/chunks/` après build.
- `lib/fcmNative.js` est un no-op immédiat tant que
  `Capacitor.isNativePlatform()` est faux (donc toujours, sur le site web).
- `npx cap add android` a scaffoldé le projet Gradle sans erreur
  (`./gradlew help` réussit) ; seul un build réel (`assembleDebug`) échoue,
  et uniquement faute de SDK (`SDK location not found`).
