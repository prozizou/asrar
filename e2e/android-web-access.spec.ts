// Le site reste accessible dans les navigateurs Android, sans installation obligatoire.
import { test, expect } from '@playwright/test';

const ANDROID = 'Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
test('Android : première visite, rechargement et liens directs restent sur le site', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: ANDROID, viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const storeNavigations: string[] = [];
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame() && /play\.google\.com|^intent:/.test(frame.url())) storeNavigations.push(frame.url());
  });
  // Toute redirection accidentelle reste simulée, sans ouvrir un vrai store.
  await context.route('https://play.google.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>Google Play</title><p>ASRAR PRO</p>' }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: /continuer avec google/i })).toBeVisible();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('dialog', { name: 'ASRAR PRO sur Google Play' })).toHaveCount(0);
  // Les visiteurs ayant utilisé l’ancien écran peuvent aussi revenir au site.
  await page.evaluate(() => {
    localStorage.setItem('asrar_android_web_until', '1');
    sessionStorage.setItem('asrar_android_play_redirected', '1');
  });
  await page.reload();
  await expect(page.getByRole('button', { name: /continuer avec google/i })).toBeVisible();
  await expect(page).toHaveURL('/');
  await page.goto('/wafq/carre/5');
  await expect(page.getByRole('button', { name: /continuer avec google/i })).toBeVisible();
  await expect(page).toHaveURL('/wafq/carre/5');
  await expect(page.getByRole('dialog', { name: 'ASRAR PRO sur Google Play' })).toHaveCount(0);
  expect(storeNavigations).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('site-android-sans-verrou.png'), fullPage: false });
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
