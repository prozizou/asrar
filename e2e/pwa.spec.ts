// Vérifie les critères d'installabilité PWA (bannière « Installer
// l'application ») décrits en tête de public/sw.js : manifeste servi, service
// worker enregistré, gestionnaire 'fetch' présent — sans ces trois éléments,
// certains navigateurs proposent silencieusement de ne PAS afficher la
// bannière d'installation, une régression qu'aucun test unitaire ne peut
// détecter (public/sw.js n'est pas exécuté par vitest, c'est un script de
// navigateur).
import { test, expect } from '@playwright/test';

test.describe('PWA — installabilité', () => {
  test('le manifeste est servi avec les champs requis', async ({ request }) => {
    const res = await request.get('/manifest.json');
    expect(res.status()).toBe(200);
    const manifest = await res.json();
    expect(manifest.name).toBeTruthy();
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(Array.isArray(manifest.icons) && manifest.icons.length).toBeTruthy();
  });

  test('le service worker s’enregistre sur une page réelle', async ({ page }) => {
    // La page d'accueil (comme toute page) affiche le LoginScreen pour un
    // visiteur anonyme (voir e2e/auth-gate.spec.ts) — sans importance ici :
    // PwaGate.js enregistre le service worker pour TOUS les visiteurs,
    // connectés ou non (voir son commentaire d'en-tête).
    await page.goto('/');
    // clients.claim() déclenche le rechargement initial de PwaGate. Chaque
    // tentative relit l'enregistrement dans le document courant.
    await expect.poll(async () => {
      try {
        return await page.evaluate(async () => {
          const reg = await navigator.serviceWorker.getRegistration();
          return reg?.active?.scriptURL ?? '';
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('Execution context was destroyed')) return '';
        throw error;
      }
    }, { timeout: 10000 }).toContain('/sw.js');
  });

  test('sw.js répond et déclare une version', async ({ request }) => {
    const res = await request.get('/sw.js');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/const SW_VERSION = 'v[\d.]+'/);
  });
});
