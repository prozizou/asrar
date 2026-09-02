// playwright.config.ts — E2E des parcours qui NE dépendent PAS d'un vrai
// compte Google (voir e2e/README.md pour le pourquoi de ce périmètre et le
// chantier de suite — émulateur Firebase Auth — qui débloquera le reste).
//
// `next start` sert l'app RÉELLEMENT compilée (pas `next dev` : les en-têtes
// de sécurité, le service worker et le comportement des redirects doivent
// être vérifiés tels qu'ils seront en production) — voir la commande `build`
// dans le job e2e de .github/workflows/ci.yml, exécutée AVANT `npm run
// test:e2e` (webServer ne fait que démarrer le serveur déjà construit, pas le
// builder à chaque run : un `next build` complet à chaque lancement de test
// serait beaucoup trop lent en boucle locale).
import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Mêmes valeurs factices que le job `lint-and-build` (.github/workflows/ci.yml)
// pour `next build` — ici en plus utilisées au RUNTIME par `next start`,
// contrairement au build : nécessaires pour que les routes /api répondent
// (même de façon générique, ex. 401) au lieu de planter au premier appel à
// l'Admin SDK. Voir server/access.js : verifyUser() attrape toute erreur
// (JSON de service account invalide inclus) et la traduit en 401 « Session
// invalide » — d'où des valeurs factices suffisantes pour les tests d'API
// qui vérifient un REJET (jamais un accès réel).
const RUNTIME_ENV = {
  FIREBASE_SERVICE_ACCOUNT: '{}',
  FIREBASE_DB_URL: 'https://example.firebaseio.com',
  SITE_URL: BASE_URL,
  SUPER_ADMIN_EMAIL: 'admin@example.com',
  WHATSAPP_NUMBER: '000000000',
  CLOUDINARY_CLOUD_NAME: 'example',
  CLOUDINARY_API_KEY: 'example',
  CLOUDINARY_API_SECRET: 'example',
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // 'html' (jamais ouvert automatiquement en CI) : c'est lui qui alimente
  // l'artefact playwright-report/ téléversé par le job e2e — sans ça, un
  // échec en CI ne laisse aucune trace exploitable (capture, trace Playwright)
  // au-delà du texte brut des logs.
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // `next start` seul : le build est un step CI séparé (voir en-tête).
    command: `npx next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: RUNTIME_ENV,
  },
});
