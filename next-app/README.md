# ASRAR PRO — Pilote Next.js / React

App **parallèle** qui migre progressivement les modules vers Next.js (App
Router) + React, **sans toucher** au site statique existant à la racine du
dépôt. Modules déjà migrés : *Secrets Mystiques* et *Marché Mystique*.
Objectif : prouver le pattern « coquille partagée unique + UI pilotée par
l'état » puis l'étendre aux autres modules. Modules migrés : *Secrets*,
*Marché*, *Ma Boutique*.

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
│  ├─ page.js           Accueil du pilote (menu → module)
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
│  └─ boutique/         MODULE MIGRÉ — Ma Boutique (espace vendeur)
│     ├─ page.js        Statut vendeur, gate d'ouverture, édition + CRUD produits
│     ├─ ProductForm.js   Modale produit (galerie 2–5, validation, upload)
│     └─ boutique.css   Styles du module (copie de boutique/boutique.css)
├─ components/          Coquille partagée réutilisable
│  ├─ Providers.js      Auth + Accès + Thème
│  ├─ AuthProvider.js   useAuth() + connexion Google
│  ├─ AccessProvider.js useAccess() + portail d'abonnement
│  ├─ SubscriptionGate.js
│  ├─ ThemeToggle.js
│  ├─ MixedText.js      Rendu FR/arabe en segments
│  ├─ useSecretRealtime.js  Likes & commentaires temps réel (secrets)
│  ├─ useProductSocial.js   Likes & commentaires temps réel (produits)
│  └─ useToast.js       Toast léger piloté par l'état
└─ lib/                 Logique non-UI (portée 1:1 du js/ existant)
   ├─ firebase.js  api.js  access.js  share.js  whatsapp.js  format.js  pdf.js
   ├─ market.js    Utilitaires Marché (vendeurs, prix, popularité)
   └─ cloudinary.js  Upload d'images via signature serveur
```

## Le backend n'est PAS réimplémenté

Les fonctions serverless (`/api/*` : paywall, likes, partage, parrainage) restent
celles de la production. `next.config.mjs` **proxifie** `/api/*` vers
`NEXT_PUBLIC_API_BASE` (défaut : `https://asrar-hub.vercel.app`) côté serveur —
donc pas de CORS, et le pilote lit les **vraies données** avec le vrai jeton
Firebase.

## Démarrer

```bash
cd next-app
npm install
cp .env.example .env.local   # ajuster NEXT_PUBLIC_API_BASE au besoin
npm run dev                  # http://localhost:3000
```

Connectez-vous avec Google (même projet Firebase que la prod), puis ouvrez
**Secrets Mystiques** ou **Marché Mystique**.

## Suite possible

Migrer les modules suivants dans le même moule (chacun devient un dossier sous
`app/`, réutilisant la coquille) : Benefits, Al-Qalam, Géomancie, Bibliothèque…
Le site statique reste en service pendant toute la transition.
