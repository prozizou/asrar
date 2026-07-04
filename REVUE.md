# Revue & corrections — ASRAR PRO (refonte asrar/marche)

## 🔴 Critique — corrigé
1. **`asrar.js` et `marche.js` court-circuitaient l'API.**
   Lecture directe de `db_sirr_*` / `det_produits` (en `.read:false` dans les règles)
   → pages cassées si règles déployées, paywall rouvert sinon.
   - `asrar.js` : liste via `/api/list-content`, détail (avec `sirr`) via `/api/get-content`.
   - `marche.js` : grille via `/api/list-content` ; description + contacts vendeur
     (`number`, `email`) via `/api/get-content` (réservé aux abonnés, vérifié serveur).
   - Ajout de `js/api-content.js` dans `asrar.html` et `marche.html` (il manquait).

2. **Nœuds `comments/` et `ratings/` sans règles.**
   Ajout dans `rules/purchases.rules.json` :
   - `ratings/$cat/$key/$uid` : écriture par le seul propriétaire (uid), valeur 1–5.
   - `comments/$cat/$key/$id` : création seule (pas d'édition/suppression),
     `uid === auth.uid`, texte non vide ≤ 500 caractères.
   - `appData` : lecture connecté (pour le zodiaque d'Istihraj).

## 🟠 Bugs nets — corrigés
3. **`planete.html`** : l'heure planétaire entre minuit et le lever affichait le
   régent du mauvais jour. Le régent est désormais celui de la veille (la journée
   planétaire commence au lever du Soleil, pas à minuit).
4. **`asrar.js`** : les écouteurs temps réel (commentaires + moyenne des notes)
   n'étaient pas détachés correctement (fuite à chaque changement de secret/catégorie).
   Détachement via références mémorisées.
5. **`chiffre.html`** : si `appData/zodiacs` ne contenait que `name`/`icon`,
   l'Élément et la Planète s'affichaient « undefined ». Fusion avec la table par défaut.

## 🟡 Recommandations (non bloquantes, non modifiées)
- **`planete.html`** dépend de 3 API externes (`ipapi.co`, `bigdatacloud`,
  `sunrise-sunset.org`). Le calcul NOAA hors-ligne (présent dans `js/main.js` :
  `sunEvents`) évite latence, pannes et envoi de la position à des tiers.
- **`marche.js` `payWithPayDunya()`** : encore un `alert()` (paiement multi-vendeur
  à brancher sur `/api/create-invoice`).
- **`abajad.html`** : le comparateur n'est pas protégé par l'abonnement ;
  les paires de facteurs incluent les triviales `1×N` et `N×1`.
- `.gitignore` et `.env.example` avaient disparu de l'archive — restaurés.
