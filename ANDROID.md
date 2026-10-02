# Application Android (APK / AAB)

Le dossier `android/` est la coquille native Capacitor d'ASRAR PRO
(`capacitor.config.ts`) : la WebView charge directement
https://www.asrarpro.com, donc toute mise à jour du site se reflète dans
l'application sans republier sur le Play Store.

## Prérequis

- JDK 21
- Android SDK (platform `android-36`, build-tools 36) — renseigner
  `sdk.dir=...` dans `android/local.properties` ou exporter `ANDROID_HOME`.
- `npm install` à la racine.

## Construire

```bash
npm run android:apk   # APK : debug (installable directement) + release
npm run android:aab   # AAB release pour le Play Store
```

Sorties :

| Fichier | Usage |
| --- | --- |
| `android/app/build/outputs/apk/debug/app-debug.apk` | test sur téléphone (signé avec la clé debug) |
| `android/app/build/outputs/apk/release/app-release(-unsigned).apk` | distribution hors Play Store |
| `android/app/build/outputs/bundle/release/app-release.aab` | envoi sur la Play Console |

## Signature release (keystore `prozizou.jks`)

Le keystore et ses mots de passe ne sont **jamais** versionnés.

1. Copier `prozizou.jks` dans `android/`.
2. `cp android/keystore.properties.example android/keystore.properties`
   et y renseigner `storePassword` / `keyPassword` (alias : `prozizou`).
3. Relancer `npm run android:apk` / `npm run android:aab` : les sorties
   release sont alors signées (`app-release.apk`, `app-release.aab`).

En CI, les mêmes valeurs peuvent venir des variables d'environnement
`ASRAR_KEYSTORE_FILE`, `ASRAR_KEYSTORE_PASSWORD`, `ASRAR_KEY_ALIAS`,
`ASRAR_KEY_PASSWORD`.

Signer après coup un artefact non signé :

```bash
# AAB
jarsigner -keystore prozizou.jks app-release.aab prozizou
# APK
zipalign -p 4 app-release-unsigned.apk aligned.apk
apksigner sign --ks prozizou.jks --ks-key-alias prozizou --out app-release.apk aligned.apk
```

## Play Store

- Package publié : **`com.Asrar`** (`applicationId` dans
  `android/app/build.gradle` et `appId` dans `capacitor.config.ts`) — ne
  jamais le modifier, sinon le Play Store le traite comme une autre app.
- Version actuelle du projet : `versionCode 100` / `versionName "7.9"`
  (la dernière publiée était 99 / 7.8). Incrémenter `versionCode` à chaque
  envoi.
- L'AAB doit être signé avec la clé d'importation (upload key) enregistrée
  pour `com.Asrar` dans la Play Console.

## Notifications push natives

`lib/fcmNative.js` utilise Firebase Cloud Messaging avec
`android/app/google-services.json` (projet `asrar-bc059`, app Android
`com.Asrar` — configuration publique, versionnée). Sans ce fichier
l'application fonctionne, mais sans push natives.

## Icônes / écran de démarrage

Générés depuis `public/assets/icon-maskable-512.png` et
`public/assets/icon-512.png` avec `@capacitor/assets`.

## Connexion Google dans l'app

Dans la WebView, la connexion Google Firebase par popup/redirect ne marche
pas (« Unable to process request due to missing initial state »). L'app
utilise donc le sélecteur de compte natif Android
(`@capgo/capacitor-social-login`, `lib/googleNative.js`), puis
`signInWithCredential` côté Firebase.

À configurer une fois dans Google Cloud Console → API et services →
Identifiants (projet Firebase `asrar-bc059`) — ou Firebase → Paramètres du
projet → application Android `com.Asrar` → « Ajouter une empreinte » :

- un client OAuth **Android**, package `com.Asrar`, avec l'empreinte SHA-1
  de la clé d'importation `prozizou.jks` :
  `69:6B:C6:BE:E0:E5:25:B2:60:84:B2:E8:89:EA:8F:20:2D:A6:0C:3A`
- et l'empreinte SHA-1 de la **clé de signature d'application** affichée
  dans Play Console → Intégrité de l'application (c'est elle qui signe
  l'app installée depuis le Play Store).

Ce code JS est servi par le site : la correction n'est active dans l'app
qu'une fois le site redéployé sur www.asrarpro.com.

## Plantage après connexion (push sans google-services.json)

`PushNotifications.register()` plante l'app (exception native relancée par
Capacitor) si Firebase n'est pas initialisé, c.-à-d. sans
`android/app/google-services.json`. `lib/fcmNative.js` interroge d'abord le
plugin local `AsrarNative` (`AsrarNativePlugin.java`) et n'enregistre les
push natives que si Firebase est prêt. Pour activer les push : télécharger
`google-services.json` (Firebase → app Android `com.Asrar`), le placer dans
`android/app/`, puis reconstruire.
