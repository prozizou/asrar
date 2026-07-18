# Marché Mystique — produits & commande

Marketplace de produits ésotériques. **Modèle distinct de l'abonnement** :
l'acheteur contacte le vendeur/l'administration pour finaliser l'achat.

> **Paiement en ligne retiré.** La commande n'est plus payée via PayDunya : elle
> est transmise **par WhatsApp** (récapitulatif du panier), puis traitée
> manuellement. Il n'y a plus d'endpoint `create-order` ni de calcul de
> commission côté serveur.

## Fichiers
- `marche.html` — page (charge le socle Firebase compat + `api-content.js`).
- `marche.js` — grille produits, fiches, **panier**, et **envoi de la commande**.
- `marche.css` — styles.

## Parcours d'achat
1. Grille via `apiPost('list-content', { kind:'product' })` (aperçu, auth seule).
2. Fiche produit via `apiPost('get-content', { kind:'product', key })`
   (description + contact vendeur : **auth seule, PAS d'abonnement** — `authOnly`).
3. Panier (clé, quantité) en `localStorage`.
4. Validation → `window.ASRAR_WA.openOrder({ email, items, total, devise })` :
   construit un message récapitulatif (articles, quantités, total) et ouvre
   **`/api/wa`**, qui redirige vers WhatsApp avec le numéro stocké côté serveur.
5. La disponibilité, le prix et les modalités sont confirmés **par WhatsApp** ;
   l'administration/le vendeur finalise hors ligne.

## Notes
- Les prix affichés viennent de `det_produits/{key}` (`Prix`, `devise`) ; le total
  est calculé côté client uniquement pour enrichir le message WhatsApp.
- Schéma produit attendu dans `det_produits/{key}` : `produit`, `Prix`, `devise`,
  `Image`, `vendeur`, `uid`/`vendeurId`, et (sensibles) `description`, `number`,
  `email`.

## Vendre sur le Marché
Les produits proviennent de `det_produits`, alimentés par les vendeurs depuis
`boutique/` (statut vendeur actif). Voir `boutique/README.md`. Un lien
« 🏪 Ma boutique » figure en haut de `marche.html`.
