import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('un lien externe ouvre une seule fenêtre sans faire quitter l’application', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /continuer avec google/i })).toBeVisible();
  // Exécuter le véritable helper client dans Chromium, sans identité ni
  // service externe. Le script de test reste uniquement dans ce navigateur.
  const source = readFileSync('lib/externalWindow.js', 'utf8');
  await page.addScriptTag({ content: source.replace('export function', 'function') + '\nwindow.reserveForTest = reserveExternalWindow;' });
  const opened = page.waitForEvent('popup');
  await page.evaluate(() => {
    const destination = (window as any).reserveForTest();
    destination.navigate('/manifest.json');
  });
  const popup = await opened;
  await popup.waitForURL('**/manifest.json');
  expect(await popup.evaluate(() => window.opener)).toBeNull();
  await expect(page).toHaveURL('/');
  await popup.close();
});
