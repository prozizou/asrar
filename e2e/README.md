# Tests E2E (Playwright)

## Suite sans connexion Google

En compilation normale, `lib/firebase.js` pointe sur le projet Firebase
(`asrar-bc059` — les clés client sont publiques, ce n'est pas un problème en
soi, voir son commentaire d'en-tête). Conséquence directe pour les tests E2E :
il n'existe **aucun mode « visiteur anonyme navigant l'app »** — `components/
AuthProvider.js` gate TOUTE l'app à la racine (`app/layout.js` →
`components/Providers.js`) et remplace l'arbre entier par l'écran de
connexion tant qu'aucun utilisateur Firebase Auth n'est résolu. Automatiser un
vrai `signInWithPopup()` Google en CI demanderait soit un compte Google de
test manipulé par un navigateur piloté (fragile, contre les conditions
d'utilisation Google, et risqué : ce serait un vrai compte sur le vrai
projet), soit l'**émulateur Firebase Auth**, utilisé par la suite
authentifiée décrite plus bas.

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

## Tests avec comptes authentifiés

```bash
# Node 24.12+ et Java 21 ; téléchargement initial des émulateurs nécessaire
npx playwright install chromium
npm run test:auth
```

La commande construit une version isolée dans `.next-auth`, démarre Auth et
Realtime Database avec `firebase.emulators.json`, crée sept comptes fictifs
et sème la base locale. Elle lance ensuite `playwright.auth.config.ts` sur
le port 3102. Aucun compte Google, compte de service ou abonnement de
production n'est nécessaire. Les émulateurs sont arrêtés à la fin.

Les scénarios de `authenticated/` vérifient les paliers gratuit, Basic,
Premium et expiré, les droits administrateur/vendeur, l'e-mail vérifié,
le catalogue sans contenu payant, le thème Premium, la consommation des
minutes de formation et l'isolation des notifications. Un navigateur
se connecte réellement à Auth et retrouve sa session dans l'application.
Les règles RTDB sont chargées : lecture privée et écriture administrateur
restent interdites au SDK client. Les tests publient aussi un livre via
l'API, lancent deux workers concurrents et vérifient la livraison unique
ainsi que la relance réservée aux administrateurs.
Les rappels sont aussi vérifiés avec des crons concurrents, une session
reprogrammée, un abonnement prolongé et une activation d'accès atomique.
`firebase-cost.spec.ts` vérifie le badge indexé, la lecture incrémentale des
messages, l'invalidation du catalogue et l'arrêt des sondages en page masquée.

Le mode émulateur exige `FIREBASE_TEST_MODE=true`, le projet
`demo-asrar-test` et les ports de boucle locale prévus. Il refuse Vercel et
les configurations partielles. `scripts/auth-test-env.cjs` retire les
identifiants serveur et VAPID de ses processus enfants. La CSP locale
n'est ajoutée que dans cette compilation de test ; le build normal reste
séparé. Ne pas définir ces variables sur un hébergement.

Le preload `scripts/emulator-proxy.cjs` corrige les transports locaux des
outils Firebase qui ignorent `NO_PROXY` : seuls les ports des émulateurs
contournent le proxy. La copie RTDB embarquée dans firebase-admin 14 exige
une adaptation en mémoire de son option de proxy, vérifiée au chargement.
Les connexions Internet conservent le proxy hérité.

FCM ne propose pas d'émulateur : tout envoi externe est refusé dans ce
mode. Les accusés par appareil, erreurs transitoires et suppressions des
jetons expirés sont testés avec des fournisseurs simulés dans Vitest.
La réception effective Web Push/Android doit être vérifiée sur des
appareils de recette. La popup OAuth Google, WhatsApp, les générateurs
premium et les parcours multi-utilisateurs Zikr complets restent à
compléter en recette ; ces tests ne les simulent pas comme réussis.

`zz-commerce-account.spec.ts` vérifie les prix serveur, les transitions vendeur
dans l’interface, les droits, l’export du compte et les fenêtres au clavier.
Le lien WhatsApp est inspecté sans contacter son destinataire.

`ui-layout.spec.ts` vérifie le rappel d’échéance sur mobile, les cibles du
menu, les noms longs, les deux thèmes, les erreurs de notifications et la
place réservée au clavier et aux safe areas de la discussion.

`all-views.spec.ts` parcourt les 35 vues en clair/sombre à 320/1440 px et
vérifie les styles après navigation, les reprises réseau, les brouillons de
commentaire et d’avis, les neuf carrés calculés et la suppression vendeur.
