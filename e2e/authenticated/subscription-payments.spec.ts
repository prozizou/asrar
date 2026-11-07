import { test, expect } from './fixtures';
import { ADS_PAUSED, FREE_FOR_ALL } from '../../lib/plans';
const { app } = require('../../server/grant');
const { accounts } = require('./accounts.cjs');
const freeKey = accounts.free.email.replace(/\./g, ',');
const isolatedPaths = ['purchased_user/' + freeKey, 'allowedUsers/' + freeKey, 'secret_billing'];
let saved: Record<string, unknown> = {};
test.beforeEach(async () => {
  const db = app().database(); saved = {};
  for (const path of isolatedPaths) saved[path] = (await db.ref(path).once('value')).val();
  await db.ref().update(Object.fromEntries(isolatedPaths.map((path) => [path, null])));
});
test.afterEach(async () => { await app().database().ref().update(saved); });

async function openPlans(page: any) {
  await page.goto('/compte');
  await page.getByText('Choisir ou renouveler mon abonnement', { exact: true }).click();
}

test('le dialogue mobile propose une seule durée et deux choix de paiement, sans défilement', async ({ page, login }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await login('free');
  if (ADS_PAUSED) {
    await page.goto('/wafq/carre/6');
    await page.getByLabel('Nombre', { exact: true }).fill('111');
    await page.getByRole('button', { name: 'Calculer', exact: true }).click();
  } else {
    await page.goto('/menu'); await page.getByRole('button', { name: /Retirer les publicités/ }).click();
  }
  const dialog = page.getByRole('dialog', { name: ADS_PAUSED ? 'Abonnement' : 'Retirer les publicités', exact: true });
  await expect(dialog.getByRole('combobox', { name: 'Durée et prix' })).toBeVisible();
  const choices = dialog.getByRole('group', { name: 'Wave ou WhatsApp' });
  await expect(choices.getByRole('button')).toHaveCount(2);
  await expect(choices.getByRole('button', { name: 'Wave', exact: true })).toBeInViewport({ ratio: 1 });
  await expect(choices.getByRole('button', { name: 'WhatsApp', exact: true })).toBeInViewport({ ratio: 1 });
  const size = await page.locator('.subscription-dialog').evaluate((node) => ({ height: node.clientHeight, contentHeight: node.scrollHeight, width: node.clientWidth, contentWidth: node.scrollWidth }));
  expect(size.contentHeight).toBeLessThanOrEqual(size.height);
  expect(size.contentWidth).toBeLessThanOrEqual(size.width);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('les trois formules ouvrent les liens Wave exacts sans activer un abonnement', async ({ page, login, postAs }) => {
  await login('free'); await openPlans(page);
  await page.context().route('https://pay.wave.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>Wave test</title>' }));
  for (const [planId, amount] of [['sub_3m', '15000'], ['sub_6m', '25000'], ['sub_1y', '45000']]) {
    await page.getByRole('combobox', { name: 'Durée et prix' }).selectOption(planId);
    const popup = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Wave', exact: true }).click();
    const tab = await popup; await tab.waitForURL('https://pay.wave.com/m/M_sn_6W-tuxFYYkZa/c/sn/?amount=' + amount);
    await tab.close();
    await expect(page.getByRole('status')).toContainText('Après votre paiement Wave');
    await expect(page.getByRole('group', { name: 'Wave ou WhatsApp' }).getByRole('button')).toHaveCount(2);
    const access = await (await postAs('free', 'check-access')).json(); expect(access.allowed).toBe(FREE_FOR_ALL); expect(access.adFree).toBe(false);
  }
});

test('la confirmation WhatsApp identifie le compte et la durée sans confirmer le paiement', async ({ page, login }) => {
  await login('free'); await openPlans(page);
  await page.context().route('https://pay.wave.com/**', (route) => route.fulfill({ body: 'Wave test' }));
  await page.getByRole('combobox', { name: 'Durée et prix' }).selectOption('sub_6m');
  let popup = page.waitForEvent('popup'); await page.getByRole('button', { name: 'Wave', exact: true }).click();
  await (await popup).close();
  await page.context().route('**/api/wa?text=**', (route) => route.fulfill({ body: 'WhatsApp test' }));
  popup = page.waitForEvent('popup'); await page.getByRole('button', { name: 'WhatsApp', exact: true }).click();
  const tab = await popup;
  await tab.waitForURL(/\/api\/wa\?text=/);
  const text = new URL(tab.url()).searchParams.get('text') || '';
  expect(text).toContain('25 000 FCFA'); expect(text).toContain(accounts.free.email); expect(text).toContain('Paiement à vérifier : Wave');
  await tab.close();
  await page.getByRole('combobox', { name: 'Durée et prix' }).selectOption('sub_3m');
  popup = page.waitForEvent('popup'); await page.getByRole('button', { name: 'WhatsApp', exact: true }).click();
  const otherTab = await popup; await otherTab.waitForURL(/\/api\/wa\?text=/);
  const otherText = new URL(otherTab.url()).searchParams.get('text') || '';
  expect(otherText).toContain('15 000 FCFA');
  expect(otherText).not.toContain('Paiement à vérifier : Wave');
  await otherTab.close();
});

test('Android ouvre Wave par navigation externe sans demander le plugin Billing', async ({ page, login }) => {
  await page.addInitScript(() => {
    (window as any).androidBridge = { postMessage: () => {} };
    (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', isPluginAvailable: () => false };
  });
  await login('free'); await openPlans(page);
  await page.route('https://pay.wave.com/**', (route) => route.fulfill({ body: 'Wave test' }));
  const popups: string[] = []; page.on('popup', (p) => popups.push(p.url()));
  await page.getByRole('combobox', { name: 'Durée et prix' }).selectOption('sub_1y');
  await page.getByRole('button', { name: 'Wave', exact: true }).click();
  await page.waitForURL('https://pay.wave.com/m/M_sn_6W-tuxFYYkZa/c/sn/?amount=45000');
  expect(popups).toEqual([]);
});

test('les anciennes actions Billing restent retirées et les recettes demandent un abonnement', async ({ postAs }) => {
  await app().database().ref('secret_billing/settings').set({ enabled: true });
  try {
    for (const action of ['offer', 'verify', 'activate', 'configuration', 'configure']) {
      const response = await postAs('free', 'secret-purchases', { action }); expect(response.status()).toBe(410);
    }
    const detail = await postAs('free', 'get-content', { kind: 'secret', cat: 'protection', key: 'secret1' });
    expect(detail.status()).toBe(FREE_FOR_ALL ? 200 : 403);
    const access = await (await postAs('free', 'check-access')).json(); expect(access).toMatchObject({ allowed: FREE_FOR_ALL, adFree: false });
  } finally { await app().database().ref('secret_billing').remove(); }
});

test('la demande WhatsApp directe conserve les trois tarifs et le portail fonctionne au clavier sur mobile', async ({ page, login }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await login('free'); await openPlans(page);
  await page.context().route('**/api/wa?text=**', (route) => route.fulfill({ body: 'WhatsApp test' }));
  for (const [planId, price] of [['sub_3m', '15 000'], ['sub_6m', '25 000'], ['sub_1y', '45 000']]) {
    await page.getByRole('combobox', { name: 'Durée et prix' }).selectOption(planId);
    const popup = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'WhatsApp', exact: true }).focus();
    await page.keyboard.press('Enter');
    const tab = await popup; await tab.waitForURL(/\/api\/wa\?text=/);
    expect(new URL(tab.url()).searchParams.get('text')).toContain(price + ' FCFA'); await tab.close();
  }
  await page.screenshot({ path: test.info().outputPath('abonnements-mobile.png'), fullPage: true });
});
