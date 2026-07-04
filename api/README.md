# API — Fonctions Vercel (`/api`)

Toutes les fonctions sont en Node 18+ (fetch natif). Routage par fichier :
`api/<nom>.js` → `POST /api/<nom>` (sauf `confirm-invoice` en `GET`).
Le body est du JSON. CORS géré par `_lib/http.js` (origine = `SITE_URL`).

L'identité est **toujours** dérivée de l'`idToken` Firebase vérifié serveur
(`_lib/access.js → verifyUser`). Le client ne fournit jamais d'e-mail/uid de
confiance.

---

## Paiement

### `POST /api/create-invoice` — Abonnement
Body : `{ idToken, productId }` où `productId ∈ {sub_3m, sub_6m, sub_1y, sub_life}`.
Le montant vient de `_lib/plans.js` (jamais du client).
→ `{ token, url }` (rediriger vers `url`).

### `POST /api/create-order` — Commande Marché
Body : `{ idToken, items: [{ key, quantity }] }`.
Les prix sont **relus serveur** dans `det_produits`. Commission admin = 5 % du
total ; 95 % au vendeur (ventilé). Crée la commande `orders/{uid}/{orderId}`.
→ `{ url, orderId, token, total, commission, sellerPayout, devise }`.

### `POST /api/create-invoice` — Abonnement contenu OU boutique
Body : `{ idToken, productId }`. Plans contenu `sub_*` ou plans boutique
`boutique_1m` / `boutique_3m`. Pour un plan boutique, `custom_data.kind='shop'`
et le retour pointe vers `boutique/boutique.html`.

### `GET /api/confirm-invoice?token=…` — Confirmation au retour
Reconfirme la facture (source de vérité). Idempotent. Aiguille selon
`custom_data.kind` : `"order"` → `markOrderPaid`, `"shop"` → `grantSeller`,
sinon → `grantAccess`.
→ `{ status, kind, productId?, orderId?, persisted }`.

### `POST /api/paydunya-ipn` — Callback serveur PayDunya
Reçoit la notification PayDunya, extrait le token (formats variés), reconfirme,
puis `markOrderPaid` (commande) ou `grantAccess` (abonnement). Renvoie `500` en
cas d'erreur pour déclencher une nouvelle tentative côté PayDunya.

---

## Contenu (protégé)

### `POST /api/list-content` — Aperçu d'une liste (auth seule)
Body : `{ idToken, kind, cat? }` où `kind ∈ {secret, book, product}`.
Renvoie les **métadonnées** SANS les champs sensibles (`_lib/sources.js`).
→ `{ items: [...] }`.

### `POST /api/get-content` — Élément complet
Body : `{ idToken, kind, cat?, key }`. Vérifie `hasActiveAccess` (→ `403`) SAUF si
la source est `authOnly` (cas du Marché : `product` → auth seule, pas d'abonnement).
→ `{ item }` (avec le champ payant : `sirr`, `pdf`, ou contact vendeur).

### `POST /api/shop` — Gestion boutique (vendeur)
Body : `{ idToken, action, ... }`. `action` ∈ `me` | `save-shop` | `save-product` |
`delete-product`. Toutes les écritures exigent un **vendeur actif** ; un vendeur ne
gère QUE ses produits (uid imposé serveur). Voir `boutique/README.md`.

---

## Administration

### `POST /api/admin` — Back-office (ADMIN only)
Body : `{ idToken, action, ... }`. Vérifie `isAdmin` (super-admin OU `admins/{clé}`)
→ `403` sinon. `action` ∈ `stats` | `list-secrets`/`save-secret`/`delete-secret` |
`list-books`/`save-book`/`delete-book` | `list-products`/`save-product`/`delete-product` |
`list-sellers`/`seller-action` | `list-orders` | `list-activity` | `list-geomancie`.

### `POST /api/track` — Journalisation (auth)
Body : `{ idToken, type, page?, lat?, lng?, city? }`. `type` ∈ `visit` | `geomancie` |
(générique). Alimente `analytics/visits`, `activity_feed`, `geomancie_logs`. Renvoie
toujours `200` (le tracking ne casse jamais l'expérience).

### `POST /api/get-theme` — Géomancie (ABONNÉS)
Body : `{ idToken }`. Vérifie `hasActiveAccess` → `403` sinon.
→ `{ data }` (tableau `theme_fondamental`).

---

## `_lib/` (modules internes)

| Fichier | Rôle |
|---|---|
| `access.js` | `verifyUser(idToken)` ; `hasActiveAccess(user)` — **la** barrière |
| `grant.js` | `grantAccess()` — active l'abonnement (`purchased_user` + `purchases`) ; init Firebase Admin partagée |
| `orders.js` | `buildOrder()` / `savePendingOrder()` / `markOrderPaid()` — Marché + commission 5 % |
| `sellers.js` | `grantSeller()` / `isActiveSeller()` / `getSeller()` — abonnement boutique |
| `access.js` | `verifyUser()` / `hasActiveAccess()` / `isAdmin()` |
| `plans.js` | Catalogue abonnements (prix + durée) |
| `paydunya.js` | `createInvoice()` / `confirmInvoice()` (API PayDunya) |
| `sources.js` | Liste blanche des nœuds + champs sensibles |
| `http.js` | `setCors()` + `parseBody()` |

---

## Codes d'erreur usuels
- `401` : jeton manquant/invalide → se reconnecter.
- `403` : authentifié mais **non abonné** → afficher le portail PayDunya.
- `400` : requête invalide (productId/kind inconnu, panier vide, prix invalide).
- `404` : élément/produit introuvable.
- `502` : erreur côté PayDunya.
