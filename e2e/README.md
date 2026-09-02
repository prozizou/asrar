# Tests E2E (Playwright)

## Périmètre actuel : tout ce qui NE dépend PAS d'un vrai compte Google

`lib/firebase.js` pointe sur le **vrai** projet Firebase de production
(`asrar-bc059` — les clés client sont publiques, ce n'est pas un problème en
soi, voir son commentaire d'en-tête). Conséquence directe pour les tests E2E :
il n'existe **aucun mode « visiteur anonyme navigant l'app »** — `components/
AuthProvider.js` gate TOUTE l'app à la racine (`app/layout.js` →
`components/Providers.js`) et remplace l'arbre entier par l'écran de
connexion tant qu'aucun utilisateur Firebase Auth n'est résolu. Automatiser un
vrai `signInWithPopup()` Google en CI demanderait soit un compte Google de
test manipulé par un navigateur piloté (fragile, contre les conditions
d'utilisation Google, et risqué : ce serait un vrai compte sur le vrai
projet), soit l'**émulateur Firebase Auth** — voir « Chantier de suite »
plus bas.

Cette première passe couvre donc ce qui est réellement testable sans
identité, et qui correspond à des parcours/garanties concrets :

| Fichier | Ce qu'il vérifie |
|---|---|
| `security-headers.spec.ts` | Les en-têtes de `next.config.mjs` (CSP, HSTS, X-Frame-Options…) atteignent réellement le navigateur, pas seulement leur définition en source. |
| `legacy-redirects.spec.ts` | Les anciennes URLs `.html` (tableau `LEGACY`) redirigent toujours vers les bonnes routes — un lien déjà partagé qui casse est une régression invisible ailleurs. |
| `auth-gate.spec.ts` | **Aucune** route (y compris les 4 tuiles retirées du menu le 2026-09-02 : Thalsams/Wafq/Tafsir al-Ahlam/Formation) ne contourne le portail de connexion — donne un sens concret à « le paywall passe par le serveur, pas par le navigateur ». |
| `api-auth.spec.ts` | Les routes `/api/*` rejettent (401/405) tout appel sans identité valide — comble le trou noté dans `ANALYSE.md` (§7) : le comportement HTTP réel des routes n'avait jamais été testé, seulement leur logique interne via `lib/*.test.js`. |
| `pwa.spec.ts` | Critères d'installabilité PWA (manifeste, enregistrement du service worker) — invisible pour vitest, `public/sw.js` est un script de navigateur. |

## Lancer les tests

```bash
npm run build   # webServer (playwright.config.ts) démarre `next start`, pas `next build`
npm run test:e2e
```

En local, si Playwright signale une version de navigateur manquante :
`npx playwright install chromium`.

## Ce qui n'est PAS couvert ici (chantier de suite)

Tout parcours qui exige une identité réelle reste hors périmètre tant que
l'émulateur Firebase n'est pas en place :

- **Connexion Google** (`signInWithPopup`/`signInWithRedirect`) — le point
  que `lib/csp.js` documente déjà comme fragile (une CSP à nonce l'a cassé
  une fois en production, voir son en-tête).
- **Paywall côté abonné** : un utilisateur RÉELLEMENT autorisé qui génère un
  contenu premium (Al Qalam, Géomancie, Wafq, Thalsams).
- **Commande vendeur / WhatsApp** (`/api/wa`, `/api/shop`).
- **Zikr collectif** multi-utilisateur (création de groupe, adhésion,
  compteur partagé).
- **Parrainage** (génération de lien, activation).

Débloquer ces parcours demande, dans l'ordre :
1. Un `firebase.json` + config d'émulateurs (Auth + Realtime Database) — à
   ajouter en même temps que celui déjà évoqué dans `rules/README.md` pour le
   déploiement des règles RTDB (même fichier, deux besoins).
2. Faire pointer `lib/firebase.js` (client) et `server/grant.js` (Admin SDK)
   vers les émulateurs quand une variable d'environnement dédiée est
   positionnée (`connectAuthEmulator`/`connectDatabaseEmulator` côté client ;
   l'Admin SDK suit `FIREBASE_AUTH_EMULATOR_HOST`/
   `FIREBASE_DATABASE_EMULATOR_HOST` automatiquement, sans code
   supplémentaire) — STRICTEMENT gardé par cette variable, jamais actif par
   défaut : un raccourci de connexion qui fuiterait en production serait une
   faille, pas un outil de test.
3. Un utilisateur de test créé dans l'émulateur (script de seed), et une
   connexion automatisée via `signInWithCustomToken` (l'émulateur Auth
   l'accepte sans jamais toucher aux serveurs Google réels) plutôt qu'un vrai
   popup Google.
4. Semer les nœuds RTDB nécessaires (`allowedUsers`, `sourate`, `versetRef`,
   `data/appData/asmaUlHusna`…) dans l'émulateur avant chaque run.

Pas engagé dans cette passe : lift plus lourd que les tests ci-dessus, mieux
scopé comme chantier séparé une fois ce socle Playwright validé en usage réel.
