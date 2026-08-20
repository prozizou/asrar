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
> documentée), ⬜ encore ouverte.
>
> **Leçon tirée après déploiement réel** : la première passe de cette revue
> avait tout validé localement (lint/typecheck/tests/build, plus un `next
> build && next start` + `curl` réel pour la CSP) sans accès aux secrets de
> production. Une fois déployée, la CSP à nonce (point 6) a cassé Google
> Sign-In (`auth/internal-error`) — un défaut invisible sans un vrai compte
> Google en conditions réelles. Corrigé (nonce annulé), mais ça illustre la
> limite de toute validation purement locale sur un projet qui dépend
> fortement de services tiers (Firebase Auth, GAPI) : certains risques ne
> se vérifient qu'en production.

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
- **En-têtes de sécurité complets** (`next.config.mjs`) : CSP détaillée par
  domaine réellement utilisé, HSTS, `X-Frame-Options`, `Permissions-Policy`,
  `remotePatterns` restreints pour `next/image`.
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
- **PWA installable, sans mode hors-ligne** (`public/manifest.json`,
  `public/sw.js`) — décision assumée : toutes les données de l'app
  dépendent de Firebase/des API, un mode hors-ligne n'aurait donc jamais
  offert de contenu réel. Le service worker ne sert qu'à l'installabilité
  (aucune mise en cache), avec rechargement automatique (`controllerchange`,
  `components/PwaGate.js`) quand une nouvelle version prend le contrôle.
  Thème clair/sombre centralisé.

## ⚠️ Faiblesses (état après cette revue)

1. ⬜ **Le App Router n'apporte quasiment aucun de ses bénéfices.** 38 des 41
   fichiers `.js` de `app/` + `components/` restent marqués `'use client'`
   (`app/menu/page.js` a été converti en composant serveur à titre de
   démonstration — gain mesuré : 6,97 kB → 6,36 kB de JS pour cette route,
   `npm run build`). Les 12 autres pages continuent de charger leurs données
   après montage via le SDK Firebase client. Une conversion complète
   demanderait de faire transiter ces lectures par le serveur (routes `/api`
   existantes ou nouvelles) — un chantier par module, hors périmètre ici.
   (Une tentative de fermer la CSP — point 6 — était passée par `headers()`
   dans `app/layout.js`, ce qui aurait basculé toutes les pages en rendu
   dynamique ; annulée avec le reste de cette tentative, le prérendu
   statique existant est donc intact.)
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
6. ⬜ **CSP en `'unsafe-inline'` sur `script-src`** → **tentative faite puis
   annulée.** Un nonce par requête (`middleware.js` + `next/headers`) a bien
   fermé ce point, validé localement (`next build && next start` + `curl`,
   y compris un piège de fusion d'en-têtes CSP repéré et corrigé à ce
   moment-là) — mais en production, avec un vrai compte Google, ça a cassé
   `signInWithPopup()` (Google Sign-In) : erreur Firebase
   `auth/internal-error`. Cause : GAPI/Google Identity Services injecte
   dynamiquement des scripts/iframes de relais dont le contenu échappe
   totalement à notre contrôle — impossible de leur poser notre nonce, donc
   bloqués par une CSP sans `'unsafe-inline'`. Ce risque était déjà noté
   dans le commentaire GAPI de `lib/csp.js` avant la tentative, mais pas
   vérifié avec un vrai flux d'authentification avant déploiement — l'écart
   entre « le build passe et les en-têtes sont corrects » et « la connexion
   fonctionne réellement » n'a été comblé qu'après coup, par un
   signalement utilisateur. `middleware.js` supprimé, retour à
   `'unsafe-inline'` sur `script-src` (et toujours sur `style-src`, jamais
   traité). Cf. le commentaire d'en-tête de `lib/csp.js` pour la marche à
   suivre si ce point est rouvert un jour.
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
4. **CSP `'unsafe-inline'`** (`script-src` ET `style-src`) : une tentative de
   nonce par requête a cassé Google Sign-In en production (point 6) — si
   quelqu'un la reprend, tester `signInWithPopup`/`signInWithRedirect` avec
   un vrai compte Google avant tout déploiement, pas seulement le build.
   Pour `style-src`, l'alternative sans risque équivalent est de migrer les
   styles inline React vers des classes CSS.
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
