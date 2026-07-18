# ASRAR PRO — Authentification Google + accès par abonnement

Site statique + fonctions Vercel (`/api`). RTDB Firebase.

> **Paiement en ligne retiré.** L'ancien flux PayDunya a été remplacé par une
> **activation manuelle via WhatsApp** : l'utilisateur envoie une demande, puis
> l'administration active son accès à la main. Détails dans `DEPLOIEMENT_WHATSAPP.md`.

## Flux
1. **`index.html`** — connexion **Google uniquement** (sign-up + sign-in unifiés).
   Connecté → `accueil/accueil.html`.
2. Les pages se chargent librement (`requireAuth`). Le **portail d'offres
   n'apparaît qu'au clic** sur un élément protégé, via `ensureAccess()` :
   - asrar → ouverture d'un manuscrit ; bibliotheque → ouverture d'un livre ;
     marche → ouverture d'un produit ; abajad → calcul ; chiffre → « Extraire ».
   - Abonné → l'action s'exécute ; sinon → overlay des offres (fermable).
3. Au choix d'une offre → `startSubscription(planId)` → `window.ASRAR_WA.openAccess()`
   construit un message et ouvre **`/api/wa`**, qui redirige (302) vers WhatsApp
   avec le numéro stocké côté serveur (`WHATSAPP_NUMBER`). Le message inclut
   l'e-mail du compte et la formule souhaitée.
4. **L'administration active l'accès manuellement** après réception de la demande,
   via `/api/admin` (`grant-access {email, days?}` — `days` absent/0 = accès à vie).
   L'écriture se fait dans `purchased_user/{cléEmail}` / le nœud d'accès manuel.
5. `checkAccess()` lit l'accès de l'utilisateur : accès si une entrée active existe.

`cléEmail` = email avec `.` remplacé par `,`.

> **Test local** : Live Server (`127.0.0.1:5500`) ne sert que les fichiers
> statiques → `/api/*` renvoie **405**. Utilise **`vercel dev`** (sert le site +
> les fonctions), ou teste sur l'URL Vercel déployée.

## Pages
- Auth : `index.html` (Google). `auth/auth.html` redirige vers `index.html`.
- Protégées par abonnement (`requireAccess`) : accueil, asrar, abajad, chiffre,
  planete, bibliotheque, marche.

## Offres (catalogue rappelé dans `js/whatsapp.js`)
| planId | offre | montant |
|-----------|-------|---------|
| sub_3m   | 3 Mois        | 15 000 FCFA |
| sub_6m   | 6 Mois        | 25 000 FCFA |
| sub_1y   | 1 An          | 45 000 FCFA |
| boutique_1m | Boutique 1 Mois | 10 000 FCFA |
| boutique_3m | Boutique 3 Mois | 25 000 FCFA |

Les libellés/prix affichés dans le portail proviennent de `SUB_PLANS`
(`js/firebase-config.js`, `Benefits/access.js`). Le message WhatsApp est enrichi
depuis le catalogue `PLANS` de `js/whatsapp.js`.

> Pour l'instant l'accès dépend de la **présence d'une entrée active**. La date
> `expiresAt` est enregistrée par l'admin (`grant-access` avec `days`) ; l'accès à
> vie correspond à `days` absent/0.

## Déploiement (Vercel)
1. Déposer le dossier (ou `git push`).
2. Activer **Google** comme fournisseur dans Firebase → Authentication → Sign-in
   method, et ajouter ton domaine Vercel aux **domaines autorisés**.
3. Variables d'env : `WHATSAPP_NUMBER` (numéro international sans `+` ni espaces,
   ex. `221771234567`), `FIREBASE_DB_URL=https://asrar-bc059.firebaseio.com`,
   `FIREBASE_SERVICE_ACCOUNT`. (Les variables `PAYDUNYA_*` / `STORE_*` ne sont
   **plus** nécessaires.)
4. **Redéployer.**
5. Fusionner `rules/purchases.rules.json` dans les règles RTDB.

## Sécurité
- Le numéro WhatsApp n'est **jamais** dans le code client : il vient de
  `WHATSAPP_NUMBER` et `/api/wa` ajoute le message puis redirige (302).
- L'activation d'accès est faite par l'administration (Admin SDK, `/api/admin`) ;
  le client ne peut pas s'auto-activer.
- `purchased_user` : lecture par utilisateur connecté, écriture serveur uniquement.
