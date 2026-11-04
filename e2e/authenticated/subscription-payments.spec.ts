import { test, expect } from './fixtures';
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
  await page.getByText('Choisir ou renouveler un abonnement sans publicités', { exact: true }).click();
}

test('le carrousel mobile permet de comparer les formules avec les flèches, les repères et le clavier', async ({ page, login }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login('free'); await openPlans(page);
  const carousel = page.getByRole('region', { name: 'Formules d’abonnement' });
  const previous = page.getByRole('button', { name: 'Formule précédente' });
  const next = page.getByRole('button', { name: 'Formule suivante' });
  await expect(previous).toBeDisabled();
  await next.click();
  await expect(page.getByRole('button', { name: 'Voir la formule 6 Mois' })).toHaveAttribute('aria-pressed', 'true');
  await expect(carousel.getByRole('group', { name: 'Abonnement 6 Mois', exact: true })).toBeInViewport({ ratio: .95 });
  await page.getByRole('button', { name: 'Voir la formule 1 An' }).click();
  await expect(next).toBeDisabled();
  await expect(carousel.getByRole('group', { name: 'Abonnement 1 An', exact: true })).toBeInViewport({ ratio: .95 });
  await carousel.focus(); await page.keyboard.press('Home');
  await expect(previous).toBeDisabled();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Voir la formule 6 Mois' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('End');
  await expect(next).toBeDisabled();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await previous.click();
  await expect(carousel.getByRole('group', { name: 'Abonnement 6 Mois', exact: true })).toBeInViewport({ ratio: .95 });
});

test('les trois formules ouvrent les liens Wave exacts sans activer un abonnement', async ({ page, login, postAs }) => {
  await login('free'); await openPlans(page);
  await page.context().route('https://pay.wave.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>Wave test</title>' }));
  for (const [duration, amount] of [['3 Mois', '15000'], ['6 Mois', '25000'], ['1 An', '45000']]) {
    const popup = page.waitForEvent('popup');
    await page.getByRole('button', { name: `Payer ${duration} avec Wave` }).click();
    const tab = await popup; await tab.waitForURL('https://pay.wave.com/m/M_sn_6W-tuxFYYkZa/c/sn/?amount=' + amount);
    await tab.close();
    await expect(page.getByRole('button', { name: 'Faire vérifier mon paiement sur WhatsApp' })).toBeVisible();
    const access = await (await postAs('free', 'check-access')).json(); expect(access.allowed).toBe(true); expect(access.adFree).toBe(false);
  }
});

test('la confirmation WhatsApp identifie le compte et la durée sans confirmer le paiement', async ({ page, login }) => {
  await login('free'); await openPlans(page);
  await page.context().route('https://pay.wave.com/**', (route) => route.fulfill({ body: 'Wave test' }));
  let popup = page.waitForEvent('popup'); await page.getByRole('button', { name: 'Payer 6 Mois avec Wave' }).click();
  await (await popup).close();
  await page.context().route('**/api/wa?text=**', (route) => route.fulfill({ body: 'WhatsApp test' }));
  popup = page.waitForEvent('popup'); await page.getByRole('button', { name: 'Faire vérifier mon paiement sur WhatsApp' }).click();
  const tab = await popup;
  await tab.waitForURL(/\/api\/wa\?text=/);
  const text = new URL(tab.url()).searchParams.get('text') || '';
  expect(text).toContain('25 000 FCFA'); expect(text).toContain(accounts.free.email); expect(text).toContain('Paiement à vérifier : Wave');
  await tab.close();
});

test('Android ouvre Wave par navigation externe sans demander le plugin Billing', async ({ page, login }) => {
  await page.addInitScript(() => {
    (window as any).androidBridge = { postMessage: () => {} };
    (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', isPluginAvailable: () => false };
  });
  await login('free'); await openPlans(page);
  await page.route('https://pay.wave.com/**', (route) => route.fulfill({ body: 'Wave test' }));
  const popups: string[] = []; page.on('popup', (p) => popups.push(p.url()));
  await page.getByRole('button', { name: 'Payer 1 An avec Wave' }).click();
  await page.waitForURL('https://pay.wave.com/m/M_sn_6W-tuxFYYkZa/c/sn/?amount=45000');
  expect(popups).toEqual([]);
});

test('les anciennes actions Billing répondent 410 et l’accès aux recettes reste gratuit', async ({ postAs }) => {
  await app().database().ref('secret_billing/settings').set({ enabled: true });
  try {
    for (const action of ['offer', 'verify', 'activate', 'configuration', 'configure']) {
      const response = await postAs('free', 'secret-purchases', { action }); expect(response.status()).toBe(410);
    }
    const detail = await postAs('free', 'get-content', { kind: 'secret', cat: 'protection', key: 'secret1' });
    expect(detail.status()).toBe(200);
    const access = await (await postAs('free', 'check-access')).json(); expect(access).toMatchObject({ allowed: true, adFree: false });
  } finally { await app().database().ref('secret_billing').remove(); }
});

test('la demande WhatsApp directe conserve les trois tarifs et le portail fonctionne au clavier sur mobile', async ({ page, login }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await login('free'); await openPlans(page);
  for (const duration of ['3 Mois', '6 Mois', '1 An']) await expect(page.getByRole('button', { name: `Demander ${duration} sur WhatsApp` })).toBeVisible();
  await page.context().route('**/api/wa?text=**', (route) => route.fulfill({ body: 'WhatsApp test' }));
  const popup = page.waitForEvent('popup'); const button = page.getByRole('button', { name: 'Demander 3 Mois sur WhatsApp' });
  await button.focus(); await page.keyboard.press('Enter');
  const tab = await popup; await tab.waitForURL(/\/api\/wa\?text=/);
  expect(new URL(tab.url()).searchParams.get('text')).toContain('15 000 FCFA'); await tab.close();
  await page.screenshot({ path: test.info().outputPath('abonnements-mobile.png'), fullPage: true });
});
