# ASRAR PRO

App Next.js (App Router) + React. **La migration est terminée** : tous les
modules (*Marché*, *Secrets*, *Ma Boutique*, *99 Noms d'Allah*,
*Bibliothèque*, *Abajad*, *Parrainage*, *Combinaisons*, *Planète*,
*Rouwhanes*, *Géomancie*, *Al Qalam*…) sont des routes React sous `app/`,
reliées par le tableau de bord `/menu` en navigation SPA instantanée. Il
n'existe plus de site statique séparé dans ce dépôt — voir `ANALYSE.md` pour
l'état courant (forces, faiblesses, améliorations).

## Ce que cette architecture apporte (par rapport à l'ancien site statique)

| Avant (ex-site statique) | Après (cette app) |
|---|---|
| Chaque page recharge Firebase, `theme.js`, `share.js`, `firebase-config.js`… dans son `<head>` (×17) | **Une seule coquille** (`components/Providers`) : auth, accès, thème montés une fois |
| Auth via `requireAuth()` + redirection en dur | Contexte `useAuth()` + écran de connexion Google intégré |
| Paywall : cache global `_accessStatus` + injection DOM du portail | `useAccess()` + `<SubscriptionGate>` piloté par l'état |
| Likes/commentaires : `ref.on(...)` + nettoyage manuel des écouteurs | Hook `useSecretRealtime()` (attache/détache via `useEffect`) |
| Vues liste/détail masquées via `style.display` | Rendu conditionnel React |
| `innerHTML` + `escapeHtml` partout | JSX (`<MixedText>`), plus d'injection HTML |
| Navigation = rechargement complet | Navigation SPA instantanée (`next/link`) |

## Architecture

```
.
├─ app/
│  ├─ layout.js         Coquille racine + init thème anti-FOUC (+ nonce CSP, cf. middleware.js)
│  ├─ globals.css       Feuille partagée + styles composants
│  ├─ page.js           Accueil = Marché Mystique (module le plus utilisé, cf. son en-tête de fichier)
│  ├─ menu/            Tableau de bord (liste des modules) + compte/thème/déconnexion
│  │  └─ page.js
│  ├─ abajad/          MODULE MIGRÉ — Calculateur Abjad ésotérique
│  │  └─ page.js        Calcul temps réel, zodiaque, facteurs (logique → lib/abjad)
│  ├─ parrainage/      MODULE MIGRÉ — Parrainage (points, lien, conversion)
│  │  └─ page.js
│  ├─ combinaisons/    MODULE MIGRÉ — Combinaisons des 99 Noms par poids Abjad
│  │  └─ page.js        Recherche (backtracking + élagage), filtre, pagination,
│  │                    calculatrice, restauration (logique → lib/combinaisons)
│  ├─ planete/         MODULE MIGRÉ — Horloge & heures planétaires chaldéennes
│  │  └─ page.js        GPS + horloge 1 s + soleil NOAA hors-ligne (→ lib/planete)
│  ├─ rouwhania/       MODULE MIGRÉ — Rouwhanes (noms des anges + noms d'Allah)
│  │  └─ page.js        Poids Abjad (3 méthodes), génération, vœu (→ lib/rouwhania)
│  ├─ geomancie/       MODULE MIGRÉ — Écu géomantique (Tourab)
│  │  └─ page.js        4 Mères → 16 Maisons, بزدح, juge, synthèse, modale
│  │                    d'interprétation (logique → lib/geomancie)
│  ├─ alqalam/         MODULE MIGRÉ — Al-Qalam (calligraphie)
│  │  └─ page.js        Aperçu coloré live, mode Rasm, intercalation, cumul,
│  │                    export Word .docx (logique → lib/alqalam)
│  ├─ asrar/            MODULE MIGRÉ — Secrets
│  │  ├─ page.js        Liste par catégorie + orchestration
│  │  ├─ SecretDetail.js  Vue détail (like/commentaire/favori/partage/PDF)
│  │  ├─ CommentSheet.js  Bottom-sheet commentaires
│  │  └─ asrar.css      Styles du module (copie de asrar/asrar.css)
│  ├─ marche/           MODULE MIGRÉ — Marché
│  │  ├─ page.js        Produits, vendeurs, filtres/recherche, tri popularité
│  │  ├─ ProductModal.js  Modale produit (galerie, social, commande WhatsApp)
│  │  ├─ VendorShop.js    Vue boutique d'un vendeur
│  │  └─ marche.css     Styles du module (copie de marche/marche.css)
│  ├─ boutique/         MODULE MIGRÉ — Ma Boutique (espace vendeur)
│  │  ├─ page.js        Statut vendeur, gate d'ouverture, édition + CRUD produits
│  │  ├─ ProductForm.js   Modale produit (galerie 2–5, validation, upload)
│  │  └─ boutique.css   Styles du module (copie de boutique/boutique.css)
│  ├─ benefits/         MODULE MIGRÉ — 99 Noms d'Allah
│  │  ├─ page.js        Chargement, recherche/suggestions, favoris, modale
│  │  ├─ NameCard.js      Carte (verrouillée / complète)
│  │  ├─ NameModal.js     Modale d'un nom
│  │  ├─ WafqSquares.js   Carrés magiques (awfaq 3×3 / 3×3 vide / 4×4)
│  │  ├─ Tasbih.js        Compteur de dhikr (UI)
│  │  └─ benefits.css   Styles du module (copie de Benefits/style.css)
│  └─ bibliotheque/     MODULE MIGRÉ — Bibliothèque Almaqtab
│     ├─ page.js        Grille de livres, social, ouverture PDF, partage
│     ├─ CommentModal.js  Modale commentaires
│     └─ bibliotheque.css Styles (extraits des <style> inline du HTML)
├─ components/          Coquille partagée réutilisable
│  ├─ Providers.js      Auth + Accès + Thème
│  ├─ AuthProvider.js   useAuth() + connexion Google
│  ├─ AccessProvider.js useAccess() + portail d'abonnement
│  ├─ SubscriptionGate.js
│  ├─ ThemeToggle.js
│  ├─ MixedText.js      Rendu FR/arabe en segments
│  ├─ useSecretRealtime.js  Likes & commentaires temps réel (secrets)
│  ├─ useProductSocial.js   Likes & commentaires temps réel (produits)
│  ├─ useToast.js       Toast léger piloté par l'état
│  └─ useTasbih.js      Compteur de dhikr (séries, progression, localStorage)
└─ lib/                 Logique non-UI — un module par rubrique (abjad, combinaisons,
                        geomancie, planete, rouwhania, alqalam…) + utilitaires transverses
                        (firebase, api, access, share, whatsapp, format, pdf, market,
                        cloudinary, benefits, audio…). Couverte par des tests (lib/*.test.js)
                        et un typecheck incrémental (tsconfig.lib.json) — cf. ANALYSE.md.
                        Trois fichiers SANS 'use client', importables aussi côté serveur
                        (require(), interop CommonJS/ESM) :
   ├─ plans.js     Paliers d'accès (SUB_PLANS/PREMIUM_LEVEL) — source unique
   │                partagée avec server/access.js (plus de duplication à resynchroniser)
   ├─ csp.js       Content-Security-Policy — source unique partagée avec next.config.mjs
   │                (repli statique) et middleware.js (nonce par requête)
   └─ rateLimit.js Limitation de fréquence en mémoire (par instance, cf. son en-tête)
```

`middleware.js` (racine) pose un nonce CSP par requête et l'expose à
`app/layout.js` — voir son en-tête pour le détail (et le piège identifié :
Next.js ne fusionne pas deux en-têtes `Content-Security-Policy`).

## Backend intégré (app unifiée)

Les fonctions serverless (`/api/*` : paywall, likes, partage, parrainage, thème…)
vivent désormais **dans cette app** :

- `pages/api/*.js` — les 13 fonctions (handlers `(req, res)`),
- `server/*.js` — leur socle partagé (`grant` = init Firebase Admin, `access`,
  `http`, `sellers`, `sources`, `log` = point d'accroche suivi d'erreurs),
- `lib/*.js` — utilitaires importables des deux côtés (client ET serveur, via
  l'interop CommonJS/ESM du bundler Next) : `plans` (paliers d'accès, source
  unique), `csp` (Content-Security-Policy), `rateLimit` (limitation de
  fréquence en mémoire).

L'API est **same-origin** (pas de proxy externe). `next.config.mjs` conserve le
lien court **`/s`** (aperçu Open Graph + redirection + comptage parrainage) et
**redirige les anciennes URLs `.html`** de l'ex-site statique vers les routes
React — donc **tous les liens déjà partagés** (`/s?…`, pages) continuent de
fonctionner.

Les **secrets serveur** (compte de service Firebase Admin, WhatsApp, Cloudinary,
`SITE_URL`…) sont des **variables d'environnement du projet Vercel** (voir
`.env.example`), jamais commitées.

## Démarrer

```bash
npm install
cp .env.example .env.local   # ajuster les variables au besoin
npm run dev                  # http://localhost:3000
```

Connectez-vous avec Google (même projet Firebase que la prod).

## Qualité / CI

```bash
npm run lint        # ESLint (next/core-web-vitals)
npm run typecheck    # TypeScript incrémental (checkJs), scopé à lib/
npm test             # Vitest — logique pure de lib/ (calculs ésotériques, accès…)
npm run build         # build de production (échoue si lint/types cassent)
npm run test:e2e      # Playwright — voir e2e/README.md (nécessite npm run build avant)
```

Les cinq tournent sur chaque push/PR (`.github/workflows/ci.yml`, deux jobs :
`lint-and-build` puis `e2e`). Voir `ANALYSE.md` pour ce qui reste hors
périmètre (tests de composants app/, TypeScript sur app/, règles Firebase
RTDB versionnées…) et `e2e/README.md` pour le périmètre précis des tests E2E.

## Modules migrés

Chaque module garde sa **logique pure dans `lib/`** (testable hors UI, cf.
`lib/*.test.js`) et ses **styles scopés** pour éviter toute fuite entre pages.
L'ex-site statique n'existe plus dans ce dépôt ; les anciennes URLs `.html`
restent redirigées (voir ci-dessus) pour ne pas casser les liens déjà partagés.
