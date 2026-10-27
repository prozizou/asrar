# Vocaux du Zikr collectif : remise en service

Le message historique « L’envoi de ce type de fichier est temporairement
indisponible » est renvoyé par `/api/cloudinary-sign` quand le preset signé
audio manque. Les images peuvent fonctionner avec leur propre preset alors
que les vocaux restent indisponibles. Ce diagnostic n’indique pas un refus du micro.

## Configuration de production

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
5. Avec un membre du groupe, ouvrir Discussion puis toucher le micro : vérifier
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
