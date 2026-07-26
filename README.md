# ASRAR PRO — Pilote Next.js / React

App **parallèle** qui migre progressivement les modules vers Next.js (App
Router) + React, **sans toucher** au site statique existant à la racine du
dépôt. Modules déjà migrés : *Secrets Mystiques* et *Marché Mystique*.
Objectif : prouver le pattern « coquille partagée unique + UI pilotée par
l'état » puis l'étendre aux autres modules. Modules migrés : *Secrets*,
*Marché*, *Ma Boutique*, *99 Noms d'Allah*, *Bibliothèque*, *Don de secret*,
*Abajad*, *Parrainage*, *Combinaisons*, *Planète*, *Rouwhanes*, *Géomancie*,
*Al Qalam*. **La migration est complète** : les 17 rubriques du site statique
sont désormais des routes React sous `app/`, et le **tableau de bord d'accueil**
relie le tout en navigation SPA instantanée — plus aucun renvoi vers le site
statique.

## Ce que le pilote démontre

| Avant (site statique) | Après (ce pilote) |
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
next-app/
├─ app/
│  ├─ layout.js         Coquille racine + init thème anti-FOUC
│  ├─ globals.css       Feuille partagée (copie de css/style.css) + styles composants
│  ├─ page.js           Tableau de bord (accueil) — menus groupés, liens SPA
│  ├─ don/             MODULE MIGRÉ — Don de secret (formulaire → /api/don)
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
└─ lib/                 Logique non-UI (portée 1:1 du js/ existant)
   ├─ firebase.js  api.js  access.js  share.js  whatsapp.js  format.js  pdf.js
   ├─ market.js    Utilitaires Marché (vendeurs, prix, popularité)
   ├─ cloudinary.js  Upload d'images via signature serveur
   ├─ benefits.js  Chargement des 99 Noms (cache → API → RTDB → fallback)
   ├─ abjad.js     Poids abjad, carrés magiques, ordre élémentaire
   └─ audio.js     Sons synthétisés (grain, objectif) + prononciation
```

## Backend intégré (app unifiée)

Les fonctions serverless (`/api/*` : paywall, likes, partage, parrainage, thème…)
vivent désormais **dans cette app** :

- `pages/api/*.js` — les 12 fonctions (mêmes handlers `(req, res)` qu'avant),
- `server/*.js` — leur socle partagé (`grant` = init Firebase Admin, `access`,
  `http`, `sellers`, `sources`).

Plus de proxy externe : l'API est **same-origin**. `next.config.mjs` conserve le
lien court **`/s`** (aperçu Open Graph + redirection + comptage parrainage) et
**redirige les anciennes URLs `.html`** du site statique vers les routes React —
donc **tous les liens déjà partagés** (`/s?…`, pages) continuent de fonctionner.

Les **secrets serveur** (compte de service Firebase Admin, WhatsApp, Cloudinary,
`SITE_URL`…) sont des **variables d'environnement du projet Vercel** (voir
`.env.example`), jamais commitées.

## Démarrer

```bash
cd next-app
npm install
cp .env.example .env.local   # ajuster NEXT_PUBLIC_API_BASE au besoin
npm run dev                  # http://localhost:3000
```

Connectez-vous avec Google (même projet Firebase que la prod), puis ouvrez
**Secrets Mystiques** ou **Marché Mystique**.

## Migration terminée

Tous les modules du site statique ont été portés sous `app/` en réutilisant la
coquille partagée. Le site statique historique n'est plus nécessaire à la
navigation ; il peut rester en ligne comme repli le temps de valider la bascule
en production. Chaque module garde sa **logique pure dans `lib/`** (testable
hors UI) et ses **styles scopés** pour éviter toute fuite entre pages.
