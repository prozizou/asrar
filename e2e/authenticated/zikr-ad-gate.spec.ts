import { test, expect } from './fixtures';
const { app } = require('../../server/grant');
const { accounts } = require('./accounts.cjs');

// Zikr collectif : une vidéo récompensée à regarder tous les 100 grains pour continuer
// (application Android, comptes sans abonnement) ; le compteur est figé jusque-là. Aucune régie
// réelle : le SDK et le rappel signé sont simulés, comme dans admob-rewards.spec.ts.
const GID = 'zikr-ad-gate';
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
      PluginHeaders: [{ name: 'UnityAds', methods: ['getCapabilities', 'prepareActionAd', 'showRewarded', 'preloadRewarded', 'cancelRewarded'].map(name => ({ name, rtype: 'promise' })) }],
      nativePromise: async (_plugin: string, method: string, options: any) => {
        if (method === 'getCapabilities') return { adMobRewards: true, rewardedPreload: true, rewardedSilentLoading: true, mediation: 'admob', legacyRewards: false, privacyRequired: false };
        if (method === 'preloadRewarded') { ((window as any).__preloadCalls ||= []).push(options.enabled); return; }
        // « Annuler » de la page : la demande native en attente se termine en « cancelled ».
        if (method === 'cancelRewarded') { (window as any).__releaseAd?.({ shown: false, completed: false, reason: 'cancelled' }); return; }
        if (method === 'showRewarded') {
          (window as any).__adMobShows++;
          (window as any).__lastShowOptions = options;
          // Vidéo qui ne s'ouvre pas encore : la page affiche son attente jusqu'à « Annuler ».
          if ((window as any).__adMobHold) return new Promise((resolve) => { (window as any).__releaseAd = resolve; });
          // Comme le vrai pont Android : aucune annonce → résolu (sans rejet) avec la raison.
          if ((window as any).__adMobFail) return { shown: false, completed: false, reason: 'no_fill' };
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
const lockedTap = (page: any) => page.getByRole('button', { name: /Compteur en pause/ });
const gate = (page: any) => page.getByRole('dialog', { name: 'Vidéo pour continuer le comptage' });
// Le chapelet ignore les appuis trop rapprochés (rebond) : on les espace comme une vraie récitation.
async function tapTimes(page: any, count: number) {
  for (let i = 0; i < count; i++) { await tap(page).click(); await page.waitForTimeout(250); }
}

async function reachHundred(page: any) {
  await expect(tap(page)).toBeVisible({ timeout: 20000 });
  await expect(tap(page)).toContainText('98');
  await tapTimes(page, 1);
  await expect(tap(page)).toContainText('99');
  await expect(gate(page)).toHaveCount(0);
  await tapTimes(page, 1);
  await expect(gate(page)).toBeVisible();
}

test('au 100e grain le compteur est figé et la vidéo ne démarre que sur « Regarder »', async ({ page, login }) => {
  test.setTimeout(120_000);
  await installAdMob(page); await page.setViewportSize({ width: 390, height: 850 });
  await login('free'); await bindReward(page); await page.goto('/zikr?item=' + GID);
  await reachHundred(page);
  await expect(gate(page)).toContainText('100 grains récités');
  expect(await page.evaluate(() => (window as any).__adMobShows)).toBe(0); // rien ne démarre seul
  const go = gate(page).getByRole('button', { name: 'Regarder la vidéo', exact: true });
  await expect(go).toBeEnabled();
  await page.screenshot({ path: test.info().outputPath('zikr-pub-obligatoire.png') });
  await go.click();
  await expect(page.getByText(/\+1 point gagné/)).toBeVisible({ timeout: 15000 });
  expect(await page.evaluate(() => (window as any).__adMobShows)).toBe(1);
  await expect(gate(page)).toHaveCount(0);
  // Le compteur reprend : 100 → 101.
  await expect(tap(page)).toContainText('100');
  await tapTimes(page, 1);
  await expect(tap(page)).toContainText('101');
});

test('« Plus tard » ferme la fenêtre mais le compteur reste figé, et toucher le chapelet la rouvre', async ({ page, login }) => {
  test.setTimeout(120_000);
  await installAdMob(page); await login('free'); await bindReward(page); await page.goto('/zikr?item=' + GID);
  await reachHundred(page);
  await gate(page).getByRole('button', { name: 'Plus tard', exact: true }).click();
  await expect(gate(page)).toHaveCount(0);
  await expect(lockedTap(page)).toContainText('100');
  await lockedTap(page).click();
  await expect(gate(page)).toBeVisible();
  await expect(gate(page)).toContainText('100 grains récités');
  expect(await page.evaluate(() => (window as any).__adMobShows)).toBe(0);
  await gate(page).getByRole('button', { name: 'Plus tard', exact: true }).click();
  await lockedTap(page).click({ force: true });
  await expect(lockedTap(page)).toContainText('100'); // aucun grain compté pendant la pause
});

test('le verrou survit à une fermeture de la page : on le retrouve en rouvrant le groupe', async ({ page, login }) => {
  test.setTimeout(120_000);
  await installAdMob(page); await login('free'); await bindReward(page); await page.goto('/zikr?item=' + GID);
  await reachHundred(page);
  // L'application retire « ?item= » de l'adresse : un rechargement revient à la liste des zikrs.
  await page.reload();
  await page.goto('/zikr?item=' + GID);
  await expect(gate(page)).toBeVisible({ timeout: 20000 });
  await expect(gate(page)).toContainText('100 grains récités');
});

test('sans vidéo disponible, le verrou est levé après deux échecs : jamais d’enfermement', async ({ page, login }) => {
  test.setTimeout(120_000);
  await installAdMob(page); await login('free'); await bindReward(page); await page.goto('/zikr?item=' + GID);
  await reachHundred(page);
  await page.evaluate(() => { (window as any).__adMobFail = true; });
  const go = gate(page).getByRole('button', { name: 'Regarder la vidéo', exact: true });
  await expect(go).toBeEnabled();
  await go.click();
  await expect(gate(page)).toContainText('Vidéo indisponible');
  await expect(gate(page)).toBeVisible(); // premier échec : on peut réessayer
  await gate(page).getByRole('button', { name: 'Réessayer', exact: true }).click();
  await expect(page.getByText(/vous pouvez continuer/)).toBeVisible({ timeout: 15000 });
  await expect(gate(page)).toHaveCount(0);
  await expect(tap(page)).toContainText('100');
  await tapTimes(page, 1);
  await expect(tap(page)).toContainText('101');
});

test('un abonné n’est jamais verrouillé', async ({ page, login }) => {
  test.setTimeout(120_000);
  await installAdMob(page); await login('basic'); await page.goto('/zikr?item=' + GID);
  await expect(tap(page)).toBeVisible({ timeout: 20000 });
  await expect(tap(page)).toContainText('98');
  await tapTimes(page, 4);
  await expect(tap(page)).toContainText('102');
  await expect(gate(page)).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__adMobShows)).toBe(0);
});

test('le préchargement de la vidéo est activé pour un compte sans abonnement', async ({ page, login }) => {
  test.setTimeout(60_000);
  await installAdMob(page); await login('free'); await page.goto('/zikr?item=' + GID);
  await expect(tap(page)).toBeVisible({ timeout: 20000 });
  await expect.poll(() => page.evaluate(() => (window as any).__preloadCalls || [])).toContain(true);
});

test('le préchargement n’est jamais activé pour un abonné', async ({ page, login }) => {
  test.setTimeout(60_000);
  await installAdMob(page); await login('basic'); await page.goto('/zikr?item=' + GID);
  await expect(tap(page)).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(2500);
  expect(await page.evaluate(() => (window as any).__preloadCalls || [])).not.toContain(true);
});

test('l’attente de la vidéo s’affiche dans la fenêtre de l’application, sans fenêtre Android, et « Annuler » garde le verrou', async ({ page, login }) => {
  test.setTimeout(120_000);
  await installAdMob(page); await page.setViewportSize({ width: 390, height: 850 });
  await login('free'); await bindReward(page); await page.goto('/zikr?item=' + GID);
  await reachHundred(page);
  await page.evaluate(() => { (window as any).__adMobHold = true; });
  const go = gate(page).getByRole('button', { name: 'Regarder la vidéo', exact: true });
  await expect(go).toBeEnabled();
  await go.click();
  await expect(gate(page).getByText('Préparation de votre vidéo…')).toBeVisible();
  // L'appel natif suit l'ouverture de la session serveur : on l'attend.
  await expect.poll(() => page.evaluate(() => (window as any).__lastShowOptions?.silent)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('zikr-pub-attente.png') });
  await gate(page).getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(gate(page).getByText('Préparation de votre vidéo…')).toHaveCount(0);
  await expect(gate(page).getByRole('button', { name: 'Regarder la vidéo', exact: true })).toBeVisible();
  await expect(gate(page).locator('.sg-ad-msg')).toHaveCount(0); // annuler n'affiche aucune erreur
  await expect(gate(page)).toContainText('100 grains récités'); // le verrou reste
});
