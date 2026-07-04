# Règles Realtime Database — à FUSIONNER

`purchases.rules.json` n'est **pas** un jeu de règles complet à déployer tel quel :
c'est l'ensemble des nœuds gérés par ce projet, **à fusionner** dans vos règles
RTDB existantes (console Firebase → *Realtime Database → Rules*).

## Principe
- Le **contenu payant** est en lecture/écriture **refusées au client**
  (`db_sirr_*`, `almaqtab`, `det_produits`, `theme_fondamental`). Il est servi
  uniquement par les fonctions `/api` via l'Admin SDK (qui **contourne** ces
  règles). Le paywall n'est donc plus contournable côté navigateur.
- Les **droits d'achat** sont en **lecture par le seul propriétaire**, **écriture
  serveur uniquement** :
  - `purchased_user/{cléEmail}` (abonnement) — lu si `auth.token.email` (avec
    `.`→`,`) === la clé.
  - `purchases/{uid}` (reçus d'abonnement).
  - `orders/{uid}` (commandes Marché).
  - `vendor_sales` (journal des ventes) — **serveur uniquement**, même en lecture.
- Données sociales **non payantes** : `appData` (lecture connecté), `ratings`
  (note 1–5 par le propriétaire), `comments` (création seule, ≤ 500 caractères).

## Rappels importants
- La clé e-mail remplace **tous** les points par des virgules. En **règles RTDB**,
  `String.replace('.', ',')` remplace **toutes** les occurrences (différent de JS),
  ce qui correspond bien au `.replace(/\\./g, ',')` du serveur. Cohérent.
- Les écritures via la **console Firebase** ou un **script Admin SDK** contournent
  ces règles : c'est le canal prévu pour publier du contenu (secrets, livres,
  produits, géomancie).
- Après modification, **publier** les règles et tester avec un compte non-admin.
