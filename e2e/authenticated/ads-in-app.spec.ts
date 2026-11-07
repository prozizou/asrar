// Pubs Adsterra : formats du site et formats de l'application Android, qui
// charge ce même site (components/AdsterraAds.js).
import { test, expect } from './fixtures';
import { ADS_PAUSED } from '../../lib/plans';
test.skip(ADS_PAUSED, 'Les formats publicitaires sont en pause ; couverture dans ads-paused.spec.ts.');

const SOCIAL_BAR = 'script[src*="/14/56ff6c976d7d264a3439f37c7d6ca8e5"]';
const NATIVE_BANNER = '#container-00684bfc5a8802ccbed95bf0c1fa25a3';

test('site : bannières, Native Banner, Social Bar et offre « Retirer les publicités »', async ({ page, login }) => {
  await login('free');
  await page.goto('/menu');
  await expect(page.locator(NATIVE_BANNER)).toHaveCount(1);
  await expect(page.locator(SOCIAL_BAR)).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Retirer les publicités/ })).toBeVisible();
});

test('application Android : bannières et Native Banner, sans Social Bar ni offre WhatsApp', async ({ page, login }) => {
  await page.addInitScript(() => {
    // Ce que voit le site dans l'application : le pont natif Android, d'où
    // @capacitor/core déduit la plateforme (getPlatformId → 'android').
    (window as any).androidBridge = { postMessage: () => {} };
    (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', isPluginAvailable: () => false };
  });
  await login('free');
  await page.goto('/menu');
  await expect(page.locator(NATIVE_BANNER)).toHaveCount(1);
  await expect(page.locator('[aria-label="Publicité"]').first()).toBeAttached();
  await expect(page.locator(SOCIAL_BAR)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Retirer les publicités/ })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'ASRAR PRO sur Google Play' })).toHaveCount(0);
});

test('compte abonné : aucune pub, ni sur le site ni dans l’application', async ({ page, login }) => {
  await login('basic');
  await page.goto('/menu');
  await page.waitForLoadState('networkidle');
  await expect(page.locator(NATIVE_BANNER)).toHaveCount(0);
  await expect(page.locator(SOCIAL_BAR)).toHaveCount(0);
});
