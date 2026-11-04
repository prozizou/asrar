import { test, expect } from './fixtures';
import { mockActionCreative } from './helpers/ad-creative';
const { app } = require('../../server/grant');
const { accounts } = require('./accounts.cjs');
const freeKey = accounts.free.email.replace(/\./g, ',');
const freePaths = ['purchased_user/' + freeKey, 'allowedUsers/' + freeKey];
let savedFree: Record<string, unknown> = {};
// Other suites exercise subscription activation with this fixture account.
// Strict ad scenarios must begin with an actually unsubscribed account.
test.beforeEach(async () => {
  const db = app().database(); savedFree = {};
  for (const path of freePaths) savedFree[path] = (await db.ref(path).once('value')).val();
  await db.ref().update(Object.fromEntries(freePaths.map(path => [path, null])));
});
test.afterEach(async () => { await app().database().ref().update(savedFree); });

async function calculator(page: any, login: any, role = 'free') {
  await login(role); await page.goto('/wafq/carre/6'); await page.waitForLoadState('networkidle');
  await page.getByLabel('Nombre', { exact: true }).fill('111');
}

test('une bannière absente et un onglet ouvert ne débloquent rien, même après le délai', async ({ page, login }) => {
  await calculator(page, login);
  const popup = page.waitForEvent('popup'); await page.getByRole('button', { name: 'Calculer', exact: true }).click(); await popup;
  const dialog = page.getByRole('dialog', { name: 'Publicité', exact: true });
  await expect(dialog.getByRole('status')).toContainText('Aucune publicité disponible');
  await page.waitForTimeout(5500);
  await expect(dialog.getByRole('button', { name: 'Continuer', exact: true })).toHaveCount(0);
  await expect(page.locator('.kz-grid')).toHaveCount(0);
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(page.locator('.kz-grid')).toHaveCount(0);
});

test('chaque calcul exige un nouvel affichage visible et les doubles clics ne partagent pas une autorisation', async ({ page, login }) => {
  await login('free'); await mockActionCreative(page); await page.goto('/wafq/carre/6'); await page.waitForLoadState('networkidle');
  await page.getByLabel('Nombre', { exact: true }).fill('111');
  const popup = page.waitForEvent('popup'); await page.getByRole('button', { name: 'Calculer', exact: true }).dblclick(); await (await popup).close();
  const ad = page.getByRole('dialog', { name: 'Publicité', exact: true });
  await expect(ad.getByRole('status')).toContainText('Gardez la publicité visible');
  await expect(page.locator('.kz-grid')).toHaveCount(0);
  await ad.getByRole('button', { name: 'Continuer', exact: true }).click({ timeout: 10000 });
  await expect(page.locator('.kz-grid .kz-cell')).toHaveCount(36);
  const first = await page.locator('.kz-grid').innerText();
  await page.getByLabel('Nombre', { exact: true }).fill('222');
  const second = page.waitForEvent('popup'); await page.getByRole('button', { name: 'Calculer', exact: true }).click(); await (await second).close();
  await expect(ad).toBeVisible(); expect(await page.locator('.kz-grid').innerText()).toBe(first);
  await ad.getByRole('button', { name: 'Continuer', exact: true }).click({ timeout: 10000 });
  await expect(page.locator('.kz-grid')).not.toHaveText(first);
});

test('le temps passé en arrière-plan ne compte pas comme une publicité regardée', async ({ page, login }) => {
  await login('free'); await mockActionCreative(page); await page.goto('/wafq/carre/6'); await page.waitForLoadState('networkidle');
  await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (window as any).__adHidden ? 'hidden' : 'visible' }));
  await page.evaluate(() => { (window as any).__adHidden = true; });
  await page.getByLabel('Nombre', { exact: true }).fill('111'); const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Calculer', exact: true }).click(); await (await popup).close();
  const ad = page.getByRole('dialog', { name: 'Publicité', exact: true }); await expect(ad.getByRole('status')).toContainText('Gardez');
  await page.waitForTimeout(5500); await expect(ad.getByRole('button', { name: 'Continuer', exact: true })).toHaveCount(0);
  await page.evaluate(() => { (window as any).__adHidden = false; });
  await ad.getByRole('button', { name: 'Continuer', exact: true }).click({ timeout: 10000 });
  await expect(page.locator('.kz-grid .kz-cell')).toHaveCount(36);
});

for (const result of [{ shown: false, reason: 'no_fill' }, { shown: true, completed: false }, { shown: true, completed: true }]) {
  test(`Android exige une publicité complète : ${JSON.stringify(result)}`, async ({ page, login }) => {
    await page.addInitScript((reply) => {
      (window as any).androidBridge = { postMessage: () => {} };
      (window as any).Capacitor = {
        isNativePlatform: () => true, getPlatform: () => 'android', isPluginAvailable: (name: string) => name === 'UnityAds',
        PluginHeaders: [{ name: 'UnityAds', methods: [{ name: 'showInterstitial', rtype: 'promise' }] }],
        nativePromise: async () => reply,
      };
    }, result);
    await calculator(page, login); await page.evaluate(() => { const original = Date.now; Date.now = () => original() + 61000; });
    await page.getByRole('button', { name: 'Calculer', exact: true }).click();
    if (result.completed === true) {
      await expect(page.locator('.kz-grid .kz-cell')).toHaveCount(36);
      await page.getByLabel('Nombre', { exact: true }).fill('222'); await page.getByRole('button', { name: 'Calculer', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Publicité nécessaire' })).toContainText('prochaine publicité');
    } else {
      await expect(page.getByRole('dialog', { name: 'Publicité nécessaire' })).toBeVisible(); await expect(page.locator('.kz-grid')).toHaveCount(0);
    }
  });
}

test('un abonné valide continue sans publicité ni attente', async ({ page, login }) => {
  await calculator(page, login, 'premium'); const popups: string[] = []; page.on('popup', (tab) => popups.push(tab.url()));
  await page.getByRole('button', { name: 'Calculer', exact: true }).click(); await expect(page.locator('.kz-grid .kz-cell')).toHaveCount(36);
  expect(popups).toEqual([]); await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('le chargement du script sans création de publicité ne suffit pas', async ({ page, login }) => {
  await login('free');
  await page.route('https://bicea.org/22/**', (route) => route.fulfill({ contentType: 'application/javascript', body: '/* aucune annonce */' }));
  await page.goto('/wafq/carre/6'); await page.waitForLoadState('networkidle');
  await page.getByLabel('Nombre', { exact: true }).fill('111'); const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Calculer', exact: true }).click(); await (await popup).close();
  const dialog = page.getByRole('dialog', { name: 'Publicité', exact: true });
  await page.waitForTimeout(5500); await expect(dialog.getByRole('button', { name: 'Continuer', exact: true })).toHaveCount(0);
  await expect(page.locator('.kz-grid')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Choisir un abonnement sans publicités' }).click();
  await expect(page.getByRole('dialog', { name: 'Retirer les publicités', exact: true })).toBeVisible();
  await expect(page.locator('.kz-grid')).toHaveCount(0);
});

test('un popup bloqué ne suffit jamais, mais un bloc réellement chargé et visible permet de continuer', async ({ page, login }) => {
  await login('free'); await mockActionCreative(page); await page.goto('/wafq/carre/6'); await page.waitForLoadState('networkidle');
  await page.evaluate(() => { window.open = () => null; });
  await page.getByLabel('Nombre', { exact: true }).fill('111'); await page.getByRole('button', { name: 'Calculer', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Publicité', exact: true });
  await expect(page.locator('.kz-grid')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Continuer', exact: true }).click({ timeout: 10000 });
  await expect(page.locator('.kz-grid .kz-cell')).toHaveCount(36);
});
