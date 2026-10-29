# Images et vocaux du Zikr collectif : activation

Les messages « L’envoi d’images n’est pas activé » et « L’envoi de vocaux
n’est pas activé » correspondent au code `UPLOAD_NOT_CONFIGURED` émis par
`/api/cloudinary-sign`. Au moins un des trois identifiants communs ou le preset
signé du média demandé manque. Ils ne permettent pas d’identifier à eux seuls
le paramètre absent. Ce blocage intervient avant le transfert et, pour un
vocal, avant la demande d’accès au microphone.

## Images et identifiants communs

Dans le même environnement Cloudinary que l’application, créer un preset
**Signed**, par exemple `asrar_zikr_images`. Autoriser les formats pris en
charge par le produit (JPEG, PNG, WebP ; HEIC/HEIF seulement si nécessaire et
pris en charge par le compte), et fixer une taille maximale adaptée, par
exemple 10 Mo. Vérifier le refus effectif des formats interdits et des fichiers
surdimensionnés dans Cloudinary.

Dans Vercel → projet ASRAR → Settings → Environment Variables → **Production** :

```text
CLOUDINARY_CLOUD_NAME=<nom de votre environnement Cloudinary>
CLOUDINARY_API_KEY=<clé API de cet environnement>
CLOUDINARY_API_SECRET=<secret API de cet environnement>
CLOUDINARY_IMAGE_UPLOAD_PRESET=asrar_zikr_images
CLOUDINARY_AUDIO_UPLOAD_PRESET=asrar_zikr_audio
```

Les noms de presets doivent correspondre à ceux effectivement créés. Le nom
historique `CLOUDINARY_UPLOAD_PRESET` reste accepté pour les images uniquement.
Le preset des images ne permet pas d’activer les vocaux. Garder l’API secret
côté serveur et ne pas utiliser de variable `NEXT_PUBLIC_` pour ces identifiants.

## Vérification locale sans exposer les secrets

Avec les variables chargées dans le terminal :

```bash
node scripts/check-cloudinary-config.cjs
```

Ou avec un fichier `.env.local` privé, non versionné :

```bash
node --env-file=.env.local scripts/check-cloudinary-config.cjs
```

La commande indique uniquement les noms manquants ; elle n’affiche jamais les
valeurs, n’appelle aucun service et ne modifie aucune configuration. Elle vérifie
l’environnement local, pas les variables d’un déploiement Vercel existant.
Une configuration complète ne garantit pas que les clés sont valides ou que
les presets existent : un essai réel reste nécessaire après activation.

## Preset des vocaux et activation de production

1. Dans le **même environnement Cloudinary** que `CLOUDINARY_CLOUD_NAME`, ouvrir
   Settings → Upload → Upload presets et créer un preset nommé par exemple
   `asrar_zikr_audio`, en mode **Signed**. Ne pas réutiliser le preset réservé
   aux images et ne pas activer les uploads non signés.
2. Autoriser les formats d’enregistrement des appareils utilisés : `webm`, `ogg`,
   `mp4`/`m4a` et, si nécessaire, `aac`, `mp3`, `wav`, `opus`. Cloudinary traite
   les audios via son canal **video**. Ne pas limiter ce preset au type image.
   Définir une taille maximale adaptée (par exemple 20 Mo), les restrictions
   de format et la politique de durée (l’interface arrête à 120 secondes).
   La limite d’interface ne remplace pas les restrictions du fournisseur.
3. Dans Vercel → projet ASRAR → Settings → Environment Variables, définir
   `CLOUDINARY_AUDIO_UPLOAD_PRESET=asrar_zikr_audio` pour Production et pour
   les environnements de recette concernés. Vérifier que cloud name, API key
   et API secret appartiennent au même environnement Cloudinary.
4. **Redéployer** l’application pour prendre en compte la variable ; son ajout
   seul ne modifie pas une fonction déjà déployée.
5. Avec un membre du groupe, envoyer d’abord une petite image et vérifier sa
   lecture sur un deuxième compte. Puis toucher le micro : vérifier
   un vocal court, sa lecture sur un deuxième compte, un vocal long et une coupure
   réseau. Tester Android WebView et Safari si utilisé. Vérifier aussi le refus
   d’un fichier trop volumineux et d’un format interdit côté Cloudinary.

Aucun identifiant Cloudinary/Vercel de production n’était disponible pendant
ce correctif : la configuration réelle n’a pas été modifiée par la PR.
Le nom du preset n’est pas un secret ; l’API secret doit rester côté serveur.

## Comportement du correctif

Avant de demander le micro, la discussion vérifie la configuration via une
requête authentifiée réservée aux membres. Un blocage est affiché durablement
avec une explication, sans faire enregistrer un vocal inutilisable. Cette vérification
contrôle la présence des variables ; elle ne garantit pas que le preset existe
ou est correctement borné dans Cloudinary : la recette réelle reste nécessaire.

Si le transfert ou l’enregistrement du message échoue ensuite, le vocal reste
**en mémoire dans la page** et peut être téléchargé avant de la quitter.
Il n’est pas conservé après fermeture ou rechargement. Le transfert a un délai
maximal de 90 secondes et une réponse sans URL confirmée est refusée.
Aucun contournement du preset signé n’est introduit.
