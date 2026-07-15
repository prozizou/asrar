# ASRAR PRO — Hub ésotérique & Marché (PayDunya + Firebase)

Site **statique** (HTML/CSS/JS sans bundler) servi par **Vercel**, avec des
**fonctions serverless** (`/api`) qui protègent le contenu payant et gèrent les
paiements **PayDunya**. Authentification et base de données via **Firebase**
(Google Sign-In + Realtime Database).

> Langue de travail : français. Devise : FCFA (XOF).

---

## 1. Vue d'ensemble

ASRAR PRO est un **hub multi-modules**. Chaque module est une page (ou un
sous-dossier) qui réutilise le même socle d'authentification et de paiement.

Deux modèles de paiement **distincts** coexistent :

| Modèle | Quoi | Endpoint | Montant | Bénéficiaire |
|---|---|---|---|---|
| **Abonnement** | Accès au contenu premium du hub | `/api/create-invoice` | Fixé serveur (`plans.js`) | Plateforme |
| **Marché** | Achat d'un produit d'un vendeur | `/api/create-order` | Prix vendeur (lu serveur) | Vendeur 95 % / **Admin 5 %** |
| **Boutique** | Droit de vendre (abonnement vendeur) | `/api/create-invoice` (plan `boutique_*`) | Fixé serveur (`plans.js`) | Plateforme |

Les deux passent par la **même** facture PayDunya et le **même** callback
(`/api/paydunya-ipn`), qui aiguille selon `custom_data.kind`.

---

## 2. Arborescence

```
.
├── index.html                  # Accueil public / connexion Google
├── auth/auth.html              # Page d'authentification
├── accueil/accueil.html        # Tableau de bord (confirme le retour d'abonnement)
│
├── asrar/                      # Secrets Mystiques (contenu payant : champ "sirr")
├── bibliotheque/              # Almaqtab (livres ; champ payant : "pdf")
├── marche/                    # Marché Mystique (produits + panier + checkout)
├── boutique/                  # Ma Boutique (abonnement vendeur + gestion produits)
├── geomancie/                 # Tourab (géomancie ; paywall AU CLIC sur Calculer l'Écu)
├── planete/                   # Heures planétaires
├── chiffre/                   # Numérologie / Abjad / Istihraj
├── abajad/                    # Comparateur Abjad
├── alqalam/                   # Sous-app PWA de calligraphie (modules ES)
├── parrainage/                # Parrainage : lien personnel, points, 3 mois offerts
│
├── css/style.css              # Styles globaux du hub
├── js/
│   ├── firebase-config.js     # Init Firebase (SDK COMPAT) + auth + paywall + plans
│   ├── api-content.js         # apiPost() : appel /api avec idToken injecté
│   ├── share.js               # Liens partageables (/s) + Web Share + parrainage
│   ├── paydunya-client.js     # Helpers paiement (createCheckout, confirmFromReturn)
│   └── main.js                # Utilitaires partagés (calculs astronomiques, etc.)
│
├── api/                        # Fonctions Vercel (Node 18+)
│   ├── create-invoice.js      # Crée une facture d'ABONNEMENT
│   ├── create-order.js        # Crée une commande MARCHÉ (prix serveur + 5 %)
│   ├── confirm-invoice.js     # Confirme au retour navigateur (idempotent)
│   ├── paydunya-ipn.js        # Callback serveur PayDunya (source de vérité)
│   ├── list-content.js        # Métadonnées d'une liste (sans contenu payant)
│   ├── get-content.js         # 1 élément complet — RÉSERVÉ AUX ABONNÉS
│   ├── get-theme.js           # Données géomancie — RÉSERVÉ AUX ABONNÉS
│   ├── create-order.js        # (déjà ci-dessus) commande Marché
│   ├── shop.js                # Gestion boutique vendeur (CRUD produits)
│   ├── share.js               # /s → aperçu Open Graph + redirection vers l'élément
│   ├── referral.js            # Parrainage : code, crédit des points, 3 mois offerts
│   ├── track.js               # Journalisation visites / activité / géomancie (lu par l'admin)
│   └── _lib/
│       ├── access.js          # verifyUser() + hasActiveAccess() (la vraie barrière)
│       ├── grant.js           # Active l'abonnement (purchased_user / purchases)
│       ├── orders.js          # Commandes Marché (total, commission 5 %, paiement)
│       ├── sellers.js         # Abonnement boutique (sellers/{uid}) + statut vendeur
│       ├── plans.js           # Catalogue des abonnements (prix + durée)
│       ├── paydunya.js        # Appels API PayDunya (createInvoice / confirmInvoice)
│       ├── sources.js         # Liste blanche des nœuds + champs sensibles
│       └── http.js            # CORS + parsing du body
│
├── rules/purchases.rules.json # Règles RTDB à FUSIONNER (voir rules/README.md)
├── package.json               # dépendance : firebase-admin
├── vercel.json                # maxDuration des fonctions
├── README.md                  # ce fichier
├── CHANGELOG.md               # corrections de la dernière session
└── .env.example               # modèle de variables d'environnement
```

---

## 3. Déploiement (Vercel)

1. Pousser le dépôt sur Vercel (ou `vercel --prod`).
2. Le dossier `/api` est routé automatiquement (un fichier = un endpoint).
   `api/create-order.js` → `POST /api/create-order` (aucune config requise).
3. Renseigner les **variables d'environnement** (section 4) dans le projet Vercel.
4. Déployer (fusionner d'abord) les **règles RTDB** : voir `rules/README.md`.
5. Côté Firebase : activer **Google** comme fournisseur d'auth et autoriser le
   domaine de production dans *Authentication → Settings → Authorized domains*.

> Le front est 100 % statique : aucune étape de build. Les pages chargent
> Firebase via le **SDK compat** par balises `<script>` (voir section 6).

---

## 4. Variables d'environnement

Voir `.env.example`. Sur Vercel, les définir dans *Settings → Environment Variables*.

**PayDunya**
- `PAYDUNYA_MODE` = `test` | `live` (défaut `test`)
- `PAYDUNYA_MASTER_KEY`, `PAYDUNYA_PRIVATE_KEY`, `PAYDUNYA_TOKEN`
- `STORE_NAME` (affiché sur la page de paiement), `STORE_LOGO_URL`, `STORE_WEBSITE_URL` (optionnels)

**Site**
- `SITE_URL` = URL de production (ex. `https://asrarpro.example`). Sert aux
  `return_url` / `callback_url` et au CORS. À défaut, déduite de la requête.

**Firebase Admin (serveur)**
- `FIREBASE_SERVICE_ACCOUNT` = JSON **brut** OU base64 du compte de service
- `FIREBASE_DB_URL` = URL de la Realtime Database

**Accès**
- `SUPER_ADMIN_EMAIL` = e-mail super-admin (défaut codé dans `access.js`)

> ⚠️ Le **compte de service** ne doit JAMAIS être commité ni collé en clair.
> S'il fuit, le révoquer et le régénérer immédiatement dans la console Firebase.

---

## 5. Modèle d'accès (paywall)

La **seule barrière réelle** est côté serveur (`api/_lib/access.js` →
`hasActiveAccess`). Un utilisateur a accès s'il est, dans l'ordre :

1. **super-admin** (`SUPER_ADMIN_EMAIL`) ;
2. **admin** : `admins/{cléEmail} === true` ;
3. **VIP** : `vip_users/{uid}` existe ;
4. **acheteur abonné** : `purchased_user/{cléEmail}.token` présent **et** non expiré
   (`expiresAt` : `"lifetime"`, nombre futur, ou absent pour compat) ;
5. **grant manuel** : `allowedUsers/{cléEmail}` = `true` ou timestamp futur.

`cléEmail` = e-mail avec les points remplacés par des virgules (`.` → `,`),
**partout** (client, `grant.js`, `access.js`, règles RTDB).

> **Vendeurs** : statut séparé dans `sellers/{uid}` (abonnement boutique), distinct
> de l'accès au contenu. Vérifié par `_lib/sellers.js` côté serveur.

> **Administrateurs** : super-admin (`SUPER_ADMIN_EMAIL`) ou `admins/{cléEmail}===true`.
> Le **back-office est un projet SÉPARÉ** (dossier/zip `admin/`), déployé à part, avec
> sa propre connexion Google. L'app ne contient donc ni `admin/` ni `api/admin.js` ;
> elle conserve seulement `api/track.js` (journalisation lue par l'admin).

Le contenu payant (`db_sirr_*`, `almaqtab`, `det_produits`, `theme_fondamental`)
est en **lecture serveur uniquement** dans les règles : le navigateur ne peut
plus le lire directement. Il transite par `list-content` (aperçu, auth seule) et
`get-content` / `get-theme` (complet, abonnement vérifié). La liste blanche
`_lib/sources.js` empêche toute demande de chemin Firebase arbitraire.

---

## 6. Pattern d'une page du hub

Chaque page charge le socle **dans cet ordre** (scripts classiques), puis sa
logique :

```html
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>
<script src="../js/firebase-config.js"></script>   <!-- définit les globaux -->
<script src="../js/api-content.js"></script>       <!-- définit apiPost() -->
<!-- ... puis le script de la page ... -->
```

`firebase-config.js` expose en global : `requireAuth`, `requireAccess`,
`ensureAccess`, `checkAccess`, `startSubscription`, `showSubscriptionGate`,
`invalidateAccessCache`, `getRoot`, `signOut`. `api-content.js` expose `apiPost()`,
qui injecte automatiquement l'`idToken` Firebase.

**Al-Qalam** (`alqalam/`) suit désormais exactement ce pattern : il réutilise la
même app Firebase compat (plus d'app modulaire « nommée » séparée). Voir
`alqalam/` et le `CHANGELOG.md`.

---

## 7. Flux de paiement

### a) Abonnement
1. `startSubscription(planId)` → `POST /api/create-invoice` `{ idToken, productId }`.
   Le montant vient de `plans.js` (jamais du client). Redirection vers PayDunya.
2. Retour navigateur sur `accueil/accueil.html?token=…` → `confirmFromReturn()` →
   `GET /api/confirm-invoice` → déblocage immédiat (idempotent).
3. En parallèle, PayDunya appelle `/api/paydunya-ipn` (fiable). Les deux
   reconfirment via `confirmInvoice()` puis `grantAccess()`.

Plans (`api/_lib/plans.js`) : `sub_3m` 15 000 / 90 j · `sub_6m` 25 000 / 180 j ·
`sub_1y` 45 000 / 365 j · `sub_life` 100 000 / à vie.

### b) Marché (produits — commission 5 %)
1. `payWithPayDunya()` (dans `marche/marche.js`) → `apiPost('create-order', { items:[{key,quantity}] })`.
   Le client n'envoie **que** des clés + quantités.
2. `create-order` relit les prix dans `det_produits`, calcule le **total**, la
   **commission administration = 5 %** et le **reversement vendeur = 95 %**, crée la
   facture PayDunya, et enregistre la commande `orders/{uid}/{orderId}` (statut `pending`).
3. Retour sur `marche/marche.html?token=…` → `confirm-invoice` ; et l'IPN en
   parallèle. Les deux aiguillent vers `markOrderPaid()` (statut `paid` + journal
   `vendor_sales/{vendorId}/{orderId}`).

> **Important — pas de split automatique.** Avec le checkout PayDunya standard,
> 100 % du montant arrive sur le compte plateforme. Les 95 % dus aux vendeurs sont
> **journalisés** (`vendor_sales`) pour règlement manuel/scripté. Un reversement
> automatique nécessiterait l'API de paiement de masse de PayDunya.

### c) Boutique (abonnement vendeur)
1. Sur `boutique/boutique.html`, l'utilisateur choisit `boutique_1m` (10 000) ou
   `boutique_3m` (25 000) → `startSubscription(planId)` → `/api/create-invoice`.
   Le serveur tague `custom_data.kind='shop'` et renvoie sur la boutique.
2. Au paiement, `grantSeller` écrit `sellers/{uid}` (actif + expiration). Le vendeur
   gère ensuite sa boutique et ses produits via `/api/shop` (Admin SDK).
3. Un compte Google = un vendeur unique. Les produits créés alimentent le Marché.

---

## 8. Sécurité — points clés

- Identité **toujours** dérivée du jeton Firebase vérifié serveur (`verifyUser`),
  jamais du corps de la requête.
- Montants d'abonnement **et** prix du Marché fixés/relus côté serveur.
- Contenu payant inaccessible au client (règles RTDB `.read:false`).
- `callback_url` reconfirme la facture (source de vérité) → un faux callback ne
  débloque rien.
- `purchased_user` / `purchases` / `orders` : lecture par le seul propriétaire,
  écriture serveur uniquement.

---

## 9. Partage & parrainage

Chaque élément possède un lien court **`/s?k=secret&c=deblocage&i=<clé>&r=<code>`**
(réécrit vers `api/share.js`) : aperçu Open Graph pour WhatsApp/Facebook/TikTok, puis
redirection vers la page du hub (`?item=&cat=`), connexion différée via `?next=` si besoin.
Le paywall reste intact (l'aperçu n'expose que titre + image).

Le **parrainage** (`api/referral.js`, `/parrainage/`) crédite **10 points** par
**nouveau compte** inscrit depuis le lien (jamais au simple clic : ce serait
falsifiable) ; **1000 points = 3 mois d'abonnement**. Détails, paramètres et
anti-triche : **`PARTAGE_ET_PARRAINAGE.md`**.

---

## 10. Pour aller plus loin
- `CHANGELOG.md` : ce qui a été corrigé/ajouté à la dernière session.
- `api/README.md` : référence des endpoints.
- `rules/README.md` : fusion des règles RTDB.
- `REVUE.md` : revue technique antérieure (asrar / marché / planète / chiffre).
- `PARTAGE_ET_PARRAINAGE.md` : liens partageables et programme de parrainage.
