# Règles Firebase Realtime Database — `database.rules.json`

## ⚠️ Statut : reconstitution documentaire, PAS déployée automatiquement

Ce fichier **n'existait pas dans le dépôt** avant cette revue (voir
`ANALYSE.md`, faiblesse « règles Firebase RTDB absentes du dépôt ») : les
règles réelles ne vivaient que dans la console Firebase, sans trace
versionnée ni revue possible en pull request.

`database.rules.json` a été **reconstitué à partir de tout ce que le code
référence** (chaque `db.ref(...)` / `ref(db, ...)` du dépôt, côté client et
serveur — voir la méthode ci-dessous) : c'est une **base de travail**, pas
une garantie que ce soit exactement ce qui est actuellement déployé sur le
projet Firebase de production.

**Avant tout déploiement :**
1. Comparer avec les règles actuellement actives dans la console Firebase
   (Realtime Database → Règles) — copier-coller l'existant ici si besoin,
   pour que ce fichier devienne la source de vérité versionnée.
2. Tester avec l'émulateur (`firebase emulator:start` +
   `@firebase/rules-unit-testing`) ou le simulateur de règles de la console
   avant de déployer en production.
3. Déployer avec `firebase deploy --only database` (nécessite un
   `firebase.json` pointant vers ce fichier — pas encore présent dans ce
   dépôt, à ajouter en même temps que la validation ci-dessus).

## Méthode de reconstitution

L'app suit un principe strict, rappelé dans plusieurs fichiers serveur
(`server/access.js`, `pages/api/get-content.js`…) : **tout le contenu
sensible et toutes les écritures d'état passent par l'Admin SDK**
(`pages/api/*.js` + `server/*.js`), qui **contourne totalement** ces règles.
Les règles ci-dessous ne concernent donc que les **quelques nœuds lus ou
écrits DIRECTEMENT par le client** (SDK Firebase modulaire, `firebase/database`
importé dans `lib/`, `components/`, `app/`) :

| Nœud | Client fait | Fichier(s) |
|---|---|---|
| `purchased_user/{clé}`, `allowedUsers/{clé}`, `admins/{clé}`, `vip_users/{uid}` | lecture (statut d'accès, sa propre entrée) | `lib/access.js` |
| `sourate`, `versetRef` | lecture (cache Coran) | `lib/alqalam.js`, `lib/rouwhania.js` |
| `data/appData/asmaUlHusna` | lecture (99 Noms) | `lib/benefits.js`, `lib/rouwhania.js` |
| `orders_count` | lecture (popularité Marché) | `app/page.js` |
| `ratings/{cat}/{clé}/{uid}` | lecture (tout) + écriture (soi-même) | `components/useSecretRealtime.js`, `components/useProductSocial.js`, `app/page.js` (`ratings/vendor/…`) |
| `comments/{cat}/{clé}/{id}` | lecture (tout) + création seule (soi-même) | mêmes fichiers |

Tout le reste (`det_produits`, `db_sirr_*`, `almaqtab`, `sellers`,
`orders`, `activity_feed`, `geomancie_logs`, `book_likes`, `book_comments`,
`referrals`, `referred`, `purchases`, `views`, `analytics`,
`zikr_groups`, `zikr_members`, `zikr_requests`…) n'est **jamais**
lu ni écrit directement par le client dans ce dépôt — d'où le
`.read`/`.write: false` par défaut à la racine : tout nœud non listé
explicitement est fermé au client, sans affecter l'Admin SDK.

> Note : le Zikr collectif (`zikr_*`, via `pages/api/zikr.js`) suit la même
> direction que les correctifs récents `check-access`/`social` — **tout passe
> par l'Admin SDK en HTTPS**, aucun accès RTDB client direct. Ces nœuds sont
> donc protégés par le `false` racine, sans règle explicite à ajouter.

## Points à vérifier humainement (pas garantis par la seule lecture du code)

- **`purchased_user`/`allowedUsers`/`admins`** : une première version de ces
  règles restreignait la lecture à `$key === auth.token.email.replace('.',
  ',')` (empêcher un utilisateur de lire le statut d'accès d'un autre). Cette
  restriction a été **retirée** — le langage de règles Firebase RTDB ne
  documente pas clairement si `String.replace()` remplace la première
  occurrence ou toutes (contrairement au `.replace(/\./g, ',')` — global —
  utilisé côté client dans `emailToKey()`), et un e-mail avec plus d'un point
  (`prenom.nom@gmail.com`, très courant) aurait alors produit une clé
  différente côté règle et côté client, refusant l'accès en lecture à
  `checkAccess()` (`lib/access.js`) — appelée à **chaque** clic sur un
  élément gaté par le paywall. Autrement dit : une règle censée protéger la
  vie privée aurait pu casser l'ouverture du contenu pour une partie des
  utilisateurs. Le compromis retenu ici (`auth != null`, comme avant) accepte
  qu'un utilisateur connecté puisse lire le statut d'accès d'un autre (fuite
  mineure) plutôt que de risquer de bloquer des abonnés payants. Si vous
  voulez restaurer la restriction par clé, testez d'abord `.replace()` dans
  le simulateur de règles Firebase avec un e-mail à plusieurs points avant de
  déployer.
- `admins/{clé}` : accès en lecture ouvert à tout utilisateur connecté (voir
  ci-dessus) — un utilisateur authentifié peut donc voir qui d'autre est
  admin. Compromis identique, mêmes raisons.
- `ratings`/`comments` : la validation (`text` non vide, ≤ 500 caractères,
  note 1–5) reprend `REVUE.md` — pas de garde-fou ici sur le **débit**
  d'écriture (spam de likes/commentaires) : voir `lib/rateLimit.js` côté
  serveur, qui ne couvre pas ces écritures client directes.
