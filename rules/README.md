# Règles Firebase Realtime Database — `database.rules.json`

## ⚠️ Statut : reconstitution documentaire, PAS déployée automatiquement

Ce fichier **n'existait pas dans le dépôt** avant une première revue (voir
`ANALYSE.md`, faiblesse « règles Firebase RTDB absentes du dépôt ») : les
règles réelles ne vivaient que dans la console Firebase, sans trace
versionnée ni revue possible en pull request.

`database.rules.json` a été **reconstitué à partir de tout ce que le code
référence** (chaque `db.ref(...)` / `ref(db, ...)` du dépôt, côté client et
serveur — voir la méthode ci-dessous) : c'est une **base de travail**, pas
une garantie que ce soit exactement ce qui est actuellement déployé sur le
projet Firebase de production. **Personne dans cette revue n'a accès à la
console Firebase** — la comparaison avec les règles réellement actives reste
une étape humaine, non automatisable ici.

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

## Mise à jour 2026-09-02 : resserrement suite à la migration vers l'Admin SDK

La reconstitution initiale listait 6 groupes de nœuds lus/écrits
directement par le client. Une relecture du code **actuel** montre que 3 de
ces 6 groupes ont depuis migré vers des API HTTPS server-side (Admin SDK,
qui contourne totalement ces règles) — pour la même raison à chaque fois
(commentaires du code : un WebSocket RTDB direct depuis le navigateur reste
bloqué en silence sur certains réseaux/pare-feu d'entreprise) — **sans que
les règles ci-dessous aient été resserrées en conséquence** :

| Nœud | Ancien état (reconstitution initiale) | État actuel du code |
|---|---|---|
| `purchased_user`, `allowedUsers`, `admins`, `vip_users` | lu directement par `lib/access.js` | migré vers `/api/check-access` (`server/access.js`) — plus aucun `ref(db,...)` sur ces nœuds côté client |
| `ratings`, `comments` | lus/écrits directement par `useSecretRealtime`/`useProductSocial` | les deux délèguent à `lib/socialClient.js`, qui passe par `/api/social` |
| `orders_count` | lu par `app/page.js` | seuls `pages/api/social.js`, `shop.js`, `wa.js` (Admin SDK) y touchent désormais |

Conséquence concrète de ne pas avoir resserré : si les règles déployées en
production reflétaient encore l'ancienne reconstitution (ou l'ancien
comportement pré-migration), un utilisateur authentifié pouvait :
- lire le statut d'accès (`purchased_user`/`allowedUsers`/`admins`) de
  n'importe quel autre utilisateur — une fuite que le README d'origine
  documentait déjà comme un compromis assumé (voir plus bas), mais qui ne
  sert plus l'app elle-même puisque plus aucun code client n'en a besoin ;
- écrire directement dans `ratings`/`comments` via le SDK RTDB, en
  contournant le rate limiting de `/api/social` (`lib/rateLimit.js` ne
  s'applique qu'au chemin HTTPS, pas à une écriture RTDB directe qui ne
  respecte que la `.validate` de longueur/note).

**`database.rules.json` a donc été resserré** pour ne plus refléter que ce
qui est *effectivement* lu directement par le client aujourd'hui (voir
tableau « Méthode de reconstitution » ci-dessous, mis à jour). Les groupes
`purchased_user`/`allowedUsers`/`admins`/`vip_users`, `ratings`/`comments`
et `orders_count` sont retirés — protégés par le `.read`/`.write: false`
racine, comme tout nœud Admin-SDK-only.

**Ce resserrement n'est qu'un fichier versionné, pas un déploiement** : tant
que l'étape 1 de la section précédente (comparer avec la console Firebase)
n'a pas été faite par un humain, on ne sait pas si la production est
aujourd'hui plus permissive que ce fichier — donc potentiellement toujours
exposée aux deux points ci-dessus.

## Méthode de reconstitution

L'app suit un principe strict, rappelé dans plusieurs fichiers serveur
(`server/access.js`, `pages/api/get-content.js`…) : **tout le contenu
sensible et toutes les écritures d'état passent par l'Admin SDK**
(`pages/api/*.js` + `server/*.js`), qui **contourne totalement** ces règles.
Les règles ci-dessous ne concernent donc que les **nœuds lus DIRECTEMENT par
le client** (SDK Firebase modulaire, `firebase/database` importé dans
`lib/`) — vérifié en listant tous les imports de `db` depuis
`lib/firebase.js` dans tout le dépôt (seuls trois fichiers l'importent) :

| Nœud | Client fait | Fichier(s) |
|---|---|---|
| `sourate`, `versetRef` | lecture (cache Coran) | `lib/alqalam.js`, `lib/rouwhania.js` |
| `data/appData/asmaUlHusna` | lecture (99 Noms, repli après cache + `/api/list-content`) | `lib/benefits.js` |

Tout le reste (`purchased_user`, `allowedUsers`, `admins`, `vip_users`,
`ratings`, `comments`, `orders_count`, `det_produits`, `db_sirr_*`,
`almaqtab`, `sellers`, `orders`, `activity_feed`, `geomancie_logs`,
`book_likes`, `book_comments`, `referrals`, `referred`, `purchases`,
`views`, `analytics`, `zikr_groups`, `zikr_members`, `zikr_requests`…)
n'est **jamais** lu ni écrit directement par le client dans ce dépôt — d'où
le `.read`/`.write: false` par défaut à la racine : tout nœud non listé
explicitement est fermé au client, sans affecter l'Admin SDK.

## Points à vérifier humainement (pas garantis par la seule lecture du code)

- **Comparer avec la console Firebase** (voir section « Mise à jour »
  ci-dessus) : ce fichier ne peut être vérifié que par quelqu'un ayant accès
  à la console du projet — aucun outil de cette revue ne peut le faire.
- Si les nœuds `purchased_user`/`allowedUsers`/`admins`/`ratings`/`comments`/
  `orders_count` sont encore ouverts en production (héritage de l'ancien
  comportement), il faut les resserrer là-bas aussi, pas seulement dans ce
  fichier — un fichier versionné non déployé ne protège rien par lui-même.
- `ratings`/`comments` (si jamais rouverts un jour pour un besoin futur) :
  la validation (`text` non vide, ≤ 500 caractères, note 1–5) ne couvre
  toujours pas le **débit** d'écriture (spam) — voir `lib/rateLimit.js`
  côté serveur, qui ne couvrirait pas une écriture RTDB directe.
