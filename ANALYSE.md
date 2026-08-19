# Analyse — ASRAR PRO : forces, faiblesses & améliorations

> Mise à jour de cette revue pour l'état **actuel** du dépôt : l'app Next.js
> (App Router) sous `app/` + `pages/api/` + `server/` **est** désormais le
> produit — le site statique historique (`css/style.css`, `index.html`,
> `js/main.js`…) décrit par les versions précédentes de ce document n'existe
> plus dans le dépôt. `REVUE.md` documente des corrections de cette période
> pré-migration et reste un historique, pas l'état courant.

## ✅ Forces

- **Barrière du paywall entièrement côté serveur** : `server/access.js`
  (`verifyUser`/`hasActiveAccess`/`getAccessLevel`) est LA source de vérité,
  appelée depuis `/api/get-content`, `/api/wa`, `/api/admin`… Le numéro
  WhatsApp vendeur n'est par exemple jamais renvoyé au navigateur
  (`get-content` supprime `src.privateFields`, le contact passe par une
  redirection serveur `/api/wa?product=`).
- **Anti-abus pensé, pas juste ajouté** : parrainage avec dédoublonnage
  transactionnel (`referred/{uid}`), refus d'auto-parrainage, exigence de
  compte « frais » (< 7 jours) pour créditer les points, redemption des
  points atomique (`transaction` qui échoue si le solde est insuffisant, et
  restitution en cas d'échec d'activation) ; upload Cloudinary namespacé par
  `uid` pour tracer/cloisonner le stockage.
- **En-têtes de sécurité complets** (`next.config.mjs`) : CSP détaillée par
  domaine réellement utilisé, HSTS, `X-Frame-Options`, `Permissions-Policy`,
  `remotePatterns` restreints pour `next/image`.
- **Assainissement systématique des entrées** : `safeUrl()` / `clean()` /
  échappement HTML dans `server/http.js` et `pages/api/share.js` contre les
  évasions HTML/JS dans les champs libres (admin, tracking, aperçu Open
  Graph).
- **CI minimale mais réelle** : lint + build sur chaque push/PR
  (`.github/workflows/ci.yml`), avec variables d'environnement factices
  documentées pour ne pas casser le build.
- **Architecture modulaire propre** : logique pure isolée dans `lib/`
  (abjad, combinaisons, géomancie, planète…), UI dans `app/`, accès Admin
  SDK dans `server/` — une séparation qui rend la logique métier facilement
  testable, même si elle ne l'est pas encore (voir plus bas).
- **PWA conservée** (`public/manifest.json`, `public/sw.js`) et thème
  clair/sombre centralisé.

## ⚠️ Faiblesses

1. **Le App Router n'apporte quasiment aucun de ses bénéfices** : 39 des 41
   fichiers `.js` de `app/` + `components/` sont marqués `'use client'`. Il
   n'y a ni rendu serveur, ni React Server Components, ni streaming — c'est
   une SPA classique habillée en Next.js, avec le bundle JS et le coût de
   First Contentful Paint que cela implique. Le README annonce pourtant
   « prouver le pattern » du framework.
2. **Zéro test automatisé** (unitaire ou e2e). La CI ne fait que lint + build ;
   aucune assertion ne protège les modules `lib/` (poids Abjad, recherche de
   combinaisons, résolution géomantique, `access.js`/`referral`…), pourtant
   purs et donc faciles à tester. Une régression silencieuse sur un calcul
   ésotérique ou sur la logique d'accès ne serait détectée qu'en production.
3. **Pas de TypeScript ni de vérification de types** (`jsconfig.json`
   minimal). Les erreurs de forme de données (ex. un champ Firebase absent
   ou mal typé) ne sont détectées qu'à l'exécution.
4. **Règles de sécurité Firebase RTDB absentes du dépôt.** Le code suppose
   des `.read`/`.write` précises (ex. `comments/`, `ratings/`,
   `purchased_user/` en écriture serveur uniquement — voir les commentaires
   dans `server/access.js` et `pages/api/*`), mais rien de versionné ne
   permet de vérifier ni de diffuser ces règles : elles ne vivent que dans
   la console Firebase. Risque de dérive silencieuse entre ce que le code
   suppose et ce qui est réellement déployé.
5. **Constantes dupliquées client/serveur**, avec synchronisation manuelle :
   `SUPER_ADMIN`, `PREMIUM_LEVEL`, les paliers `SUB_PLANS[].level` existent
   à la fois dans `lib/access.js` (client) et `server/access.js` (serveur),
   avec des commentaires « doit rester synchronisé avec… ». La barrière
   réelle reste côté serveur, mais un oubli de synchronisation peut afficher
   un état d'accès incohérent côté UI.
6. **CSP encore en `'unsafe-inline'`** pour `script-src` et `style-src` — un
   compromis documenté (script anti-FOUC, `style=""` posé par React) mais
   qui reste la plus large ouverture XSS résiduelle ; un nonce généré par un
   middleware Next fermerait ce trou.
7. **Pas de limitation de fréquence applicative** sur les routes
   authentifiées (`/api/track`, `/api/referral` claim/redeem,
   `/api/cloudinary-sign`) : la protection contre l'abus repose uniquement
   sur les transactions RTDB (empêchent le double-crédit) mais pas sur un
   plafond d'appels — un compte compromis peut spammer `activity_feed` /
   `analytics/visits` sans être bloqué.
8. **Documentation partiellement périmée** : le `README.md` et le
   `package.json` (`"description": "… App parallèle : ne remplace pas le
   site statique existant."`) décrivent encore un « pilote » migrant
   progressivement un site statique, alors que la migration est terminée et
   qu'aucun site statique n'existe plus dans le dépôt — de quoi désorienter
   un nouveau contributeur.
9. **Aucun suivi d'erreurs en production** (pas de Sentry ou équivalent).
   Les erreurs serveur ne vont qu'à `console.error` (Vercel logs) et le
   filet client (`app/error.js`) affiche un écran de secours sans
   remontée — aucune alerte proactive en cas de panne ou de pic d'erreurs.
10. **Upload Cloudinary non verrouillé en format/taille** : la signature
    (`pages/api/cloudinary-sign.js`) contraint le dossier (namespacé par
    `uid`) mais pas `resource_type`, le format ni la taille du fichier —
    limite documentée dans le code lui-même, faute d'un « upload preset »
    signé configuré côté Cloudinary.

## 🚀 Améliorations proposées

Classées par rapport bénéfice / effort :

1. **Couvrir `lib/` par des tests unitaires** (Vitest ou Jest, léger à
   ajouter) — priorité haute : ce sont des fonctions pures (abjad,
   combinaisons, géomancie, planète, `access.js`), donc rapides à tester et
   à forte valeur (calculs ésotériques = cœur produit). Ajouter `npm test`
   à la CI.
2. **Versionner les règles Firebase RTDB** dans le dépôt (ex. `rules/*.json`
   comme le faisait l'ancien site, avec un script `firebase deploy --only
   database` documenté) pour qu'elles soient revues en PR au même titre que
   le code serveur qui en dépend.
3. **Réduire la surface `'use client'`** progressivement : au minimum,
   passer `app/layout.js` et les pages de contenu public/SEO-sensibles
   (accueil, pages de partage) en composants serveur, en isolant l'état
   interactif dans des sous-composants clients ciblés. Gain direct sur le
   bundle initial et le FCP.
4. **Fermer le compromis CSP** : générer un nonce par requête (middleware
   Next) pour le script anti-FOUC et retirer `'unsafe-inline'` de
   `script-src`/`style-src`.
5. **Dédupliquer les constantes d'accès** : faire dériver `lib/access.js`
   d'une unique source (ex. exposer `PREMIUM_LEVEL`/`SUB_PLANS` via
   `/api/get-theme`-like endpoint public, ou un fichier JSON partagé importé
   des deux côtés) plutôt que deux copies à synchroniser à la main.
6. **Ajouter une limite de fréquence** sur `/api/track`, `/api/referral` et
   `/api/cloudinary-sign` (ex. compteur par `uid` avec fenêtre glissante
   dans Redis/Upstash, ou solution KV Vercel) pour borner l'abus par un
   compte compromis.
7. **Brancher un outil de suivi d'erreurs** (Sentry ou équivalent léger)
   côté client (`app/error.js`) et serveur (`pages/api/*`), avec alerte sur
   pic d'erreurs 5xx.
8. **Mettre à jour `README.md` et `package.json`** pour refléter l'état
   actuel (app unique en production, migration terminée) plutôt que le
   discours « pilote / app parallèle » devenu inexact.
9. **Configurer un « upload preset » Cloudinary signé** (format image
   uniquement, taille max) pour verrouiller ce que `cloudinary-sign.js` ne
   peut pas contraindre lui-même.
10. **TypeScript incrémental** : activer `checkJs` dans `jsconfig.json` en
    premier pas (zéro migration de fichiers, juste des diagnostics), puis
    convertir `lib/` en `.ts` en priorité (logique pure, périmètre clair).
