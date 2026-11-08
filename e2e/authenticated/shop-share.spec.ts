import { test, expect } from './fixtures';
import { vendorKey } from '../../lib/market';
const { accounts } = require('./accounts.cjs');

const sellerKey = vendorKey({ email: accounts.seller.email });

test('le lien de boutique affiche un aperçu public sans données privées et mène au Marché', async ({ page }) => {
  const res = await page.request.get('/s?k=shop&i=' + sellerKey, { headers: { 'user-agent': 'WhatsApp/2.0' } });
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain('<meta property="og:title" content="Boutique de test — ASRAR PRO">');
  expect(html).toContain('Boutique du Marché ASRAR PRO');
  expect(html).toContain('"/?shop=' + sellerKey + '"');
  expect(html).not.toContain(accounts.seller.email);
  expect(html).not.toContain('00000000');
  const unknown = await (await page.request.get('/s?k=shop&i=v_inconnue')).text();
  expect(unknown).toContain('<meta property="og:title" content="ASRAR PRO — Sciences mystiques">');
});

test('le vendeur partage sa boutique et un visiteur l’ouvre depuis le lien', async ({ page, login }) => {
  await page.addInitScript(() => {
    (window as any).__shared = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: any) => { (window as any).__shared.push(data); } });
  });
  await login('seller'); await page.goto('/boutique');
  await page.getByRole('button', { name: 'Partager ma boutique', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__shared.length)).toBe(1);
  const shared = await page.evaluate(() => (window as any).__shared[0]);
  const url = new URL(shared.url);
  expect(url.pathname).toBe('/s');
  expect(url.searchParams.get('k')).toBe('shop');
  expect(url.searchParams.get('i')).toBe(sellerKey);
  expect(shared.text).toContain('Boutique de test');
  await page.setViewportSize({ width: 360, height: 800 });
  await page.screenshot({ path: test.info().outputPath('boutique-share-360.png') });
});

test('un visiteur ouvre la boutique partagée et peut la repartager', async ({ page, login }) => {
  await page.addInitScript(() => {
    (window as any).__shared = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: any) => { (window as any).__shared.push(data); } });
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await login('premium'); await page.goto('/?shop=' + sellerKey);
  await expect(page.getByRole('button', { name: 'Partager cette boutique', exact: true })).toBeVisible();
  await expect(page.locator('.prod-grid')).toContainText(/Produit de test/i);
  await expect(page).toHaveURL(/\/$/);
  await page.screenshot({ path: test.info().outputPath('marche-shop-360.png') });
  await page.getByRole('button', { name: 'Partager cette boutique', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__shared.at(-1)?.url || '')).toContain('k=shop&i=' + sellerKey);
});

test('une boutique inconnue ne casse pas le Marché', async ({ page, login }) => {
  await login('premium'); await page.goto('/?shop=v_inconnue');
  await expect(page.getByText('Cette boutique n\'est plus disponible.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Marché ASRAR PRO' })).toBeVisible();
});
