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

Avant chaque nouvel envoi sur le Play Store, incrémenter `versionCode`
(et `versionName`) dans `android/app/build.gradle`.

## Notifications push natives

`lib/fcmNative.js` utilise Firebase Cloud Messaging : déposer le
`google-services.json` du projet Firebase (application Android
`com.asrarpro.app`) dans `android/app/`. Sans ce fichier l'application
fonctionne, mais sans push natives.

## Icônes / écran de démarrage

Générés depuis `public/assets/icon-maskable-512.png` et
`public/assets/icon-512.png` avec `@capacitor/assets`.
