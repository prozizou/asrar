import { test, expect } from '@playwright/test';

test('la politique publique est consultable sans compte et donne un contact de suppression', async ({ page }) => {
  const response = await page.goto('/confidentialite.html');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: 'Politique de confidentialité' })).toBeVisible();
  await expect(page.getByRole('button', { name: /continuer avec google/i })).toHaveCount(0);
  await expect(page.locator('#contact a[href="mailto:asrarlilahi66@gmail.com"]')).toBeVisible();
  await expect(page.locator('#contact a[href="tel:+221773500595"]')).toBeVisible();
  await expect(page.locator('#droits')).toContainText('faire une demande sans vous connecter');
  await expect(page.locator('script')).toHaveCount(0);
});

test('la politique reste accessible sur Android sans être envoyée vers Google Play', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, serviceWorkers: 'block', viewport: { width: 360, height: 800 },
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36' });
  const page = await context.newPage();
  const navigations: string[] = [];
  page.on('request', (request) => { if (request.isNavigationRequest()) navigations.push(request.url()); });
  await page.goto('/confidentialite.html');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/\/confidentialite\.html$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Politique de confidentialité' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(navigations.some((url) => url.includes('play.google.com'))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('confidentialite-android.png'), fullPage: false });
  await context.close();
});

test('la politique est accessible depuis la connexion sans ouvrir les fonctions protégées', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /continuer avec google/i })).toBeVisible({ timeout: 15000 });
  await page.getByRole('link', { name: 'Politique de confidentialité', exact: true }).click();
  await expect(page).toHaveURL(/\/confidentialite\.html$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Politique de confidentialité' })).toBeVisible();
  await expect(page.locator('.menu-item')).toHaveCount(0);
});
