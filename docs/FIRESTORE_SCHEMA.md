# Schéma Firestore — migration depuis Realtime Database

> **Statut : Phases 0 à 2 de la migration RTDB → Firestore.** Ce document
> décrit la collection Firestore cible pour chaque nœud RTDB actuel — voir
> `scripts/migrate-to-firestore.js` pour l'import des données et
> `firestore.rules`/`firestore.indexes.json` pour les règles/index. Le
> paywall (`server/access.js`, Phase 1) et les commandes/parrainage/boutique
> (`orders.js`, `referral.js`, `shop.js`, `sellers.js`, `track.js`, `wa.js`,
> Phase 2) lisent et écrivent désormais Firestore. Les autres modules
> (contenu, social, Zikr collectif, reste) sont décrits en bas de ce document
> et migrent phase par phase.

## Principe

Chaque nœud RTDB devient **une collection Firestore**, avec si possible le
**même identifiant de document** que la clé RTDB d'origine (push-key,
email ou uid) — migration « telle quelle », pas de refonte du modèle de
données. On s'écarte de ce principe seulement dans 3 cas, justifiés
ci-dessous : nœuds imbriqués aplatis en collection plate, listes 2/3
niveaux consolidées en un document par item, et le Zikr collectif regroupé
en sous-collections.

**Contrainte dure : les identifiants de `products`, `secrets_*`, `books`,
`formations` et `zikr_groups` doivent rester identiques aux clés RTDB.**
Ces clés sont embarquées dans des liens de partage déjà diffusés
(`/s?k=...&i=<clé>`, voir `lib/share.js`/`pages/api/share.js`) — les
changer casserait tous les liens déjà envoyés (WhatsApp, réseaux sociaux,
imprimés). Les push-keys Firebase (`-Nxxxxxxxx...`) sont des identifiants
de document Firestore valides tels quels.

## Collections

### Accès / paywall

| Collection | ID document | Champs | Source RTDB |
|---|---|---|---|
| `access_purchases` | email (encodage `,` conservé, ex. `baaye012@gmail,com`) | `token, expiresAt, level, plan, source, uid, at, amount?, label?, grantedBy?, productId?` | `purchased_user/{emailKey}` |
| `access_allowed` | email (idem) | legacy : `true`/nombre, ou `{until, level}` | `allowedUsers/{emailKey}` |
| `access_admins` | email (idem) | `{value: true}` (existence = admin) | `admins/{emailKey}` |
| `access_vip` | uid | `{value: true}` (existence = VIP) | `vip_users/{uid}` |

`access_admins`/`access_allowed`/`access_vip` sont vides dans l'export
fourni (aucun enregistrement actuellement) — le script les crée quand même
si l'export en contient, sans erreur si absents.

### Boutique / commandes

| Collection | ID document | Champs | Source RTDB |
|---|---|---|---|
| `sellers` | uid | `{shopActive, expiresAt, shop:{name,description,phone,logo}}` | `sellers/{uid}` |
| `shop_profiles` | id (ex. `30527731273ca222`) | `{ID, createdAt, description, email, follow, imageId, profile_name?, number?, uid?}` | `profile_clients/{id}` |
| `products` | clé préservée | `{Image, Prix, chain, description, number, email, uid?, vendeurId?, updatedAt}` (voir `server/sources.js` pour les champs privés `number`/`email`) | `det_produits/{key}` |
| `orders` | id push-key préservé + champ `uid` ajouté | `{uid, productKey, produit, prix, devise, vendeur, image, at}` | `orders/{uid}/{id}` (nœud imbriqué aplati) |
| `order_counts` | productId | `{count: number}` | `orders_count/{productId}` (valeur brute → objet) |
| `product_views` | `${productKey}_${uid}` | `{productKey, uid, viewedAt}` | `views/product/{key}/{uid}` |

### Parrainage

| Collection | ID document | Champs | Source RTDB |
|---|---|---|---|
| `referral_codes` | code | `{uid}` | `referral_codes/{code}` (valeur brute string → objet) |
| `referrals` | uid | `{code, email, createdAt, points, invited?, lastAt?, clicks?, lastClickAt?, rewards?}` | `referrals/{uid}` |
| `referred` | uid (invité) | `{by, at, credited, reason?, points?}` | `referred/{uid}` |
| `referrals/{uid}/redemptions/{id}` (sous-collection) | id push-key | `{plan, source, points, at, expiresAt}` | `purchases/{uid}/{id}` |

### Contenu (secrets, livres, formations, versets, sourates)

| Collection | ID document | Source RTDB |
|---|---|---|
| `secrets_deblocage`, `secrets_domptage`, `secrets_ilham`, `secrets_ouverture`, `secrets_protection` | clé préservée | `db_sirr_{cat}/{key}` — une collection par catégorie, mécanique 1:1 |
| `books` | clé préservée | `almaqtab/{key}` |
| `formations` | clé préservée | `formations/{key}` |
| `verset_refs` | clé préservée | `versetRef/{key}` |
| `sourate` | clé préservée | `sourate/{key}` |
| `asma_ul_husna` | clé préservée | `data/appData/asmaUlHusna/{key}` (dénesté — plus de bucket `appData`) |
| `config/geomancie_theme_fondamental` (doc unique) | — | `theme_fondamental` (liste de 17 éléments, lue d'un bloc → champ `items[]`) |

### Social (avis, commentaires, favoris)

| Collection | ID document | Champs | Source RTDB |
|---|---|---|---|
| `likes` | `${cat}:${itemKey}` | `{cat, itemKey, uids: {uid: valeur}, count}` | `ratings/{cat}/{key}/{uid}` (3 niveaux → 1 doc par item avec map + compteur) |
| `comments` | id push-key | `{cat, itemKey, uid, email?, photo?, text, timestamp, stars?}` | `comments/{cat}/{key}/{id}` (3 niveaux → collection plate) |
| `book_likes` | bookKey | `{bookKey, uids: {uid:true}, count}` | `book_likes/{bookKey}/{uid}` |
| `book_comments` | id push-key + champ `bookKey` | `{bookKey, uid, name, text, at}` | `book_comments/{bookKey}/{id}` |
| `book_social_meta` | uid | `{lastComment}` | `book_social_meta/{uid}` |

`likes`/`book_likes` gardent la map `uids` (comme la RTDB) **et** ajoutent
`count` en champ dédié — évite de retélécharger toute la map pour un simple
comptage (`market-popularity`, `shop.js stats` en lisaient aujourd'hui
l'intégralité pour compter les clés).

### Zikr collectif

Regroupé en sous-collections sous le document du groupe plutôt qu'en 6
nœuds RTDB frères reliés seulement par convention de nommage — permet
notamment `collectionGroup("members").where("uid","==",me)` pour retrouver
« mes groupes » en une requête (le code actuel scanne tous les groupes +
2 lectures par groupe, voir audit).

| Chemin Firestore | ID document | Source RTDB |
|---|---|---|
| `zikr_groups/{gid}` | gid préservé | `zikr_groups/{gid}` |
| `zikr_groups/{gid}/members/{uid}` | uid | `zikr_members/{gid}/{uid}` |
| `zikr_groups/{gid}/requests/{uid}` | uid | `zikr_requests/{gid}/{uid}` |
| `zikr_groups/{gid}/wishes/{uid}` | uid (champ `amines` fusionné si présent) | `zikr_wishes/{gid}/{uid}` + `zikr_wish_amines/{gid}/{uid}/*` |
| `zikr_groups/{gid}/messages/{msgId}` | msgId push-key | `zikr_chat/{gid}/{msgId}` |

### Notifications / rappels / analytics

| Collection | ID document | Champs | Source RTDB |
|---|---|---|---|
| `push_subscriptions` | `${uid}_${subId}` | `{...subscription, uid}` | `push_subscriptions/{uid}/{subId}` |
| `reminder_settings` | uid | `{wirdEnabled, wirdHour, wirdMinute, tz, updatedAt, lastSentDate?, lastSentAt?}` | `reminder_settings/{uid}` |
| `analytics_visits` | `${date}_${uid}` | `{date, uid, n, last, email}` | `analytics/visits/{date}/{uid}` |
| `activity_feed` | id push-key | `{uid, email, type, page, at}` | `activity_feed/{id}` |
| `audit_log` | id push-key | `{action, at, by, target}` | `audit_log/{id}` |
| `trash` | id push-key | `{at, by, key, node, value}` | `trash/{id}` |
| `geomancie_logs` | id push-key | `{uid, email, at, lat, lng, city}` | `geomancie_logs/{id}` |
| `cron_health/reminders` (doc unique) | — | `{at, wirdSent, wirdSkipped, sessionSent, sessionSkipped, removed, errors}` | `cron_health/reminders` |

### Configuration

| Collection | ID document | Champs | Source RTDB |
|---|---|---|---|
| `config` | `app` | `{announcement, maintenance, referral, updatedAt, updatedBy}` | `config` |
| `config` | `social_links` | `{links: {...dbLien}}` | `dbLien` |

### Archive (nœuds morts — aucun fichier du dépôt ne les lit/écrit)

Vérifié par exploration exhaustive du code : `don_db`, `don_meta`,
`planner`, `alqalam_fonts` ne sont référencés nulle part dans l'app
actuelle (fonctionnalités retirées : don/donation, planificateur interne,
polices Al-Qalam personnalisées). Importés pour ne rien perdre, mais
**aucun code applicatif ne sera écrit pour ces collections**.

| Collection | ID document | Source RTDB |
|---|---|---|
| `legacy_donations` | id push-key | `don_db/{id}` |
| `legacy_donation_meta` | uid | `don_meta/{uid}` |
| `legacy_data` | `planner` | `planner` (doc unique, structure d'origine conservée) |
| `legacy_data` | `alqalam_fonts` | `alqalam_fonts` (doc unique) |

## Suite (phases 3 à 6, hors périmètre des livraisons précédentes)

Déjà migrées : Phase 1 (`server/access.js`, `pages/api/admin.js` grant/
revoke/list-access → paywall) et Phase 2 (`orders.js`, `referral.js`,
`shop.js`, `server/sellers.js`, `track.js`, `wa.js`, et les sections
produits/vendeurs/commandes de `admin.js` → commandes/parrainage/boutique).

Voir le plan de migration validé pour le détail des phases restantes — en
résumé : `sources.js`/`get-content.js` → contenu (Phase 3) ; `social.js`/
`book-social.js` → social (Phase 4) ; `zikr.js` → Zikr collectif (Phase 5) ;
le reste — crons, push, admin (Phase 6). Chacune est une PR séparée, testée
avant la suivante. La RTDB reste en place comme filet de secours jusqu'à la
fin de la phase 6.
