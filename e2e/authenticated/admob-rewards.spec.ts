import { test, expect } from './fixtures';
const { app } = require('../../server/grant');
async function installAdMob(page: any, completed = true) {
  await page.addInitScript(({ completed }) => {
    (window as any).androidBridge = { postMessage() {} };
    (window as any).__adMobShows = 0;
    (window as any).Capacitor = {
      isNativePlatform: () => true, getPlatform: () => 'android', isPluginAvailable: (name: string) => name === 'UnityAds',
      PluginHeaders: [{ name: 'UnityAds', methods: ['getCapabilities', 'prepareActionAd', 'showRewarded'].map(name => ({ name, rtype: 'promise' })) }],
      nativePromise: async (_plugin: string, method: string, options: any) => {
        if (method === 'getCapabilities') return { adMobRewards: true, mediation: 'admob', legacyRewards: false, privacyRequired: false };
        if (method === 'showRewarded') {
          (window as any).__adMobShows++;
          if (completed) await fetch('/__test-admob-reward', { method: 'POST', body: JSON.stringify({ serverId: options.serverId }) });
          return { shown: true, completed };
        }
      },
    };
  }, { completed });
}
async function bindReward(page: any) {
  // Test-only transport intercepted by Playwright; no such endpoint exists in production.
  await page.route('**/__test-admob-reward', async (route: any) => {
    const { serverId } = route.request().postDataJSON();
    const separator = serverId.lastIndexOf('.'), uid = serverId.slice(0, separator), nonce = serverId.slice(separator + 1);
    const ref = app().database().ref('adRewards/' + uid + '/' + nonce);
    const session = (await ref.once('value')).val();
    await ref.update({ rewarded: true, rewardedAt: Date.now(), oid: 'emulated-google-callback' });
    expect(session.provider).toBe('admob');
    await route.fulfill({ json: { ok: true } });
  });
}
test('AdMob : un compte gratuit débloque une seule action après dix confirmations serveur', async ({ page, login }) => {
  await installAdMob(page); await login('free'); await bindReward(page); await page.goto('/asrar');
  await page.getByRole('button', { name: /Secret de test/i }).click();
  const ad = page.getByRole('button', { name: 'Regarder une publicité', exact: true });
  for (let points = 1; points <= 10; points++) {
    await expect(ad).toBeEnabled();
    await ad.click();
    if (points < 10) {
      await expect(page.getByText(new RegExp(`^${points} / 10 points`))).toBeVisible();
      await expect(page.locator('.secret-detail')).toHaveCount(0);
    }
  }
  await expect(page.locator('.secret-detail')).toBeVisible();
  await page.getByRole('button', { name: 'Retour', exact: true }).click();
  await page.getByRole('button', { name: /Secret de test/i }).click();
  await expect(ad).toBeVisible();
  expect(await page.evaluate(() => (window as any).__adMobShows)).toBe(10);
});
test('AdMob : fermer une publicité sans récompense laisse l’action verrouillée', async ({ page, login }) => {
  await installAdMob(page, false); await login('free'); await bindReward(page); await page.goto('/asrar');
  await page.getByRole('button', { name: /Secret de test/i }).click();
  await page.getByRole('button', { name: 'Regarder une publicité', exact: true }).click();
  await expect(page.locator('.secret-detail')).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Abonnement', exact: true })).toBeVisible();
});
test('AdMob : les abonnés conservent leur accès sans publicité', async ({ page, login }) => {
  await installAdMob(page); await login('basic'); await page.goto('/wafq/carre/6');
  await page.getByLabel('Nombre', { exact: true }).fill('111');
  await page.getByRole('button', { name: 'Calculer', exact: true }).click();
  await expect(page.locator('.kz-grid .kz-cell')).toHaveCount(36);
  expect(await page.evaluate(() => (window as any).__adMobShows)).toBe(0);
});
