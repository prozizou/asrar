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
`referrals`, `referred`, `purchases`, `views`, `analytics`…) n'est **jamais**
lu ni écrit directement par le client dans ce dépôt — d'où le
`.read`/`.write: false` par défaut à la racine : tout nœud non listé
explicitement est fermé au client, sans affecter l'Admin SDK.

## Points à vérifier humainement (pas garantis par la seule lecture du code)

- `admins/{clé}` : la restriction de lecture à `$key === sa propre clé`
  empêche un utilisateur de lister les autres admins, mais suppose que
  `auth.token.email` correspond exactement à la casse utilisée par
  `emailToKey()` (`.` → `,`, pas de normalisation de casse) — à confirmer
  avec de vrais comptes Google.
- `ratings`/`comments` : la validation (`text` non vide, ≤ 500 caractères,
  note 1–5) reprend `REVUE.md` — pas de garde-fou ici sur le **débit**
  d'écriture (spam de likes/commentaires) : voir `lib/rateLimit.js` côté
  serveur, qui ne couvre pas ces écritures client directes.
