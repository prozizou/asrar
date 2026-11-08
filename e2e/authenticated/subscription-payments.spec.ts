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

async function confirmMethod(page: any, method: 'Wave' | 'WhatsApp') {
  await page.getByRole('radio', { name: method, exact: true }).check();
  await page.getByRole('button', { name: 'Continuer avec ' + method, exact: true }).click();
}

async function openPlans(page: any) {
  await page.goto('/compte');
  await page.getByText('Choisir ou renouveler mon abonnement', { exact: true }).click();
}

test('le dialogue mobile propose une seule durée et trois choix de paiement, sans défilement initial', async ({ page, login }) => {
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
  const choices = dialog.getByRole('radiogroup', { name: 'Moyen de paiement' });
  await expect(choices.getByRole('radio')).toHaveCount(3);
  await expect(choices.locator('.subscription-method').filter({ has: page.getByRole('radio', { name: 'Wave', exact: true }) })).toBeInViewport({ ratio: 1 });
  await expect(choices.locator('.subscription-method').filter({ has: page.getByRole('radio', { name: 'WhatsApp', exact: true }) })).toBeInViewport({ ratio: 1 });
  await expect(choices.locator('.subscription-method').filter({ has: page.getByRole('radio', { name: 'PI-SPI', exact: true }) })).toBeInViewport({ ratio: 1 });
  await expect.poll(() => page.locator('.subscription-dialog').evaluate(node => getComputedStyle(node).transform)).toBe('none');
  const size = await page.locator('.subscription-dialog').evaluate((node) => ({ height: node.clientHeight, contentHeight: node.scrollHeight, width: node.clientWidth, contentWidth: node.scrollWidth }));
  expect(size.contentHeight).toBeLessThanOrEqual(size.height);
  expect(size.contentWidth).toBeLessThanOrEqual(size.width);
  await expect(dialog.getByRole('button', { name: 'Continuer avec Wave', exact: true })).toBeInViewport({ ratio: 1 });
  const box = await page.locator('.subscription-dialog').boundingBox();
  expect(Math.abs(box!.y + box!.height - 568)).toBeLessThan(1);
  // Fond opaque du thème courant (carte --glass-bg), jamais transparent.
  const sheet = await page.locator('.subscription-dialog').evaluate((node) => {
    const probe = document.createElement('div'); probe.style.background = 'var(--glass-bg)'; document.body.appendChild(probe);
    const expected = getComputedStyle(probe).backgroundColor; probe.remove();
    return { actual: getComputedStyle(node).backgroundColor, expected };
  });
  expect(sheet.actual).toBe(sheet.expected); expect(sheet.actual).not.toMatch(/rgba\(.*, 0\)|transparent/);
  await page.screenshot({ path: test.info().outputPath('payment-sheet-320.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('les trois formules ouvrent les liens Wave exacts sans activer un abonnement', async ({ page, login, postAs }) => {
  await login('free'); await openPlans(page);
  await page.context().route('https://pay.wave.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>Wave test</title>' }));
  for (const [planId, amount] of [['sub_3m', '15000'], ['sub_6m', '25000'], ['sub_1y', '45000']]) {
    await page.getByRole('combobox', { name: 'Durée et prix' }).selectOption(planId);
    const popup = page.waitForEvent('popup');
    await confirmMethod(page, 'Wave');
    const tab = await popup; await tab.waitForURL('https://pay.wave.com/m/M_sn_6W-tuxFYYkZa/c/sn/?amount=' + amount);
    await tab.close();
    await expect(page.getByRole('status')).toContainText('Après votre paiement Wave');
    await expect(page.getByRole('radiogroup', { name: 'Moyen de paiement' }).getByRole('radio')).toHaveCount(3);
    const access = await (await postAs('free', 'check-access')).json(); expect(access.allowed).toBe(FREE_FOR_ALL); expect(access.adFree).toBe(false);
  }
});

test('la confirmation WhatsApp identifie le compte et la durée sans confirmer le paiement', async ({ page, login }) => {
  await login('free'); await openPlans(page);
  await page.context().route('https://pay.wave.com/**', (route) => route.fulfill({ body: 'Wave test' }));
  await page.getByRole('combobox', { name: 'Durée et prix' }).selectOption('sub_6m');
  let popup = page.waitForEvent('popup'); await confirmMethod(page, 'Wave');
  await (await popup).close();
  await page.context().route('**/api/wa?text=**', (route) => route.fulfill({ body: 'WhatsApp test' }));
  popup = page.waitForEvent('popup'); await confirmMethod(page, 'WhatsApp');
  const tab = await popup;
  await tab.waitForURL(/\/api\/wa\?text=/);
  const text = new URL(tab.url()).searchParams.get('text') || '';
  expect(text).toContain('25 000 FCFA'); expect(text).toContain(accounts.free.email); expect(text).toContain('Paiement à vérifier : Wave');
  await tab.close();
  await page.getByRole('combobox', { name: 'Durée et prix' }).selectOption('sub_3m');
  popup = page.waitForEvent('popup'); await confirmMethod(page, 'WhatsApp');
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
  await confirmMethod(page, 'Wave');
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
    await page.getByRole('radio', { name: 'WhatsApp', exact: true }).check();
    await page.getByRole('button', { name: 'Continuer avec WhatsApp', exact: true }).focus();
    await page.keyboard.press('Enter');
    const tab = await popup; await tab.waitForURL(/\/api\/wa\?text=/);
    expect(new URL(tab.url()).searchParams.get('text')).toContain(price + ' FCFA'); await tab.close();
  }
  await page.screenshot({ path: test.info().outputPath('abonnements-mobile.png'), fullPage: true });
});


test('les cartes sélectionnent un moyen sans ouvrir de paiement avant Continuer', async ({ page, login, postAs }) => {
  await login('free'); await openPlans(page);
  const popups: string[] = []; page.on('popup', tab => popups.push(tab.url()));
  const wave = page.getByRole('radio', { name: 'Wave', exact: true });
  const pispi = page.getByRole('radio', { name: 'PI-SPI', exact: true });
  const whatsapp = page.getByRole('radio', { name: 'WhatsApp', exact: true });
  await expect(wave).toBeChecked();
  await wave.focus(); await page.keyboard.press('ArrowRight');
  await expect(pispi).toBeChecked();
  await expect(page.getByRole('button', { name: 'Copier l’alias PI-SPI', exact: true })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(whatsapp).toBeChecked();
  await expect(page.getByRole('button', { name: 'Continuer avec WhatsApp', exact: true })).toBeVisible();
  await wave.check(); await expect(wave).toBeChecked();
  expect(popups).toEqual([]);
  const access = await (await postAs('free', 'check-access')).json();
  expect(access.adFree).toBe(false);
});

test('PI-SPI copie l’alias réel et transmet chaque formule sur WhatsApp sans ouvrir les accès', async ({ page, login, postAs }) => {
  await page.addInitScript(() => {
    (window as any).__copiedAliases = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async (value: string) => { (window as any).__copiedAliases.push(value); },
    } });
  });
  await login('free'); await openPlans(page);
  await page.context().route('**/api/wa?text=**', route => route.fulfill({ body: 'WhatsApp test' }));
  for (const [planId, amount] of [['sub_3m', '15 000'], ['sub_6m', '25 000'], ['sub_1y', '45 000']]) {
    await page.getByRole('combobox', { name: 'Durée et prix' }).selectOption(planId);
    await page.getByRole('radio', { name: 'PI-SPI', exact: true }).check();
    const details = page.getByRole('region', { name: 'Paiement par PI-SPI' });
    await expect(details).toContainText(amount + ' FCFA');
    await expect(details.getByRole('textbox', { name: 'Alias du bénéficiaire' })).toHaveValue('2b26c0d5-7673-46fa-82c8-7c124cc6d33d');
    await page.getByRole('button', { name: 'Copier l’alias PI-SPI', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Alias copié.');
    expect(await page.evaluate(() => (window as any).__copiedAliases.at(-1))).toBe('2b26c0d5-7673-46fa-82c8-7c124cc6d33d');
    const popup = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Envoyer le justificatif sur WhatsApp', exact: true }).click();
    const tab = await popup; await tab.waitForURL(/\/api\/wa\?text=/);
    const message = new URL(tab.url()).searchParams.get('text') || '';
    expect(message).toContain('Paiement à vérifier : PI-SPI');
    expect(message).toContain(amount + ' FCFA'); expect(message).toContain(accounts.free.email);
    expect(message).toContain('Merci de vérifier le paiement reçu');
    await tab.close();
  }
  const access = await (await postAs('free', 'check-access')).json();
  expect(access.adFree).toBe(false); expect(access.allowed).toBe(FREE_FOR_ALL);
  expect((await postAs('free', 'get-content', { kind: 'secret', cat: 'protection', key: 'secret1' })).status()).toBe(FREE_FOR_ALL ? 200 : 403);
});

for (const fallbackWorks of [true, false]) {
  test(`PI-SPI sur Android : copie de repli ${fallbackWorks ? 'réussie' : 'indisponible'} et alias accessible sur petit écran`, async ({ page, login, postAs }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.addInitScript((works) => {
      (window as any).androidBridge = { postMessage: () => {} };
      (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', isPluginAvailable: () => false };
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Clipboard denied'); } } });
      document.execCommand = () => works;
    }, fallbackWorks);
    await login('free'); await page.goto('/wafq/carre/6');
    await page.getByLabel('Nombre', { exact: true }).fill('111');
    await page.getByRole('button', { name: 'Calculer', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Abonnement', exact: true });
    await dialog.getByRole('radio', { name: 'PI-SPI', exact: true }).check();
    await dialog.getByRole('button', { name: 'Copier l’alias PI-SPI', exact: true }).click();
    if (fallbackWorks) await expect(dialog.getByRole('status')).toContainText('Alias copié.');
    else {
      await expect(dialog.getByRole('alert')).toContainText('appuyez longuement sur l’alias');
      await expect(dialog.getByRole('status')).not.toContainText('Alias copié.');
    }
    const alias = dialog.getByRole('textbox', { name: 'Alias du bénéficiaire' });
    await expect(alias).toHaveValue('2b26c0d5-7673-46fa-82c8-7c124cc6d33d');
    expect(await alias.evaluate((node: HTMLTextAreaElement) => node.readOnly)).toBe(true);
    const size = await page.locator('.subscription-dialog').evaluate(node => ({ width: node.clientWidth, content: node.scrollWidth }));
    expect(size.content).toBeLessThanOrEqual(size.width);
    await dialog.getByRole('button', { name: 'Envoyer le justificatif sur WhatsApp', exact: true }).scrollIntoViewIfNeeded();
    await expect(dialog.getByRole('button', { name: 'Envoyer le justificatif sur WhatsApp', exact: true })).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: test.info().outputPath(`pispi-320-${fallbackWorks ? 'copy' : 'fallback'}.png`), fullPage: true });
    const access = await (await postAs('free', 'check-access')).json(); expect(access.adFree).toBe(false);
  });
}

test('Ma Boutique : formule unique à 5 000 FCFA par mois, payable par Wave, PI-SPI ou WhatsApp', async ({ page, login, postAs }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
  });
  await login('premium'); await page.goto('/boutique');
  await page.context().route('https://pay.wave.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>Wave test</title>' }));
  await page.context().route('**/api/wa?text=**', route => route.fulfill({ body: 'WhatsApp test' }));
  const payment = page.locator('.bq-payment');
  await expect(payment).toContainText('1 Mois');
  await expect(payment).toContainText('5 000 FCFA');
  await expect(page.getByRole('combobox', { name: 'Durée et prix' })).toHaveCount(0);
  await expect(payment.getByRole('radiogroup', { name: 'Moyen de paiement' }).getByRole('radio')).toHaveCount(3);

  let popup = page.waitForEvent('popup');
  await confirmMethod(page, 'Wave');
  let tab = await popup; await tab.waitForURL('https://pay.wave.com/m/M_sn_6W-tuxFYYkZa/c/sn/?amount=5000');
  await tab.close();

  await page.getByRole('radio', { name: 'PI-SPI', exact: true }).check();
  await expect(page.getByRole('region', { name: 'Paiement par PI-SPI' })).toContainText('5 000 FCFA');
  await page.getByRole('button', { name: 'Copier l’alias PI-SPI', exact: true }).click();
  popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Envoyer le justificatif sur WhatsApp', exact: true }).click();
  tab = await popup; await tab.waitForURL(/\/api\/wa\?text=/);
  const message = new URL(tab.url()).searchParams.get('text') || '';
  expect(message).toContain('Boutique 1 Mois'); expect(message).toContain('5 000 FCFA');
  expect(message).toContain('Boutique vendeur (Marché)'); expect(message).toContain('Paiement à vérifier : PI-SPI');
  expect(message).not.toContain('sans publicité');
  await tab.close();
  expect((await postAs('premium', 'shop', { action: 'save-shop', shop: { name: 'Interdit' } })).status()).toBe(403);
  await page.screenshot({ path: test.info().outputPath('boutique-payment-360.png'), fullPage: true });
});
