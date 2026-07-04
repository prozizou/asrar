# Marché Mystique — produits & checkout

Marketplace de produits ésotériques. **Modèle de paiement distinct de
l'abonnement** : l'acheteur paie le **prix du vendeur** ; l'administration retient
**5 % du total**, 95 % reviennent au vendeur.

## Fichiers
- `marche.html` — page (charge le socle Firebase compat + `api-content.js`).
- `marche.js` — grille produits, fiches, **panier**, et **checkout** réel.
- `marche.css` — styles.

## Parcours d'achat
1. Grille via `apiPost('list-content', { kind:'product' })` (aperçu, auth seule).
2. Fiche produit via `apiPost('get-content', { kind:'product', key })`
   (description + contact vendeur : **auth seule, PAS d'abonnement** — `authOnly`).
3. Panier (clé, quantité) en `localStorage`.
4. `payWithPayDunya()` → `apiPost('create-order', { items:[{key,quantity}] })`.
   Le client n'envoie **que** des clés + quantités ; les prix sont **relus
   serveur** dans `det_produits` (anti-fraude). Redirection vers PayDunya.
5. Retour `marche.html?token=…` → `/api/confirm-invoice` : panier vidé, commande
   marquée `paid`. L'IPN confirme aussi en parallèle.

## Commission (5 %)
Calcul dans `api/_lib/orders.js` :
- `total` = Σ (prix × quantité) ;
- `commission` = `round(total × 0,05)` → administration ;
- `sellerPayout` = `total − commission` → vendeur (ventilé par vendeur).

Stockage : `orders/{uid}/{orderId}` (commande) et `vendor_sales/{vendorId}/{orderId}`
(journal pour règlement).

## Notes
- **Pas de split automatique** : tout arrive sur le compte plateforme ; les
  reversements vendeurs se font à partir de `vendor_sales`.
- **Livraison** : la livraison « fictive » a été mise à 0 (affichage = montant
  débité). Pour une livraison réelle, l'ajouter côté serveur dans le calcul du
  total (sinon elle ne serait pas facturée).
- Schéma produit attendu dans `det_produits/{key}` : `produit`, `Prix`, `devise`,
  `Image`, `vendeur`, `uid`/`vendeurId`, et (sensibles) `description`, `number`,
  `email`.

## Vendre sur le Marché
Les produits proviennent de `det_produits`, alimentés par les vendeurs depuis
`boutique/` (abonnement boutique). Voir `boutique/README.md`. Un lien « 🏪 Ma boutique »
figure en haut de `marche.html`.
