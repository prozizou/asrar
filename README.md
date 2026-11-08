# ASRAR PRO

Sciences mystiques et marché spirituel : secrets, bibliothèque, géomancie,
calligraphie, carrés numériques, heures planétaires, zikr collectif et
boutiques en ligne.

- **Site** : https://www.asrarpro.com (Next.js, hébergé sur Vercel).
- **Application Android** : `com.Asrar` sur Google Play — coquille Capacitor
  qui charge le site. Toute mise à jour du site arrive dans l'application sans
  republier sur le Play Store (voir [ANDROID.md](ANDROID.md)).
- **Données** : Firebase (Auth Google, Realtime Database) ; images et audios
  sur Cloudinary.

## Fonctionnalités

L'accueil (`/`) est le **Marché**. Le tableau de bord `/menu` regroupe les
modules par famille.

| Famille | Module | Route |
|---|---|---|
| Marché | Marché (produits, boutiques, avis, partage, demande WhatsApp) | `/` |
| | Ma Boutique (espace vendeur, produits, statistiques, partage) | `/boutique` |
| | Demandes et commandes | `/commandes` |
| Spiritualité | Zikr collectif (groupes, compteur, discussion, avertissements) | `/zikr` |
| | Rouwhanes (noms des anges et noms d'Allah) | `/rouwhania` |
| Sciences traditionnelles | Al Qalam (calligraphie, export Word) | `/alqalam` |
| | Géomancie (écu, parité du Juge, figure de repérage, PDF) | `/geomancie` |
| | Hatims — carrés numériques 3×3 à 11×11 (export Word) | `/wafq/carre` |
| Ressources | Bibliothèque Almaqtab (livres PDF) | `/bibliotheque` |
| | Secret Mystique | `/asrar` |
| Outils | Combinaisons des 99 Noms (poids Abjad) | `/combinaisons` |
| | Planète (heures planétaires, alarmes) | `/planete` |
| | Date du jour (hijri / grégorien) | `/hijri` |
| | Parrainage | `/parrainage` |
| Compte | Mon compte, Notifications | `/compte`, `/notifications` |

Autres points :

- **Thèmes clair et sombre** (style épuré, accent orange), bascule dans le menu
  latéral ; pages adaptées de 320 px à l'ordinateur.
- **Partage** : liens courts `/s?k=…` avec aperçu (secret, livre, produit,
  boutique, zikr) et code de parrainage (voir
  [PARTAGE_ET_PARRAINAGE.md](PARTAGE_ET_PARRAINAGE.md)).
- **Notifications** : web push, notifications Android (FCM) et file serveur
  (voir [NOTIFICATIONS.md](NOTIFICATIONS.md)).
- **WhatsApp** : le numéro reste côté serveur (`/api/wa`). Dans l'application
  et sur le site Android, WhatsApp s'ouvre directement avec le message
  prérempli ; ailleurs, dans un nouvel onglet.
- Les anciennes adresses (`.html`, modules retirés comme `/tafsir`, `/wafq`,
  `/abajad`) sont redirigées (`next.config.mjs`).

## Accès et paiements

Tout utilisateur se connecte avec Google. Les publicités sont **en pause**
(`ADS_PAUSED` dans `lib/plans.js`) : les modules demandent un abonnement actif.

| Formule | Prix |
|---|---|
| Abonnement 3 mois / 6 mois / 1 an | 15 000 / 25 000 / 45 000 FCFA |
| Ma Boutique (vendre sur le Marché) | 5 000 FCFA par mois |

- **Sciences traditionnelles** (Al Qalam, Géomancie, Hatims) : palier 1 an.
- **Planète** : l'heure planétaire en cours est floutée sans abonnement.
- **Paiement** : Wave, PI-SPI ou WhatsApp, puis justificatif sur WhatsApp ;
  **activation manuelle** par l'administration (voir
  [ABONNEMENTS_WHATSAPP_WAVE.md](ABONNEMENTS_WHATSAPP_WAVE.md)).
- Les achats du Marché se règlent directement avec chaque boutique.

La barrière réelle est côté serveur (`server/access.js`) ; `lib/plans.js` est
la source unique des paliers, partagée avec le client.

## Architecture

```
app/          Routes (App Router) : une page par module, styles scopés par module
  layout.js   Coquille racine : thème anti-FOUC, Providers, bannières
  globals.css Palette clair/sombre et styles partagés
components/   Coquille partagée : AuthProvider, AccessProvider, SubscriptionGate,
              SubscriptionPlans (paiements), Modal, MoreMenu, notifications…
lib/          Logique sans interface, un module par rubrique (geomancie,
              combinaisons, planete, kanzouWafq, zikr…) + utilitaires (api,
              access, plans, share, whatsapp, externalWindow, csp…)
pages/api/    Fonctions serveur (29) : contenu, accès, social, boutique,
              commandes, zikr, notifications, partage /s, WhatsApp /api/wa,
              tâches planifiées (cron/)
server/       Socle serveur : Firebase Admin, accès, commandes, notifications,
              zikr, cache du catalogue public
rules/        Règles Realtime Database
android/      Application Capacitor (versionName 8.0.4)
public/       Service worker (sw.js, SW_VERSION), manifeste, politique de
              confidentialité, app-ads.txt
e2e/, tests/  Tests Playwright (publics et authentifiés) et tests serveur
```

- L'API est sur la même origine que le site (pas de proxy).
- La Content-Security-Policy est définie dans `lib/csp.js` et appliquée par
  `next.config.mjs`.
- Le service worker ne met rien en cache ; chaque déploiement qui change le
  code client incrémente `SW_VERSION` dans `public/sw.js` (v46.61 → v46.62…)
  pour que les pages et l'application ouvertes rechargent le nouveau code. L'historique est dans
  [CHANGELOG.md](CHANGELOG.md).

## Démarrer

Node **24.x** (voir `.nvmrc`).

```bash
npm install
cp .env.example .env.local   # renseigner les variables
npm run dev                  # http://localhost:3000
```

Variables (`.env.example`, jamais commitées ; en production : projet Vercel) :
`FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_DB_URL`, `SITE_URL`, `SUPER_ADMIN_EMAIL`,
`WHATSAPP_NUMBER`, `CLOUDINARY_*`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, `ERROR_WEBHOOK_URL`.

## Qualité et CI

```bash
npm run lint          # ESLint, aucun avertissement toléré
npm run typecheck     # TypeScript (lib/)
npm test              # Vitest : logique de lib/ et tests serveur de tests/
npm run build         # build de production
npm run test:runtime  # après build : chargement des API comme sur Vercel
npm run test:auth     # build + émulateurs Firebase + Playwright authentifié (Java 21)
npm run test:e2e      # Playwright public (après npm run build), voir e2e/README.md
```

GitHub Actions :

| Workflow | Rôle |
|---|---|
| `ci.yml` | `checks` (lint, types, tests, build) et `authenticated` (e2e sur émulateurs, sans secret de production) sur chaque PR et push vers `main` |
| `android-checks.yml` | compilation de l'application Android sur les PR qui touchent `android/` ou Capacitor |
| `android-release.yml` | AAB signé pour le Play Store (tag `android-v*` ou lancement manuel) |
| `notifications-cron.yml`, `reminders-cron.yml` | appel régulier des tâches `/api/cron/*` (le cron Vercel ne tourne qu'une fois par jour) |

## Documentation

| Sujet | Fichier |
|---|---|
| Application Android, signature, publication | [ANDROID.md](ANDROID.md), [ACHATS_ANDROID.md](ACHATS_ANDROID.md) |
| Abonnements, paiements, WhatsApp | [ABONNEMENTS_WHATSAPP_WAVE.md](ABONNEMENTS_WHATSAPP_WAVE.md), [INTEGRATION_PAIEMENT.md](INTEGRATION_PAIEMENT.md), [DEPLOIEMENT_WHATSAPP.md](DEPLOIEMENT_WHATSAPP.md) |
| Publicités (en pause) | [PUBLICITES_ET_WHATSAPP.md](PUBLICITES_ET_WHATSAPP.md), [MEDIATION_LEVELPLAY.md](MEDIATION_LEVELPLAY.md) |
| Commandes et données personnelles | [COMMANDES_ET_COMPTE.md](COMMANDES_ET_COMPTE.md) |
| Zikr (discussion, audio) | [MESSAGERIE_ZIKR.md](MESSAGERIE_ZIKR.md), [AUDIO_ZIKR.md](AUDIO_ZIKR.md) |
| Notifications | [NOTIFICATIONS.md](NOTIFICATIONS.md) |
| Partage et parrainage | [PARTAGE_ET_PARRAINAGE.md](PARTAGE_ET_PARRAINAGE.md) |
| Déploiement, sécurité, Cloudinary | [DEPLOIEMENT_SECURITE.md](DEPLOIEMENT_SECURITE.md) |
| Planète (refonte de l'interface) | [INSTALLATION.md](INSTALLATION.md), [CHANGELOG_PLANETE_UI.md](CHANGELOG_PLANETE_UI.md) |
| Coûts Firebase, SDK | [COUTS_FIREBASE.md](COUTS_FIREBASE.md), [MIGRATION_FIREBASE.md](MIGRATION_FIREBASE.md) |
| État du code, revues | [ANALYSE.md](ANALYSE.md), [REVUE.md](REVUE.md), [QUALITE_VUES.md](QUALITE_VUES.md) |
| Historique des versions | [CHANGELOG.md](CHANGELOG.md) |
