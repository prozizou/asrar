import { test, expect } from './fixtures';
const { app } = require('../../server/grant');
const { accounts } = require('./accounts.cjs');

// Zikr collectif : invitation FACULTATIVE à regarder une publicité récompensée tous les
// 100 grains (application Android, comptes sans abonnement). Aucune régie réelle : le SDK
// et le rappel signé sont simulés, comme dans admob-rewards.spec.ts.
const GID = 'zikr-ad-offer';
const freeKey = accounts.free.email.replace(/\./g, ',');
const isolatedPaths = ['purchased_user/' + freeKey, 'allowedUsers/' + freeKey, 'secret_billing'];
let saved: Record<string, unknown> = {};
test.beforeEach(async () => {
  const db = app().database(); saved = {};
  for (const path of isolatedPaths) saved[path] = (await db.ref(path).once('value')).val();
  await db.ref().update(Object.fromEntries(isolatedPaths.map((path) => [path, null])));
  await db.ref('zikr_groups/' + GID).set({ name: 'Zikr pub test', arabic: 'لا إله إلا الله', transliteration: 'La ilaha illa Allah',
    presetId: 'libre', target: 100000, total: 0, membersCount: 2, ownerUid: 'fixture-admin', ownerEmail: 'admin@asrar.test', approved: true });
  await db.ref('zikr_members/' + GID).set({
    'fixture-admin': { name: 'Créateur', email: 'admin@asrar.test', fait: 0, joinedAt: Date.now() },
    // 98 grains déjà récités : le compteur local est recalé dessus au chargement ; deux appuis franchissent la centaine.
    'fixture-free': { name: 'Zizou', email: 'free@asrar.test', fait: 98, joinedAt: Date.now() },
    'fixture-basic': { name: 'Abonné', email: 'basic@asrar.test', fait: 98, joinedAt: Date.now() },
  });
});
test.afterEach(async () => {
  const db = app().database();
  await db.ref().update(saved);
  await db.ref('zikr_groups/' + GID).remove(); await db.ref('zikr_members/' + GID).remove();
});

async function installAdMob(page: any) {
  await page.addInitScript(() => {
    (window as any).androidBridge = { postMessage() {} };
    (window as any).__adMobShows = 0;
    (window as any).Capacitor = {
      isNativePlatform: () => true, getPlatform: () => 'android', isPluginAvailable: (name: string) => name === 'UnityAds',
      PluginHeaders: [{ name: 'UnityAds', methods: ['getCapabilities', 'prepareActionAd', 'showRewarded'].map(name => ({ name, rtype: 'promise' })) }],
      nativePromise: async (_plugin: string, method: string, options: any) => {
        if (method === 'getCapabilities') return { adMobRewards: true, mediation: 'admob', legacyRewards: false, privacyRequired: false };
        if (method === 'showRewarded') {
          (window as any).__adMobShows++;
          await fetch('/__test-admob-reward', { method: 'POST', body: JSON.stringify({ serverId: options.serverId }) });
          return { shown: true, completed: true };
        }
      },
    };
  });
}
// Après la connexion : le fixture `login` réinitialise les routes de la page.
async function bindReward(page: any) {
  await page.route('**/__test-admob-reward', async (route: any) => {
    const { serverId } = route.request().postDataJSON();
    const separator = serverId.lastIndexOf('.'), uid = serverId.slice(0, separator), nonce = serverId.slice(separator + 1);
    await app().database().ref('adRewards/' + uid + '/' + nonce).update({ rewarded: true, rewardedAt: Date.now(), oid: 'emulated-google-callback' });
    await route.fulfill({ json: { ok: true } });
  });
}
const tap = (page: any) => page.getByRole('button', { name: 'Toucher pour égrener un grain' });
// Le chapelet ignore les appuis trop rapprochés (rebond) : on les espace comme une vraie récitation.
async function tapTimes(page: any, count: number) {
  for (let i = 0; i < count; i++) { await tap(page).click(); await page.waitForTimeout(250); }
}

test('une invitation facultative apparaît au 100e grain et la vidéo ne démarre que sur « Regarder »', async ({ page, login }) => {
  test.setTimeout(120_000);
  await installAdMob(page); await page.setViewportSize({ width: 390, height: 850 });
  await login('free'); await bindReward(page); await page.goto('/zikr?item=' + GID);
  await expect(tap(page)).toBeVisible({ timeout: 20000 });
  await expect(tap(page)).toContainText('98');
  await tapTimes(page, 1);
  await expect(tap(page)).toContainText('99');
  await expect(page.locator('.zk-ad-offer')).toHaveCount(0);
  await tapTimes(page, 1);
  await expect(tap(page)).toContainText('100');
  const offer = page.locator('.zk-ad-offer');
  await expect(offer).toContainText('100 grains');
  expect(await page.evaluate(() => (window as any).__adMobShows)).toBe(0); // rien ne démarre seul
  // La bannière est flottante : elle ne déplace pas le chapelet sous le pouce.
  expect(await offer.evaluate((node: HTMLElement) => getComputedStyle(node).position)).toBe('fixed');
  const go = offer.getByRole('button', { name: 'Regarder', exact: true });
  await expect(go).toBeEnabled();
  await page.screenshot({ path: test.info().outputPath('zikr-pub-invitation.png') });
  await go.click();
  // Session, vidéo simulée puis confirmation serveur : plus long que l'attente par défaut.
  await expect(page.getByText(/\+1 point gagné/)).toBeVisible({ timeout: 20000 });
  expect(await page.evaluate(() => (window as any).__adMobShows)).toBe(1);
  await expect(offer.getByRole('button', { name: 'Regarder', exact: true })).toHaveCount(0);
});

test('« Plus tard » referme l’invitation sans lancer de vidéo', async ({ page, login }) => {
  test.setTimeout(120_000);
  await installAdMob(page); await login('free'); await page.goto('/zikr?item=' + GID);
  await expect(tap(page)).toBeVisible({ timeout: 20000 });
  await tapTimes(page, 2);
  await page.locator('.zk-ad-offer').getByRole('button', { name: 'Plus tard' }).click();
  await expect(page.locator('.zk-ad-offer')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__adMobShows)).toBe(0);
});

test('un abonné ne reçoit aucune invitation', async ({ page, login }) => {
  test.setTimeout(120_000);
  await installAdMob(page); await login('basic'); await page.goto('/zikr?item=' + GID);
  await expect(tap(page)).toBeVisible({ timeout: 20000 });
  await expect(tap(page)).toContainText('98');
  await tapTimes(page, 2);
  await expect(tap(page)).toContainText('100');
  await page.waitForTimeout(1500);
  await expect(page.locator('.zk-ad-offer')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__adMobShows)).toBe(0);
});
