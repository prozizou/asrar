# CHANGELOG

## Session 6 — Suppression de PayDunya → activation manuelle via WhatsApp

Motivation : impossible de récupérer les fonds envoyés depuis l'étranger (ex. Burkina Faso)
depuis le Sénégal sans représentant. Le paiement en ligne est donc retiré ; l'utilisateur
qui veut un accès (ou passer une commande / ouvrir une boutique) est redirigé vers **WhatsApp**
avec un **message pré-rempli** (e-mail du compte + formule/panier + rubrique). L'administration
active ensuite l'accès **manuellement, par e-mail**.

### Mises à jour (6.1)
- **Offre « Premium à vie » (100 000 FCFA) retirée** des portails (hub, Benefits, Rouwhania)
  et du catalogue de messages. Restent : 3 Mois, 6 Mois, 1 An.
- **Numéro WhatsApp déplacé côté serveur** : nouvelle fonction `api/wa.js` qui lit la
  variable d'environnement Vercel **`WHATSAPP_NUMBER`** et redirige vers WhatsApp.
  `js/whatsapp.js` ne contient plus aucun numéro. Marche à suivre : `DEPLOIEMENT_WHATSAPP.md`.
  `SW_VERSION` → `v3`.


### Nouveau
- `js/whatsapp.js` — **source unique** du numéro WhatsApp + générateurs de messages
  (`openAccess`, `openOrder`). ⚠️ Un seul endroit à éditer : la constante `number`.
- `api/admin.js` — actions **`grant-access {email, days?}`**, **`revoke-access {email}`**,
  **`list-access`** : l'admin accorde/retire l'accès par e-mail (écrit `allowedUsers/{clé}`).
  `days` absent = accès **à vie** ; sinon N jours.

### Portails convertis (PayDunya → WhatsApp)
- Hub (`js/firebase-config.js` : `showSubscriptionGate` / `startSubscription`),
  Benefits (`Benefits/access.js`), Rouwhania (`rouwhania/access.js`),
  Al-Qalam (`alqalam/*`), Boutique (`boutique/*`), Marché (`marche/marche.js` :
  « Commander via WhatsApp »). Le contrôle d'accès (`purchased_user` / `allowedUsers` /
  `admins` / `vip_users`) est **inchangé** : les abonnés existants gardent leur accès.

### Supprimé
- Endpoints : `api/create-invoice.js`, `api/confirm-invoice.js`, `api/create-order.js`,
  `api/paydunya-ipn.js`. Libs : `api/_lib/paydunya.js`, `api/_lib/orders.js`,
  `api/_lib/plans.js`. Clients : `js/paydunya-client.js`, `alqalam/paydunya-client.js`.
- `api/_lib/grant.js` réduit à `app()` ; `api/_lib/sellers.js` réduit à
  `getSeller` / `isActiveSeller`. Variables d'env PayDunya (`PAYDUNYA_*`) inutiles.
- `sw.js` : `SW_VERSION` → `v2` (purge du cache), ajout de `/js/whatsapp.js`.

---

## Session 5 — Noms d'Allah + Rouwhanes : menus, paywall, session persistante

### 1. Menus ajoutés au grand menu ASRAR PRO (`accueil/accueil.html`)
- **Noms d'Allah** → `../Benefits/index.html`
- **Rouwhanes** → `../rouwhania/index.html`

### 2. Intégration du paiement (abonnement au contenu)
- **Benefits (Noms d'Allah)** : nouvelle app partagée `firebase-init.js` (Auth + RTDB,
  SDK modulaire, une seule init) et `access.js` qui rejoue la logique d'accès du hub
  (`purchased_user` / `allowedUsers` / `admins` / `vip_users`). **Sans abonnement :**
  chaque carte n'affiche que le **nom** (verrou visuel) et la **modale est verrouillée**
  (nom seul + bouton « S'abonner »). Le paiement passe par `/api/create-invoice`
  (montant fixé serveur) et **revient sur la page** (`?token=` → `confirmReturn()`).
  Accès mis en cache 6 h pour les abonnés hors-ligne.
- **Rouwhania (Rouwhanes)** : SDK compat + `access.js` qui **intercepte le bouton
  « Calculer »** en phase de capture. Sans abonnement → portail de paiement au lieu
  du calcul. Retour de paiement géré (`confirmReturn`).
- **`api/create-invoice.js`** : accepte un `returnPath` optionnel (liste blanche interne :
  accueil, Benefits, rouwhania) pour ramener l'abonné sur sa page d'origine. Le montant
  reste 100 % serveur.

### 3. Session hub persistante (`index.html`) — plus de reconnexion à chaque visite
- Persistance **LOCAL** explicite + `select_account`.
- **Repli redirection** (`signInWithRedirect` + `getRedirectResult`) quand la popup est
  bloquée (webviews / apps intégrées).
- Indicateur « Reconnexion automatique… » et drapeau local `asrar_seen` : l'utilisateur
  déjà passé une fois entre directement si la session est restaurée.
- Benefits/Rouwhania partagent la même origine et le même projet → **la session Google
  du hub est reconnue automatiquement** (pas de nouvelle connexion).

### Faiblesses corrigées
- **`Benefits/sw.js`** : bug majeur — les chemins **absolus** (`/index.html`, `/style.css`…)
  visaient la racine alors que l'app est sous `/Benefits/` → `cache.addAll()` échouait en
  bloc, **rien n'était mis en cache**. Passage en chemins **relatifs**, précache **tolérant**
  (`allSettled`), ajout des nouveaux modules, cache `asma-v8 → v9`. `manifest.json` :
  `start_url`/`scope` en `./`.
- **`Benefits/index.html`** : suppression de l'`alert()` bloquant à **chaque** erreur JS
  (remplacé par un log console). Versions d'assets `?v=7 → v8`.
- **`rouwhania/script.js`** : normalisation des Noms d'Allah en **tableau** (RTDB peut
  renvoyer un objet → `.filter` plantait).

---


## Session 4 — Administration dissociée (projet autonome + Google Sign-In)

Le back-office est désormais un **projet séparé** (livré dans un zip à part) :
- Retiré de l'application : `admin/` et `api/admin.js`. L'app conserve `api/track.js`
  (journalisation des visites/activité/géomancie, lue par l'admin).
- Le projet admin a sa **propre connexion Google Sign-In** (`firebase-config.js`
  dédié, popup + repli redirect), son **propre `/api/admin`** et ses copies des libs
  serveur nécessaires (`access`, `grant`, `plans`, `sources`, `http`).
- Même base Firebase (mêmes `FIREBASE_SERVICE_ACCOUNT` / `FIREBASE_DB_URL`) → l'admin
  lit les stats produites par l'app et écrit le contenu via l'Admin SDK.
- Appels `/api/admin` en **même origine** (le projet admin héberge son API) : pas de CORS.
- À faire : ajouter le **domaine du projet admin** dans Firebase → Authentication →
  Authorized domains, et y définir les variables d'environnement.

---


## Session 3 — Panneau d'administration

Nouveau back-office `admin/admin.html` (réservé aux admins, rôle vérifié serveur).

### Nouveaux endpoints
- `api/admin.js` (admin only) : `stats`, CRUD secrets (`db_sirr_*`), documents
  (`almaqtab`), produits (`det_produits`), gestion vendeurs (`sellers` : +30 j /
  suspendre / activer), `list-orders`, `list-activity`, `list-geomancie`.
- `api/track.js` (auth) : journalise visites (`analytics/visits/{date}/{uid}`),
  fil d'activité (`activity_feed`) et usage géomancie + localisation (`geomancie_logs`).
- `api/_lib/access.js` : ajout de `isAdmin(user)` (super-admin OU `admins/{clé}`).

### Collecte (légère)
- `js/firebase-config.js` : envoie une « visite » à `/api/track` une fois par page.
- `geomancie/tourab.html` : après un calcul, log best-effort de la position GPS.

### Interface admin (`admin/admin.html` + `admin.js` + `admin.css`)
Onglets : Tableau de bord (visites jour/semaine/mois + graphe 14 j + totaux),
Secrets, Documents, Marché, Boutiques, Commandes, Activité, Géomancie (avec
localisation et lien Google Maps).

### Règles RTDB
Ajout de `analytics`, `activity_feed` (+`.indexOn:["at"]`), `geomancie_logs`
(+`.indexOn:["at"]`) en **serveur uniquement**, et `admins/{cléEmail}` lisible par
son propriétaire (pour que le gate client reconnaisse aussi les admins non super-admin).

### Confidentialité
La géomancie capture la position **au mieux** (consentement GPS). Informez vos
utilisateurs et prévoyez une purge périodique des logs.

---


## Session 2 — Boutique vendeur, gating affiné, lecteur asrar

### Géomancie — paywall au CLIC sur « Calculer l'Écu »
`geomancie/tourab.html` ne demande plus l'abonnement à l'ouverture : aucune
donnée premium n'est chargée au démarrage. Le portail PayDunya n'apparaît qu'au
**clic sur « Calculer l'Écu »** (via `ensureAccess`), et les données (`get-theme`)
ne sont récupérées qu'à ce moment-là.

### Marché — achat SANS abonnement (prix du produit)
La fiche produit et l'achat ne dépendent plus de l'abonnement au contenu :
- `api/_lib/sources.js` : le type `product` est `authOnly` (auth seule).
- `api/get-content.js` : ne vérifie `hasActiveAccess` que si la source n'est pas `authOnly`.
- `marche/marche.js` : le clic produit ouvre directement la fiche (plus de `ensureAccess`).
- L'achat reste géré par `/api/create-order` (prix vendeur + commission admin 5 %).

### Boutique vendeur (NOUVEAU sous-système)
Demande de boutique payante puis gestion de la boutique et des produits.
- **Abonnements boutique** (`api/_lib/plans.js`) : `boutique_1m` (10 000 / 30 j),
  `boutique_3m` (25 000 / 90 j), type `shop`. Un compte Google = un vendeur unique (clé = uid).
- `api/create-invoice.js` : pour un plan `shop`, tague `custom_data.kind='shop'` et
  renvoie sur `boutique/boutique.html`.
- **Nouveau** `api/_lib/sellers.js` : `grantSeller` (active/prolonge `sellers/{uid}`),
  `isActiveSeller`, `getSeller`.
- **Nouveau** `api/shop.js` (endpoint multiplexé) : `me`, `save-shop`, `save-product`,
  `delete-product`. Écritures réservées au serveur ; un vendeur ne gère QUE ses produits
  (uid imposé côté serveur). Les produits vont dans `det_produits` (nœud du Marché).
- `api/confirm-invoice.js` & `api/paydunya-ipn.js` : 3e branche `kind==='shop'` → `grantSeller`.
- **Nouveau** `boutique/boutique.html` + `boutique.js` + `boutique.css` : paiement,
  édition de la fiche boutique, CRUD produits (nom, prix, devise, image, description,
  WhatsApp, catégorie). Lien « 🏪 Ma boutique » ajouté dans `marche/marche.html`.
- `rules/purchases.rules.json` : nœud `sellers/{uid}` (lecture propriétaire) +
  `.indexOn:["uid"]` sur `det_produits` (requête des produits du vendeur).

### Secrets (asrar) — lecteur plein écran, redimensionnable, zoom
Le secret et les images n'étaient plus à l'étroit dans la carte :
- `asrar/asrar.html` : lecteur plein écran (`#secretReader`) + bouton « ⛶ Plein écran ».
- `asrar/asrar.css` : le lecteur prend **tout l'espace du device** ; sur grand écran,
  fenêtre **redimensionnable** (poignée `resize`) ; le rail des catégories se masque en
  mode détail (carte pleine largeur).
- `asrar/asrar.js` : ouverture auto du lecteur à l'ouverture d'un secret, boutons
  **A− / A+** (taille du texte mémorisée), image cliquable pour zoom plein écran.

### Planète — clarté du jour planétaire
`planete/planete.html` implémentait déjà la **géolocalisation GPS** (pas réseau), la
règle « on ne change pas de jour tant que l'heure locale n'a pas dépassé le lever du
soleil », et la **nature des heures** (Soleil/Lune favorable, Vénus/Jupiter très
favorable, Mars/Saturne défavorable, Mercure 30 min favorable / 30 min défavorable).
Ajout : le jour planétaire affiche « (nuit, avant le lever) » tant qu'on est avant le
lever, pour lever toute ambiguïté avec le jour du calendrier.

---

## Session 1 — Intégration paiement & corrections initiales

Récapitulatif des modifications apportées au hub. Tous les fichiers JS livrés
passent `node --check` ; `rules/purchases.rules.json` est un JSON valide.

---

## 1. Al-Qalam (`alqalam/`) — intégration cassée → réparée

**Symptômes :** la sous-app ne démarrait pas et le paywall ne fonctionnait pas.

- `main.js`
  - **2 erreurs de syntaxe corrigées** : `if (actionFn) actionFn actionFn();` et
    un bloc « Mode Rasm » dupliqué/tronqué (`if (e.target Rasm — protégé`) qui
    empêchait tout le module de se charger.
  - **Pont vers le système global réécrit.** L'ancien code attendait
    `window.currentUser` / `window.checkSubscription` / `window.showPaywall` /
    `window.createCheckout` (jamais exposés) et interrogeait Firebase en SDK
    **modulaire** alors que le hub tourne en **compat** → l'utilisateur connecté
    était invisible et le gate se fermait pour tout le monde. Désormais : accès =
    abonnement ASRAR PRO actif via `checkAccess()` global (repli sur lecture de
    `purchased_user`), et le paywall ouvre le **portail global** (`showSubscriptionGate`,
    offres réelles).
  - **`productId` fantôme supprimé** : on vendait `alqalam_premium`, absent de
    `plans.js` (→ HTTP 400). Remplacé par les vrais plans (défaut `sub_1y`).
- `firebase_db.js` : utilise l'**app Firebase compat globale** (`firebase.database()`)
  au lieu de créer une app modulaire « alqalam-app » séparée → fin des conflits
  d'initialisation nommée, une seule session d'auth.
- `index.html` : charge le **SDK compat + `firebase-config.js` + `api-content.js`**
  (scripts classiques) comme les pages du hub ; ordre des scripts corrigé ; style
  inline malformé (`color: var-size: …`) corrigé.

*(Inchangés : `config.js`, `store.js`, `ui_tools.js`, `pdf.js`, `formatter.js`, `style.css`.)*

## 2. `js/paydunya-client.js` — contrat serveur respecté

`createInvoice` / `createCheckout` envoyaient `{ buyerId, productId, email }`
**sans `idToken`** → 401. Désormais ils récupèrent l'`idToken` Firebase et
envoient `{ idToken, productId }`, conformément à `/api/create-invoice`.
`confirmFromReturn()` inchangé.

## 3. Géomancie (`geomancie/`) — réservée aux abonnés

- `api/get-theme.js` : la vérification `hasActiveAccess` est désormais **active**
  (était commentée) → `403 Abonnement requis` pour les non-abonnés.
- `geomancie/tourab.html` : sur un `403`, la page ouvre le **portail PayDunya**
  (`showSubscriptionGate`) au lieu d'un simple toast d'erreur ; sur `401`, retour
  à la connexion.

## 4. Marché (`marche/`) — paiement réel + commission 5 %

**Avant :** `payWithPayDunya()` n'était qu'un `alert()` (paiement non branché).

- **Nouveau** `api/create-order.js` : reçoit `{ idToken, items:[{key,quantity}] }`,
  relit les prix dans `det_produits` (le client ne fixe jamais le montant), crée la
  facture PayDunya, enregistre la commande.
- **Nouveau** `api/_lib/orders.js` : calcule total + **commission admin 5 %** +
  **reversement vendeur 95 %** (ventilés par vendeur) ; `markOrderPaid()` idempotent
  + journal `vendor_sales`.
- `marche/marche.js` : `payWithPayDunya()` appelle `create-order` et redirige ;
  confirmation au retour (`?token=`) qui vide le panier ; livraison **fictive
  (1000 FCFA) mise à 0** pour que l'affichage = le montant débité.
- `api/confirm-invoice.js` **et** `api/paydunya-ipn.js` : **aiguillage** selon
  `custom_data.kind` — `"order"` → `markOrderPaid`, sinon → `grantAccess`
  (abonnement, comportement inchangé).
- `rules/purchases.rules.json` : ajout de `orders/{uid}` (lecture propriétaire) et
  `vendor_sales` (serveur uniquement).

---

## Décisions / limites assumées

- **Pas de split automatique PayDunya** : 100 % arrive sur le compte plateforme ;
  les 95 % vendeurs sont **journalisés** pour règlement (voir README §7).
- **Navigation Marché inchangée** : voir le **détail** d'un produit (description +
  contact vendeur, via `get-content`) reste réservé aux abonnés. Seul l'**achat**
  n'exige pas d'abonnement. À ajuster si vous voulez la fiche produit en accès libre.
- **Retour d'abonnement** : `return_url` de `create-invoice` pointe (côté serveur)
  vers `accueil/accueil.html`. Après un paiement d'abonnement lancé depuis une
  sous-page, l'utilisateur revient à l'accueil (l'IPN débloque quand même l'accès).
  Le retour du **Marché**, lui, pointe bien vers `marche/marche.html`.
