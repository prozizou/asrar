# Analyse — ASRAR PRO : forces, faiblesses & améliorations

> Mise à jour de cette revue pour l'état **actuel** du dépôt : l'app Next.js
> (App Router) sous `app/` + `pages/api/` + `server/` **est** désormais le
> produit — le site statique historique (`css/style.css`, `index.html`,
> `js/main.js`…) décrit par les versions précédentes de ce document n'existe
> plus dans le dépôt. `REVUE.md` documente des corrections de cette période
> pré-migration et reste un historique, pas l'état courant.
>
> Cette version marque le statut de chaque faiblesse identifiée lors de la
> revue précédente : ✅ traitée, 🟡 partiellement traitée (limite assumée et
> documentée), ⬜ encore ouverte. Rien n'a été déployé en production dans le
> cadre de cette revue (pas d'accès aux secrets Vercel/Firebase) — chaque
> changement a été validé localement (`npm run lint && npm run typecheck &&
> npm test && npm run build`, plus un `next build && next start` réel pour la
> CSP, cf. point 6) mais reste à vérifier une fois déployé.

## ✅ Forces

- **Barrière du paywall entièrement côté serveur** : `server/access.js`
  (`verifyUser`/`hasActiveAccess`/`getAccessLevel`) est LA source de vérité,
  appelée depuis `/api/get-content`, `/api/wa`, `/api/admin`… Le numéro
  WhatsApp vendeur n'est par exemple jamais renvoyé au navigateur
  (`get-content` supprime `src.privateFields`, le contact passe par une
  redirection serveur `/api/wa?product=`).
- **Anti-abus pensé, pas juste ajouté** : parrainage avec dédoublonnage
  transactionnel (`referred/{uid}`), refus d'auto-parrainage, exigence de
  compte « frais » (< 7 jours) pour créditer les points, redemption des
  points atomique (`transaction` qui échoue si le solde est insuffisant, et
  restitution en cas d'échec d'activation) ; upload Cloudinary namespacé par
  `uid` pour tracer/cloisonner le stockage.
- **En-têtes de sécurité complets** (`next.config.mjs` + `middleware.js`) :
  CSP détaillée par domaine réellement utilisé — **et désormais sans
  `unsafe-inline` sur `script-src`** grâce à un nonce par requête —, HSTS,
  `X-Frame-Options`, `Permissions-Policy`, `remotePatterns` restreints pour
  `next/image`.
- **Assainissement systématique des entrées** : `safeUrl()` / `clean()` /
  échappement HTML dans `server/http.js` et `pages/api/share.js` contre les
  évasions HTML/JS dans les champs libres (admin, tracking, aperçu Open
  Graph).
- **CI réelle** : lint + typecheck (`lib/`) + tests unitaires (`lib/`) + build
  sur chaque push/PR (`.github/workflows/ci.yml`), avec variables
  d'environnement factices documentées pour ne pas casser le build.
- **Logique métier testée et typée** : 95 tests Vitest (`lib/*.test.js`)
  couvrent les calculs ésotériques (Abjad, combinaisons, géomancie, planète),
  la logique de paywall (`parseAllowed`) et la CSP ; `tsconfig.lib.json`
  (checkJs) type-checke le même périmètre.
- **Architecture modulaire propre** : logique pure isolée dans `lib/`
  (abjad, combinaisons, géomancie, planète…), UI dans `app/`, accès Admin
  SDK dans `server/`. Trois fichiers `lib/` sans dépendance React
  (`plans.js`, `csp.js`, `rateLimit.js`) sont désormais la **source unique**
  importée à la fois côté client et côté serveur (interop CommonJS/ESM du
  bundler Next), là où les constantes d'accès étaient dupliquées avant.
- **PWA conservée** (`public/manifest.json`, `public/sw.js`) et thème
  clair/sombre centralisé.

## ⚠️ Faiblesses (état après cette revue)

1. ⬜ **Le App Router n'apporte quasiment aucun de ses bénéfices.** 38 des 41
   fichiers `.js` de `app/` + `components/` restent marqués `'use client'`
   (`app/menu/page.js` a été converti en composant serveur à titre de
   démonstration — gain mesuré : 6,97 kB → 6,36 kB de JS pour cette route,
   `npm run build`). Les 12 autres pages continuent de charger leurs données
   après montage via le SDK Firebase client. Une conversion complète
   demanderait de faire transiter ces lectures par le serveur (routes `/api`
   existantes ou nouvelles) — un chantier par module, hors périmètre ici.
   **Effet de bord additionnel** : fermer la CSP (point 6) a nécessité
   `headers()` dans `app/layout.js`, ce qui bascule **toutes** les pages en
   rendu dynamique (plus de prérendu statique) — comportement documenté de
   Next.js pour ce pattern. Impact réel limité : la quasi-totalité du
   contenu était déjà rendue client-side après coup (le HTML prérendu
   n'était qu'une coquille de chargement), donc peu de perte réelle, mais
   c'est une contrainte de plus qui pèse dans le même sens que ce point.
2. ✅ **Zéro test automatisé** → 95 tests Vitest sur `lib/` (`npm test`,
   dans la CI). Reste hors périmètre : tests de composants React (`app/`,
   `components/`) et tests d'intégration/e2e sur les routes `/api`.
3. 🟡 **Pas de TypeScript ni de vérification de types** → `tsconfig.lib.json`
   + `npm run typecheck` (CI) type-checke `lib/` en mode `checkJs` (aucun
   fichier `.ts`, juste des diagnostics sur le JS existant, avec quelques
   `@ts-expect-error` ciblés sur des quirks navigateur non standard —
   `webkitAudioContext`, `navigator.standalone`). **Volontairement pas** de
   `tsconfig.json` à la racine : sa seule présence bascule `next build` en
   mode « projet TypeScript » et type-checke tout `app/` (JSX, imports CSS
   compris), constaté en le testant — casse le build sans un travail de
   typage bien plus large sur les composants React. `app/` et `components/`
   restent donc entièrement non typés.
4. 🟡 **Règles de sécurité Firebase RTDB absentes du dépôt** →
   `rules/database.rules.json` + `rules/README.md` (nouveau) reconstituent
   les règles à partir de **chaque** accès client direct trouvé dans le code
   (recensés dans `rules/README.md`) ; tout le reste passe par l'Admin SDK
   (contourne ces règles) donc reste fermé par défaut. **Non vérifié contre
   les règles réellement déployées** (pas d'accès à la console Firebase de
   production dans cette session) — à comparer et tester (émulateur ou
   simulateur) avant tout déploiement, voir le disclaimer du fichier.
5. ✅ **Constantes dupliquées client/serveur** → `lib/plans.js` (source
   unique : `SUPER_ADMIN_EMAIL`, `SUB_PLANS`, `PREMIUM_LEVEL`,
   `parseAllowed()`), importé par `lib/access.js` (client) ET
   `server/access.js` (Admin SDK). Testé (`lib/plans.test.js`).
6. ✅ **CSP en `'unsafe-inline'` sur `script-src`** → `middleware.js` pose un
   nonce par requête, propagé à `app/layout.js` via `next/headers`.
   **Piège identifié en testant en conditions réelles** (`next build && next
   start` + `curl`) : Next.js ne fusionne pas deux en-têtes
   `Content-Security-Policy` de même nom, celui du middleware remplace
   entièrement celui de `next.config.mjs` sur les routes qu'il couvre — d'où
   `lib/csp.js` qui renvoie toujours la politique complète (pas seulement
   `script-src`). `style-src` reste en `'unsafe-inline'` (attribut `style=""`
   posé par le rendu serveur de React — fermer ce point demanderait de
   migrer les styles inline vers des classes CSS, non fait ici).
7. ✅ **Pas de limitation de fréquence** → `lib/rateLimit.js` (fenêtre
   glissante en mémoire, testé) appliqué sur `/api/track`, `/api/referral`
   et `/api/cloudinary-sign`. **Limite assumée** : par instance serverless,
   pas distribuée — un attaquant réparti sur plusieurs instances (cold
   starts fréquents) la contourne. Protège contre un compte compromis qui
   spamme depuis une session, pas contre une attaque distribuée
   sophistiquée ; une garantie dure demanderait un store partagé (Upstash
   Redis, Vercel KV…).
8. ✅ **Documentation périmée** → `README.md` réécrit (plus de discours
   « pilote / app parallèle », commande `cd next-app` corrigée, module
   `don/` disparu retiré, nouveaux fichiers partagés documentés) ;
   `package.json` (`description`) déjà mis à jour lors du commit précédent.
9. 🟡 **Aucun suivi d'erreurs en production** → `server/log.js`
   (`reportError`) centralise et structure la journalisation (JSON dans les
   logs Vercel) et ajoute un point d'accroche optionnel vers un webhook
   (`ERROR_WEBHOOK_URL` — Sentry, Slack, Discord… n'importe quel récepteur
   HTTP JSON, aucun SDK propriétaire ajouté), câblé sur les 500 inattendus
   qui n'étaient journalisés nulle part (`get-content`, `admin`, `shop`,
   `latest-commit`, `list-content`, `book-social`, `get-theme`) et sur les
   crashs client (`app/error.js` → `/api/client-error`, rate-limité par IP).
   **Ce n'est pas un APM** : sans `ERROR_WEBHOOK_URL` configurée, ça reste
   des logs consultables mais aucune alerte proactive — la variable n'a pas
   été testée contre un vrai service (aucun accès à un compte Sentry/Slack
   dans cette session).
10. ✅ **Upload Cloudinary non verrouillé en format/taille** → support
    optionnel d'un `upload_preset` **signé** (`CLOUDINARY_UPLOAD_PRESET`,
    `pages/api/cloudinary-sign.js` + `lib/cloudinary.js`) pour verrouiller
    ça côté Cloudinary. **Non testé contre un vrai compte Cloudinary** (pas
    de credentials dans cette session) ; sans la variable, comportement
    identique à avant (rien ne casse), mais il reste à créer le preset côté
    Cloudinary et à définir la variable pour que la protection soit
    effective.

## 🚀 Améliorations restantes (classées par rapport bénéfice / effort)

1. **Comparer et déployer `rules/database.rules.json`** contre les règles
   réellement actives dans la console Firebase (voir `rules/README.md`) —
   c'est la seule amélioration de sécurité de cette liste qui n'est **pas**
   encore effective tant qu'elle n'est pas déployée.
2. **Poursuivre la réduction de la surface `'use client'`**, module par
   module : faire transiter chaque lecture Firebase (aujourd'hui côté
   client, après montage) par une route serveur, en suivant le pattern
   démontré sur `app/menu/page.js`.
3. **Rate limiting distribué** (Upstash Redis, Vercel KV) si l'app grossit
   au point qu'un abus multi-instance devienne un risque réel — `lib/rateLimit.js`
   reste une protection best-effort par instance.
4. **Fermer `style-src 'unsafe-inline'`** en migrant les styles inline React
   vers des classes CSS (gain XSS marginal restant, effort plus élevé que le
   nonce script-src déjà fait).
5. **Étendre TypeScript** au-delà de `lib/` : `app/`/`components/` restent
   non typés (JSX, hooks, Firebase) — un chantier bien plus large que le
   `checkJs` scopé posé ici.
6. **Vérifier en conditions réelles** (déploiement Vercel + comptes
   Firebase/Cloudinary/webhook réels) les points marqués 🟡 ci-dessus : rien
   dans cette session n'a pu être testé au-delà du local (`next build/start`,
   `curl`) faute d'accès aux services externes de production.
7. **Tests de composants et e2e** : la couverture actuelle (`lib/*.test.js`)
   ne touche que la logique pure — `app/`, `components/` et les routes
   `/api` (comportement HTTP, pas juste leurs fonctions internes) restent
   sans test automatisé.
