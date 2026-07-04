# ASRAR PRO — Authentification Google + accès par abonnement

Site statique + fonctions Vercel (`/api`). RTDB Firebase.

## Flux
1. **`index.html`** — connexion **Google uniquement** (sign-up + sign-in unifiés).
   Connecté → `accueil/accueil.html`.
2. Les pages se chargent librement (`requireAuth`). Le **portail PayDunya
   n'apparaît qu'au clic** sur un élément protégé, via `ensureAccess()` :
   - asrar → ouverture d'un manuscrit ; bibliotheque → ouverture d'un livre ;
     marche → ouverture d'un produit ; abajad → calcul ; chiffre → « Extraire ».
   - Abonné → l'action s'exécute ; sinon → overlay des 4 offres (fermable).
3. `checkAccess()` lit **`purchased_user/{cléEmail}`** : accès si l'entrée existe
   **avec `token`**.
4. Paiement → retour sur `accueil` (`?token=...`) → confirmation serveur →
   écriture `purchased_user/{cléEmail}` → débloqué.

`cléEmail` = email avec `.` remplacé par `,`.

> **Test local** : Live Server (`127.0.0.1:5500`) ne sert que les fichiers
> statiques → `/api/*` renvoie **405**. Utilise **`vercel dev`** (sert le site +
> les fonctions), ou teste sur l'URL Vercel déployée.

## Pages
- Auth : `index.html` (Google). `auth/auth.html` redirige vers `index.html`.
- Protégées par abonnement (`requireAccess`) : accueil, asrar, abajad, chiffre,
  planete, bibliotheque, marche.

## Offres (prix fixés serveur — `api/_lib/plans.js`)
| productId | offre | montant |
|-----------|-------|---------|
| sub_3m   | 3 Mois        | 15 000 FCFA |
| sub_6m   | 6 Mois        | 25 000 FCFA |
| sub_1y   | 1 An          | 45 000 FCFA |
| sub_life | Premium à vie | 100 000 FCFA |

> Pour l'instant l'accès dépend **uniquement de la présence du token**. La date
> `expiresAt` est déjà enregistrée : pour activer l'expiration, dé-commenter le
> bloc `notExpired` dans `checkAccess()` (`js/firebase-config.js`).

## Déploiement (Vercel)
1. Déposer le dossier (ou `git push`).
2. Activer **Google** comme fournisseur dans Firebase → Authentication → Sign-in
   method, et ajouter ton domaine Vercel aux **domaines autorisés**.
3. Variables d'env (cf. `.env.example`) : clés PayDunya, `SITE_URL`,
   `FIREBASE_DB_URL=https://asrar-bc059.firebaseio.com`, `FIREBASE_SERVICE_ACCOUNT`.
4. **Redéployer**, puis déclarer l'IPN dans PayDunya :
   `https://<ton-site>/api/paydunya-ipn`.
5. Fusionner `rules/purchases.rules.json` dans les règles RTDB.

## Sécurité
- Prix décidés côté serveur ; le navigateur n'envoie qu'un `productId`.
- L'IPN reconfirme le paiement via l'API PayDunya (source de vérité).
- `purchased_user` : lecture par utilisateur connecté, écriture serveur uniquement.
