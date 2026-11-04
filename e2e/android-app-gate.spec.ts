// Visiteurs Android du site → application Google Play (components/AndroidAppGate.js).
import { test, expect } from '@playwright/test';

const ANDROID = 'Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const PLAY = 'https://play.google.com/store/apps/details?id=com.Asrar';

test('Android : redirection vers Google Play, puis boutons au retour et sortie pour qui ne peut pas installer', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: ANDROID, viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  // Google Play simulé : aucun accès réseau extérieur pendant le test.
  await context.route('https://play.google.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>Google Play</title><p>ASRAR PRO</p>' }));
  await page.goto('/');
  await page.waitForURL(PLAY);

  await page.goBack();
  const gate = page.getByRole('dialog', { name: 'ASRAR PRO sur Google Play' });
  await expect(gate).toBeVisible();
  expect(page.url()).not.toContain('play.google.com'); // pas de seconde redirection dans la même visite
  await expect(gate.getByRole('link', { name: 'Installer depuis Google Play' })).toHaveAttribute('href', PLAY);
  await expect(gate.getByRole('link', { name: 'Ouvrir l’application' })).toHaveAttribute('href', /^intent:\/\/open#Intent;scheme=asrarpro;package=com\.Asrar;/);
  // Le site recharge sa page au démarrage : on réessaie jusqu'à ce qu'elle soit stable.
  await expect(async () => {
    await gate.getByRole('button', { name: 'Je ne peux pas installer l’application' }).click({ timeout: 2000 });
    await expect(gate).toHaveCount(0, { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'ASRAR PRO sur Google Play' })).toHaveCount(0);
  expect(page.url()).not.toContain('play.google.com');
  await context.close();
});

test('iPhone : le site reste disponible, sans redirection', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: IPHONE, viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('dialog', { name: 'ASRAR PRO sur Google Play' })).toHaveCount(0);
  expect(page.url()).not.toContain('play.google.com');
  await context.close();
});
