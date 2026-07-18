# ASRAR PRO — Hub ésotérique (Firebase + Vercel, activation WhatsApp)

Site **statique** (HTML/CSS/JS, **sans bundler**) servi par **Vercel**, avec des
**fonctions serverless** (`/api`) qui protègent le contenu payant. Authentification
et base de données via **Firebase** (Google Sign-In + Realtime Database).

**L'activation des accès se fait manuellement, hors ligne, via WhatsApp** — il n'y a
plus de paiement en ligne intégré. L'utilisateur choisit une offre, envoie sa demande
sur WhatsApp, et l'administration active l'accès dans Firebase.

> Langue de travail : français. Devise affichée : FCFA (XOF). Version : `3.1.0`.

---

## 1. Vue d'ensemble

ASRAR PRO est un **hub multi-modules** installable en PWA. Chaque module est une page
(ou un sous-dossier) qui réutilise le même socle d'authentification Google et la même
barrière d'accès serveur.

Le **contenu premium** (secrets mystiques, bibliothèque, géomancie, rouwhanes…) est
réservé aux comptes ayant un **accès actif**. Cet accès est accordé à la main par
l'administration après réception d'une demande WhatsApp.

Trois « portes » distinctes coexistent :

| Porte | Quoi | Comment | Nœud Firebase |
|---|---|---|---|
| **Abonnement contenu** | Accès au premium du hub | Demande WhatsApp → activation admin | `purchased_user/{cléEmail}` ou `allowedUsers/{cléEmail}` |
| **Boutique (vendeur)** | Droit de vendre sur le Marché | Demande WhatsApp → activation admin | `sellers/{uid}` |
| **Marché (produit)** | Voir/acheter un produit | Auth seule (pas d'abonnement) — contact vendeur | `det_produits/{key}` |

---

## 2. Arborescence réelle

```
.
├── index.html                  # Accueil public / connexion Google
├── auth/auth.html              # Page d'authentification
├── accueil/accueil.html        # Tableau de bord (+ bloc parrainage)
│
├── asrar/                      # Secrets Mystiques (contenu payant : champ "sirr")
├── bibliotheque/              # Almaqtab (livres ; champ payant : "pdf"/"pdfUrl" + likes/commentaires)
├── marche/                    # Marché Mystique (produits + panier ; contact vendeur)
├── boutique/                  # Ma Boutique (gestion vendeur : boutique + produits)
├── geomancie/tourab.html      # Tourab (géomancie ; réservée aux abonnés)
├── planete/planete.html       # Heures planétaires
├── chiffre/chiffre.html       # Numérologie / Abjad / Istihraj
├── abajad/abajad.html         # Comparateur Abjad
├── combinaisons/              # 99 Noms d'Allah — combinaisons par poids mystique
├── alqalam/                   # Sous-app de calligraphie (modules ES ; même app Firebase compat)
├── parrainage/                # Parrainage : lien personnel, points, 3 mois offerts
│
├── Benefits/                  # « Asma ul-Husna » — 99 Noms d'Allah + compteur de tasbih
│   ├── index.html, app.js, domManager.js
│   ├── abjad.js               # table abjad maghrébine
│   ├── tasbihLogic.js, audio.js
│   ├── access.js              # contrôle d'accès (SDK modulaire, réplique la logique du hub)
│   ├── firebase-init.js, firebase.js, firebase-config
│   ├── manifest.json, sw.js, style.css
│
├── rouwhania/                 # « Rouwhanes » — calculateur réservé aux abonnés
│   ├── index.html, script.js, style.css
│   └── access.js              # intercepte « Calculer » : gate d'accès si non abonné
│
├── css/style.css              # Styles globaux du hub
├── js/
│   ├── firebase-config.js     # Init Firebase (SDK compat) + auth + gate d'accès + WhatsApp
│   ├── api-content.js         # apiPost() : appel /api avec idToken injecté
│   ├── whatsapp.js            # Construit le message et ouvre /api/wa (remplace PayDunya)
│   ├── share.js               # Liens partageables (/s) + Web Share + parrainage
│   ├── main.js                # Utilitaires partagés (calculs astronomiques, etc.)
│   ├── theme.js               # Bascule clair/sombre globale, persistée
│   ├── loader.js              # Loader plein écran entre les pages
│   ├── nav.js                 # Bouton « retour » → accueil depuis une section
│   └── paydunya-client.js     # ⚠️ VESTIGE PayDunya — plus chargé par aucune page
│
├── api/                        # Fonctions Vercel (Node 18+) — un fichier = un endpoint
│   ├── list-content.js        # Métadonnées d'une liste (sans champ payant) — auth requise
│   ├── get-content.js         # 1 élément complet — RÉSERVÉ AUX ABONNÉS (sauf Marché)
│   ├── get-theme.js           # Données géomancie — RÉSERVÉ AUX ABONNÉS
│   ├── shop.js                # Boutique vendeur (me / save-shop / save-product / delete-product)
│   ├── cloudinary-sign.js     # Signature d'upload Cloudinary (secret côté serveur)
│   ├── book-social.js         # Likes & commentaires des livres (counts / list / like / comment)
│   ├── referral.js            # Parrainage (me / claim / redeem) + crédit des points
│   ├── share.js               # /s → aperçu Open Graph + redirection vers l'élément
│   ├── track.js               # Journalisation visites / activité / géomancie (lu par l'admin)
│   ├── wa.js                  # Redirection 302 vers WhatsApp (numéro côté serveur)
│   ├── admin.js               # Back-office (super-admin) : stats, CRUD, grant/revoke, sellers…
│   └── _lib/
│       ├── access.js          # verifyUser() + hasActiveAccess() + isAdmin() (la vraie barrière)
│       ├── grant.js           # Init Firebase Admin partagée (app())
│       ├── sellers.js         # Statut vendeur : sellers/{uid} + boutiques "profil"
│       ├── sources.js         # Liste blanche des nœuds + champs sensibles
│       ├── http.js            # CORS + parsing du body
│       ├── plans.js           # ⚠️ Catalogue prix/durée — VESTIGE, plus importé
│       ├── orders.js          # ⚠️ Commandes Marché + commission 5 % — VESTIGE, plus importé
│       └── paydunya.js        # ⚠️ Appels API PayDunya — VESTIGE, plus importé
│
├── rules/purchases.rules.json # Règles RTDB à FUSIONNER (voir rules/README.md)
├── assets/                    # Jeu d'icônes complet (192/512, maskable, apple-touch, favicon, logos)
├── sw.js                      # Service Worker RACINE (scope "/") — contrôle tout le site
├── pwa.js                     # Contrôleur PWA (enregistre le SW, MAJ sur place, invite d'installation)
├── manifest.json              # Manifest PWA (icônes + raccourcis Noms / Rouwhanes / Secret)
├── package.json               # dépendance : firebase-admin ^12.7.0
├── vercel.json                # maxDuration des fonctions + réécriture /s → /api/share
└── … docs (voir §10)
```

---

## 3. Modèle d'accès & d'activation

### La barrière réelle est côté serveur

`api/_lib/access.js → hasActiveAccess()` est la **seule** vraie barrière. Un utilisateur
a accès s'il est, dans l'ordre :

1. **super-admin** (`SUPER_ADMIN_EMAIL`, défaut `prozizou298@gmail.com`) ;
2. **admin** : `admins/{cléEmail} === true` ;
3. **VIP** : `vip_users/{uid}` existe ;
4. **accès activé** : `purchased_user/{cléEmail}.token` présent **et** non expiré
   (`expiresAt` : `"lifetime"`, nombre futur, ou absent = compat) ;
5. **grant manuel** : `allowedUsers/{cléEmail}` = `true` ou timestamp futur.

`cléEmail` = e-mail avec les points remplacés par des virgules (`.` → `,`), **partout**
(client, `access.js`, règles RTDB).

### Activation via WhatsApp (le vrai flux)

1. L'utilisateur ouvre le **portail d'offres** (au clic sur un élément protégé, via
   `showSubscriptionGate()`). Le portail affiche 3 formules de contenu :
   **3 Mois — 15 000**, **6 Mois — 25 000**, **1 An — 45 000** (marquée « Populaire »).
2. `startSubscription(planId)` appelle `window.ASRAR_WA.openAccess(...)`, qui construit
   un message et ouvre **`/api/wa`**. La fonction `wa.js` lit le numéro dans la variable
   d'environnement **`WHATSAPP_NUMBER`** (jamais en clair dans le code) et redirige (302)
   vers `wa.me/<numéro>` avec le message pré-rempli.
3. Après contact/règlement hors ligne, **l'administration active l'accès** :
   `api/admin.js → grant-access` (écrit `purchased_user` / `allowedUsers`) ou directement
   la console Firebase.

> **Boutique / vendeur** : même principe. L'admin écrit `sellers/{uid}` (via
> `admin.js → seller-action`). Un vendeur actif gère ensuite sa boutique et ses produits
> via `/api/shop`. Statut vérifié par `_lib/sellers.js`.

### Contenu verrouillé au niveau des règles

Le contenu payant (`db_sirr_*`, `almaqtab`, `det_produits`, `theme_fondamental`) est en
**lecture serveur uniquement** dans les règles RTDB : le navigateur ne peut pas le lire
directement. Il transite par `list-content` (aperçu, auth seule) et
`get-content` / `get-theme` (complet, accès vérifié). La liste blanche `_lib/sources.js`
interdit toute demande de chemin Firebase arbitraire.

---

## 4. Référence des endpoints (`/api`)

`api/<nom>.js` → `POST /api/<nom>`. Toutes les routes (sauf `wa`) exigent un `idToken`
Firebase valide dans le corps JSON ; l'identité vient du jeton vérifié serveur
(`verifyUser`), jamais du corps. Détail complet : `api/README.md`.

**Contenu (paywall)**
- `list-content` `{ idToken, kind, cat? }` — aperçu, champs sensibles retirés. `kind` ∈ `secret | book | product | verset | asma`.
- `get-content` `{ idToken, kind, cat?, key }` — élément complet, réservé aux abonnés (sauf sources `authOnly`).
- `get-theme` `{ idToken }` — tableau géomancie `theme_fondamental` (abonnés).

**Boutique / Marché**
- `shop` `{ idToken, action, … }` — `me | save-shop | save-product | delete-product`. Écrit dans `det_produits`, réservé au vendeur actif et à SES produits.
- `cloudinary-sign` `{ idToken, folder? }` — signature d'upload Cloudinary (le secret reste serveur).

**Social & télémétrie**
- `book-social` `{ idToken, action, bookKey?, keys?, text? }` — `counts | list | like | comment`.
- `track` `{ idToken, type, page?, lat?, lng?, city? }` — visites / activité / géomancie (renvoie toujours 200).

**Partage & parrainage**
- `share` (via réécriture `/s`) — page d'aperçu Open Graph + redirection ; compte le clic.
- `referral` `{ idToken, action, code? }` — `me | claim | redeem`.

**WhatsApp**
- `wa` `GET|POST` — redirection 302 vers WhatsApp (numéro lu dans `WHATSAPP_NUMBER`).

**Administration (super-admin / admin)**
- `admin` `{ idToken, action, … }` — `stats`, `list-secrets`, `delete-secret`, `list-books`, `delete-book`, `list-products`, `delete-product`, `list-sellers`, `seller-action`, `list-orders`, `list-activity`, `list-geomancie`, `grant-access`, `revoke-access`, `list-access`.

> **Sources de contenu** (`_lib/sources.js`) : `secret` → `db_sirr_<cat>` (cats :
> `deblocage`, `domptage`, `ilham`, `protection`, `ouverture`) · `book` → `almaqtab`
> (champs masqués `pdf`/`pdfUrl`) · `product` → `det_produits` (`authOnly`) ·
> `verset` → `versetRef` · `asma` → `data/appData/asmaUlHusna`.

---

## 5. Pattern d'une page du hub

Chaque page charge le socle **dans cet ordre** (scripts classiques), puis sa logique :

```html
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>
<script src="../js/firebase-config.js"></script>   <!-- auth + gate + WhatsApp -->
<script src="../js/api-content.js"></script>       <!-- apiPost() -->
<!-- … puis whatsapp.js, theme.js, loader.js, nav.js, pwa.js selon la page … -->
```

`firebase-config.js` expose en global : `requireAuth`, `requireAccess`, `ensureAccess`,
`checkAccess`, `startSubscription`, `showSubscriptionGate`, `invalidateAccessCache`,
`getRoot`, `signOut`. `api-content.js` expose `apiPost()`, qui injecte automatiquement
l'`idToken` Firebase. **Al-Qalam** et **Benefits** réutilisent la même app Firebase
(Benefits en SDK modulaire via `firebase-init.js`).

---

## 6. Déploiement (Vercel)

1. Pousser le dépôt sur Vercel (ou `vercel --prod`). Front **100 % statique, aucun build**.
2. `/api` est routé automatiquement (un fichier = un endpoint).
3. Renseigner les **variables d'environnement** (§7) dans *Settings → Environment Variables*.
4. **Fusionner** les règles RTDB : voir `rules/README.md`.
5. Côté Firebase : activer **Google** comme fournisseur d'auth et autoriser le domaine de
   production dans *Authentication → Settings → Authorized domains*.

---

## 7. Variables d'environnement

**WhatsApp (activation)**
- `WHATSAPP_NUMBER` — numéro au format international, sans `+` ni espaces (ex. `221771234567`). Lu par `api/wa.js`. **Requis** pour le portail d'accès. Voir `DEPLOIEMENT_WHATSAPP.md`.

**Firebase Admin (serveur)**
- `FIREBASE_SERVICE_ACCOUNT` — JSON **brut** OU base64 du compte de service.
- `FIREBASE_DB_URL` — URL de la Realtime Database.

**Accès / administration**
- `SUPER_ADMIN_EMAIL` — e-mail super-admin (défaut codé dans `access.js`).

**Uploads (boutique)**
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — pour `cloudinary-sign.js`.

**Site**
- `SITE_URL` — URL de production (utilisée pour le CORS et les liens de partage). À défaut, l'origine de la requête est utilisée.

> ⚠️ Le **compte de service** ne doit JAMAIS être commité ni collé en clair. En cas de
> fuite, le révoquer et le régénérer immédiatement dans la console Firebase.

> Les variables `PAYDUNYA_*` / `STORE_*` ne sont **plus** nécessaires : le paiement en
> ligne a été retiré (voir §9).

---

## 8. Partage & parrainage

Chaque élément a un lien court **`/s?k=<type>&c=<cat>&i=<clé>&r=<code>`** (réécrit vers
`api/share.js`) : aperçu Open Graph pour WhatsApp / Facebook / TikTok / Telegram, puis
redirection vers la page du hub. La page d'aperçu est **publique** mais n'expose que le
titre + l'image (le paywall reste intact).

Le **parrainage** (`api/referral.js`, `/parrainage/`) crédite **10 points** par **nouveau
compte** inscrit depuis le lien (jamais au simple clic : falsifiable) ; **1000 points =
3 mois d'abonnement** (`sub_3m`, 90 jours). Anti-triche : 1 crédit par filleul,
auto-parrainage refusé, comptes trop anciens refusés. Détails : `PARTAGE_ET_PARRAINAGE.md`.

---

## 9. Note sur PayDunya (héritage retiré)

Le projet utilisait auparavant un paiement en ligne PayDunya. **Ce flux a été remplacé
par l'activation manuelle via WhatsApp.** Les fichiers suivants sont conservés dans le
dépôt mais **ne sont plus utilisés par aucun endpoint ni aucune page** :
`js/paydunya-client.js`, `api/_lib/paydunya.js`, `api/_lib/orders.js`, `api/_lib/plans.js`.
Les endpoints `create-invoice`, `create-order`, `confirm-invoice` et `paydunya-ipn`
**n'existent plus**. Ces vestiges peuvent être supprimés sans impact (le catalogue
prix/durée est aujourd'hui rappelé dans `js/whatsapp.js` et le portail d'offres).

---

## 10. PWA & sécurité

- **PWA** : service worker racine `sw.js` (scope `/`, contrôle hub + Benefits + Rouwhania + sous-apps), contrôleur `pwa.js` (mise à jour sur place + invite d'installation). Manifest avec raccourcis Noms / Rouwhanes / Secret.
- **Sécurité** : identité toujours dérivée du jeton Firebase vérifié serveur ; contenu payant inaccessible au client (règles RTDB `.read:false`) ; liste blanche des nœuds ; secrets (Firebase Admin, Cloudinary, numéro WhatsApp) uniquement côté serveur.

---

## 11. Pour aller plus loin
- `CHANGELOG.md` — historique des sessions (dernière : liens partageables & parrainage).
- `api/README.md` — référence des endpoints.
- `rules/README.md` — fusion des règles RTDB.
- `DEPLOIEMENT_WHATSAPP.md` — configuration du numéro WhatsApp.
- `INTEGRATION_PAIEMENT.md` — flux d'authentification et d'accès.
- `PARTAGE_ET_PARRAINAGE.md` — liens partageables & programme de parrainage.
- `REVUE.md` — revue technique (asrar / marché / planète / chiffre).
- `boutique/README.md`, `marche/README.md`, `alqalam/README.md` — notes par module.
