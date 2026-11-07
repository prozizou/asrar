import { test, expect } from './fixtures';
import { ADS_PAUSED } from '../../lib/plans';
const { app } = require('../../server/grant');
test.skip(!ADS_PAUSED, 'Scénarios spécifiques à la pause des publicités.');

for (const native of [false, true]) {
  for (const role of ['free', 'basic']) {
    test(`${native ? 'Android' : 'site'} : ${role} ne charge aucune publicité et respecte son accès`, async ({ page, login }) => {
      await page.addInitScript((inApp) => {
        (window as any).__adCalls = [];
        if (!inApp) return;
        (window as any).androidBridge = { postMessage: () => {} };
        (window as any).Capacitor = {
          isNativePlatform: () => true, getPlatform: () => 'android', isPluginAvailable: (name: string) => name === 'UnityAds',
          PluginHeaders: [{ name: 'UnityAds', methods: ['getCapabilities', 'prepareActionAd', 'showInterstitial', 'showRewarded'].map(name => ({ name, rtype: 'promise' })) }],
          nativePromise: async (_plugin: string, method: string, options: any) => {
            if (method === 'getCapabilities') return { actionAdPreload: true, privacyRequired: false };
            (window as any).__adCalls.push({ method, enabled: options?.enabled });
            return { shown: true, completed: true };
          },
        };
      }, native);
      const adRequests: string[] = [], popups: string[] = [];
      page.on('request', request => { if (/bicea\.org|arwf\.org|googlesyndication\.com/.test(request.url())) adRequests.push(request.url()); });
      page.on('popup', tab => popups.push(tab.url()));
      await login(role); await page.goto('/wafq/carre/6');
      await page.getByLabel('Nombre', { exact: true }).fill('111');
      await page.getByRole('button', { name: 'Calculer', exact: true }).click();
      if (role === 'free') {
        const dialog = page.getByRole('dialog', { name: 'Abonnement', exact: true });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('radiogroup', { name: 'Wave ou WhatsApp' }).getByRole('radio')).toHaveCount(2);
        await expect(dialog.getByRole('button', { name: /Regarder/ })).toHaveCount(0);
        await expect(page.locator('.kz-grid')).toHaveCount(0);
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'Calculer', exact: true }).click();
        await expect(dialog).toBeVisible();
      } else await expect(page.locator('.kz-grid .kz-cell')).toHaveCount(36);
      expect(adRequests).toEqual([]); expect(popups).toEqual([]);
      await expect(page.locator('[aria-label="Publicité"]')).toHaveCount(0);
      expect(await page.evaluate(() => (window as any).__adCalls.filter((call: any) => call.method !== 'prepareActionAd' || call.enabled !== false))).toEqual([]);
    });
  }
}

test('un ancien passe publicitaire ne donne pas accès au contenu pendant la pause', async ({ postAs }) => {
  const db = app().database(), path = 'adPass/fixture-free';
  const previous = (await db.ref(path).once('value')).val();
  await db.ref(path).set({ until: Date.now() + 60000, uses: 1 });
  try {
    const access = await (await postAs('free', 'check-access')).json();
    expect(access).toMatchObject({ allowed: false, adsEnabled: false, adCredits: 0 });
    expect((await postAs('free', 'get-content', { kind: 'secret', cat: 'protection', key: 'secret1' })).status()).toBe(403);
    expect((await db.ref(path).once('value')).val().uses).toBe(1);
    expect((await postAs('free', 'ad-reward', { action: 'start' })).status()).toBe(503);
    expect((await postAs('expired', 'get-content', { kind: 'secret', cat: 'protection', key: 'secret1' })).status()).toBe(403);
  } finally { await db.ref(path).set(previous); }
});

test('la recette et le modèle étoile proposent aussi Wave ou WhatsApp', async ({ page, login }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login('free'); await page.goto('/asrar');
  await page.getByRole('button', { name: /Secret de test/i }).click();
  const dialog = page.getByRole('dialog', { name: 'Abonnement', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('radiogroup', { name: 'Wave ou WhatsApp' }).getByRole('radio')).toHaveCount(2);
  await expect(page.locator('.secret-detail')).toHaveCount(0);
  await expect.poll(() => page.locator('.subscription-dialog').evaluate(node => getComputedStyle(node).opacity)).toBe('1');
  await page.screenshot({ path: test.info().outputPath('abonnement-action-mobile.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await page.goto('/wafq/carre/5');
  await page.getByRole('radio', { name: 'Étoile 5 branches', exact: true }).check();
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel('Constante magique', { exact: true })).toHaveCount(0);
});

test('une panne de vérification ne demande pas de repayer à un abonné', async ({ page, login }) => {
  await login('basic');
  await page.route('**/api/check-access', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Indisponible"}' }));
  await page.goto('/wafq/carre/6');
  await page.getByLabel('Nombre', { exact: true }).fill('111');
  await page.getByRole('button', { name: 'Calculer', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Connexion trop lente' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Wave', exact: true })).toHaveCount(0);
  await expect(page.locator('.kz-grid')).toHaveCount(0);
});
