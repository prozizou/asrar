// Le portail d'authentification (components/AuthProvider.js) protège TOUTE
// l'app : Providers.js le monte à la racine (app/layout.js), donc un visiteur
// non connecté ne doit JAMAIS voir autre chose que l'écran de connexion,
// quelle que soit l'URL demandée — y compris une route que le menu ne
// referme plus (Thalsams/Wafq/Tafsir al-Ahlam/Formation, retirées du menu
// mais toujours en place, voir app/menu/page.tsx) : « pas de lien dans le
// menu » ne doit jamais devenir le SEUL mécanisme de protection.
//
// C'est le test qui donne un sens concret à l'affirmation « le paywall
// passe par le serveur, pas seulement le navigateur » (voir lib/access.js) :
// ici on vérifie le comportement réel côté client pour un visiteur qui n'a
// JAMAIS pu obtenir de idToken, pas juste la logique serveur en isolation.
import { test, expect } from '@playwright/test';

// Un échantillon volontairement large : modules gratuits, modules premium, et
// les 4 tuiles masquées du menu (2026-09-02) — toutes doivent réagir pareil.
const ROUTES = [
  '/', '/menu', '/asrar', '/abajad', '/planete', '/combinaisons', '/benefits',
  '/zikr', '/rouwhania', '/bibliotheque', '/parrainage',
  '/alqalam', '/geomancie', // premium
  '/thalsams', '/wafq', '/tafsir', '/formation', // masquées du menu, pages toujours actives
];

test.describe('Portail d’authentification — aucune route ne contourne le login', () => {
  for (const route of ROUTES) {
    test(`${route} affiche l’écran de connexion, jamais le contenu`, async ({ page }) => {
      await page.goto(route);
      // LoginScreen (components/AuthProvider.js) : bouton Google visible.
      await expect(page.getByRole('button', { name: /continuer avec google/i })).toBeVisible({
        timeout: 15_000,
      });
      // Aucun composant applicatif (menu, formulaires des modules) ne doit
      // être monté en parallèle — le portail REMPLACE l'arbre, il ne le
      // superpose pas (voir AuthProvider.js : `if (!user) return <LoginScreen…>`,
      // un retour anticipé, pas un overlay conditionnel).
      await expect(page.locator('.menu-item')).toHaveCount(0);
    });
  }

  test('un jeton fabriqué côté client ne suffit pas à ouvrir /api/check-access', async ({ request }) => {
    // Complète le test ci-dessus côté API : même si quelqu'un contournait le
    // rendu React (DevTools, requête directe), le serveur reste la vraie
    // barrière — cf. e2e/api-auth.spec.ts pour la couverture complète des
    // routes /api.
    const res = await request.post('/api/check-access', { data: {} });
    expect(res.status()).toBe(401);
  });
});
