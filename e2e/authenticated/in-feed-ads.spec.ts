// Encarts publicitaires dans les listes (components/InFeedAd.js) : un encart
// toutes les 6 cartes, jamais en fin de liste, jamais pour un abonné.
import { test, expect } from './fixtures';

async function android(page: any) {
  await page.addInitScript(() => {
    (window as any).androidBridge = { postMessage: () => {} };
    (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', isPluginAvailable: () => false };
  });
}

async function manyProducts(page: any, count: number) {
  await page.route('https://bicea.org/**', (route: any) => route.fulfill({ contentType: 'application/javascript', body: '/* encart de test */' }));
  await page.route('**/api/list-content', async (route: any) => {
    if (route.request().postDataJSON()?.kind !== 'product') return route.continue();
    const response = await route.fetch();
    const data = await response.json();
    const base = data.items[0];
    data.items = Array.from({ length: count }, (_, i) => ({ ...base, _key: `${base._key}-${i}` }));
    return route.fulfill({ response, json: data });
  });
}

test('application Android : un encart toutes les 6 cartes du Marché, jamais en fin de liste', async ({ page, login }) => {
  await android(page);
  await login('free');
  await manyProducts(page, 12);
  await page.goto('/');
  await expect(page.locator('.prod-card')).toHaveCount(12);
  const ads = page.locator('.prod-list > aside.in-feed-ad');
  // 12 cartes affichées : encart après la 6e, pas après la 12e (fin de liste).
  await expect(ads).toHaveCount(1);
  await expect(ads.first().getByText('Publicité', { exact: true })).toBeVisible();
  // Placé juste après la 6e carte.
  expect(await page.evaluate(() => {
    const list = document.querySelector('.prod-list')!;
    const children = Array.from(list.children);
    return children.indexOf(list.querySelector('aside.in-feed-ad')!) - children.indexOf(list.querySelectorAll('.prod-card')[5]);
  })).toBe(1);
  await ads.first().scrollIntoViewIfNeeded();
  await expect(ads.first().locator('iframe[sandbox]')).toHaveCount(1);
});

test('compte abonné ou site Android : aucun encart', async ({ page, login }) => {
  await android(page);
  await login('basic');
  await manyProducts(page, 12);
  await page.goto('/');
  await expect(page.locator('.prod-card')).toHaveCount(12);
  await expect(page.locator('aside.in-feed-ad')).toHaveCount(0);
});
