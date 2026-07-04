# Ma Boutique — vendeur (abonnement + gestion)

Permet à un utilisateur de **demander une boutique** (payante), puis de **gérer
sa boutique et ses produits**. Distinct de l'abonnement au contenu.

## Principe
- **Un compte Google = un vendeur unique** (clé interne = `uid`).
- Pour vendre, il faut un **abonnement boutique** actif :
  - `boutique_1m` — 1 mois — 10 000 FCFA
  - `boutique_3m` — 3 mois — 25 000 FCFA
- Une fois payé, le vendeur peut créer/modifier sa boutique (nom, description,
  WhatsApp) et **ajouter / modifier / supprimer** ses produits (nom, prix, devise,
  image, description, contact, catégorie).

## Fichiers
- `boutique.html` — page (socle Firebase compat + `api-content.js`).
- `boutique.js` — paiement (`startSubscription`), retour PayDunya, et CRUD via `/api/shop`.
- `boutique.css` — styles.

## Flux
1. `requireAuth` → `apiPost('shop', { action:'me' })`.
2. **Pas vendeur actif** → cartes d'offres `boutique_1m` / `boutique_3m` →
   `startSubscription(planId)` → PayDunya. Au retour (`?token=`), `confirm-invoice`
   active `sellers/{uid}` (via `grantSeller`).
3. **Vendeur actif** → édition boutique (`save-shop`) + produits
   (`save-product` / `delete-product`).

## Sécurité
- Toutes les écritures passent par `/api/shop` (Admin SDK). Le client n'impose
  jamais `uid` / `vendeur` / `email` : ils viennent du **jeton vérifié** côté serveur.
- Un vendeur ne peut modifier/supprimer **que ses propres** produits
  (`det_produits/{key}.uid === auth.uid`, vérifié serveur).
- `sellers/{uid}` : lisible par le propriétaire, écriture serveur uniquement
  (paiement + `/api/shop`).

## Données
- `sellers/{uid}` = `{ email, shopActive, plan, expiresAt, shop:{ name, description, phone }, ... }`
- Produits dans `det_produits/{key}` = `{ produit, Prix, devise, Image, description,
  number, chain, email, uid, vendeur, updatedAt }` — partagés avec le Marché.
