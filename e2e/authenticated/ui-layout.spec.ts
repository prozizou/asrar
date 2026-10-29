import { test, expect } from './fixtures';
const { app } = require('../../server/grant');

test('le rappel d’abonnement reste compact sur mobile et peut être fermé', async ({ page, login }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login('basic'); await page.goto('/compte');
  const reminder = page.getByRole('status').filter({ hasText: /Votre abonnement expire/ });
  await expect(reminder).toBeVisible();
  const bounds = await reminder.boundingBox(); expect(bounds!.height).toBeLessThan(150);
  const close = reminder.getByRole('button', { name: 'Masquer le rappel d’abonnement' });
  const closeBounds = await close.boundingBox();
  expect(closeBounds!.width).toBeGreaterThanOrEqual(44); expect(closeBounds!.height).toBeGreaterThanOrEqual(44);
  const text = await reminder.locator('.expiry-banner-text').boundingBox(); expect(text!.width).toBeGreaterThan(220);
  await close.click(); await expect(reminder).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Tableau de bord', exact: true })).toBeVisible();
});

test('le menu de profil conserve ses commandes accessibles avec un nom long', async ({ page, login }) => {
  await app().auth().updateUser('fixture-free', { displayName: 'مستخدم avec un nom particulièrement long pour vérifier le retour à la ligne' });
  await page.setViewportSize({ width: 320, height: 700 });
  await login('free'); await page.goto('/menu');
  const trigger = page.getByRole('button', { name: /Profil et réglages/ });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Menu', exact: true });
  await expect(dialog.getByRole('link', { name: 'Mon compte et mes données' })).toBeVisible();
  const control = dialog.getByRole('switch'); const bounds = await control.boundingBox();
  expect(bounds!.width).toBeGreaterThanOrEqual(44); expect(bounds!.height).toBeGreaterThanOrEqual(44);
  await control.click(); await expect(control).toHaveAttribute('aria-checked', 'true');
  const worker = await (await page.request.get('/sw.js')).text();
  const version = worker.match(/SW_VERSION\s*=\s*['"]([^'"]+)/)![1];
  await expect(dialog.getByText(version, { exact: true })).toBeVisible();
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
});

test('une erreur initiale des notifications affiche une reprise au lieu d’un chargement infini', async ({ page, login }) => {
  await login('basic'); let unavailable = true;
  await page.route('**/api/notifications', async (route) => {
    if (route.request().postDataJSON()?.action === 'list' && unavailable) return route.fulfill({ status: 503, json: { error: 'Indisponible' } });
    return route.fallback();
  });
  await page.goto('/notifications');
  await expect(page.getByRole('heading', { name: 'Notifications indisponibles' })).toBeVisible();
  await expect(page.locator('.view-state-loading')).toHaveCount(0);
  unavailable = false; await page.getByRole('button', { name: 'Réessayer', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Filtrer les notifications' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Notifications indisponibles' })).toHaveCount(0);
});

test('le filtre des notifications est local et un échec du marquage conserve les non-lues', async ({ page, login }) => {
  const ref = app().database().ref('notifications/fixture-basic');
  await ref.set({ unread: { title: 'Publication à consulter', body: 'Un nouveau document est disponible.', targetUrl: '/bibliotheque', type: 'document', createdAt: Date.now(), read: false },
    read: { title: 'Publication consultée', targetUrl: '/bibliotheque', type: 'document', createdAt: Date.now() - 1000, read: true } });
  await login('basic'); let failMark = true, reads = 0;
  await page.route('**/api/notifications', async (route) => {
    const action = route.request().postDataJSON()?.action;
    if (action === 'list') reads++;
    if (action === 'markAllRead' && failMark) return route.fulfill({ status: 503, json: { error: 'Panne simulée' } });
    return route.fallback();
  });
  await page.goto('/notifications'); await expect(page.getByText('Publication à consulter', { exact: true })).toBeVisible();
  const before = reads; await page.getByRole('button', { name: /Non lues/ }).click();
  await expect(page.getByText('Publication consultée', { exact: true })).toHaveCount(0); expect(reads).toBe(before);
  await page.getByRole('button', { name: 'Tout marquer comme lu' }).click();
  await expect(page.getByRole('heading', { name: 'Action non confirmée' })).toBeVisible();
  await expect(page.getByText('Publication à consulter', { exact: true })).toBeVisible();
  expect((await ref.child('unread/read').once('value')).val()).toBe(false);
  failMark = false; await page.getByRole('button', { name: 'Tout marquer comme lu' }).click();
  await expect(page.getByText('Vos notifications ont été marquées comme lues.')).toBeVisible();
  expect((await ref.child('unread/read').once('value')).val()).toBe(true);
  await expect(page.getByRole('heading', { name: 'Vous êtes à jour' })).toBeVisible();
});

test('la discussion respecte les safe areas Android et libère la place du clavier', async ({ page, login, postAs }) => {
  const result = await postAs('free', 'zikr', { action: 'create', name: 'Recette interface mobile', presetId: 'soubhanallah', target: 100 });
  expect(result.status()).toBe(200); const { id } = await result.json();
  await page.setViewportSize({ width: 360, height: 780 }); await login('free'); await page.goto('/zikr?item=' + id);
  await page.getByRole('button', { name: 'Discussion', exact: true }).click();
  await page.evaluate(() => { document.documentElement.style.setProperty('--safe-area-inset-top', '28px'); document.documentElement.style.setProperty('--safe-area-inset-bottom', '24px'); });
  const top = await page.locator('.zk-detail-topbar').boundingBox(); // The compact header starts immediately after the system inset.
  expect(top!.y).toBeGreaterThanOrEqual(28);
  expect(top!.height).toBeGreaterThanOrEqual(56);
  expect(top!.height).toBeLessThanOrEqual(64);
  const nav = page.getByRole('navigation', { name: 'Navigation du zikr collectif' });
  expect((await nav.boundingBox())!.height).toBe(92);
  const input = page.getByRole('textbox', { name: 'Écrire un message', exact: true });
  await input.fill('Première ligne\nDeuxième ligne\nTroisième ligne\nQuatrième ligne');
  await expect.poll(async () => (await input.boundingBox())!.height).toBeGreaterThan(60);
  expect((await input.boundingBox())!.height).toBeLessThanOrEqual(120);
  await page.evaluate(() => document.documentElement.classList.add('kb-open'));
  await expect(nav).toBeHidden();
  expect(await page.locator('.zk-chat-input-row').evaluate((node) => parseFloat(getComputedStyle(node).paddingBottom))).toBeLessThan(24);
});

test('compte, commandes et notifications restent lisibles sur mobile et ordinateur dans les deux thèmes', async ({ page, login }) => {
  await login('free');
  for (const width of [360, 1440]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate((value) => localStorage.setItem('asrar_theme', value), theme);
    for (const path of ['/compte', '/commandes', '/notifications']) {
      await page.goto(path); await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Tableau de bord', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator('html').getAttribute('data-theme')).toBe(theme);
    }
  }
});
