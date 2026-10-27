import { test, expect } from './fixtures';
const { app } = require('../../server/grant');

test('les demandes WhatsApp prennent le prix serveur et restent distinctes du paiement', async ({ postAs, request }) => {
  const first = await postAs('free', 'orders', { action: 'create', productKey: 'product1', requestId: 'commerce-real-request-001', prix: 1, vendeur: 'Fausse boutique', status: 'paid' });
  expect(first.status()).toBe(200);
  const data = await first.json(), id = data.order._key;
  expect(data.order).toMatchObject({ prix: 1000, sellerUid: 'fixture-seller', status: 'whatsapp_request' });
  expect(data.order._private).toBeUndefined();
  const duplicate = await (await postAs('free', 'orders', { action: 'create', productKey: 'product1', requestId: 'commerce-real-request-001' })).json();
  expect(duplicate.order._key).toBe(id);
  const contact = await request.get(data.contactUrl, { maxRedirects: 0 });
  expect(contact.status()).toBe(302);
  expect(contact.headers().location).toContain('1000');
  expect((await app().database().ref('orders_v2/' + id + '/status').once('value')).val()).toBe('whatsapp_request');
  expect((await postAs('free', 'orders', { action: 'transition', orderId: id, status: 'paid' })).status()).toBe(403);
  expect((await postAs('premium', 'orders', { action: 'transition', orderId: id, status: 'confirmed' })).status()).toBe(403);
  expect((await postAs('seller', 'orders', { action: 'transition', orderId: id, status: 'delivered' })).status()).toBe(409);
  for (const status of ['confirmed', 'paid', 'delivered']) expect((await postAs('seller', 'orders', { action: 'transition', orderId: id, status })).status()).toBe(200);
  const sellerOrders = await (await postAs('seller', 'orders', { action: 'seller-list' })).json();
  expect(sellerOrders.items.find((o: any) => o._key === id).status).toBe('delivered');
  expect((await (await postAs('premium', 'orders')).json()).items.some((o: any) => o._key === id)).toBe(false);
  const forged = await request.get('/api/wa?order=' + id + '&token=' + 'a'.repeat(64), { maxRedirects: 0 });
  expect(forged.status()).toBe(403);
});

test('le compte affiche le vrai forfait et exporte les données sans secrets', async ({ page, login, postAs }) => {
  await login('basic'); await page.goto('/compte');
  await expect(page.getByRole('heading', { name: 'Mon compte', exact: true })).toBeVisible();
  await expect(page.getByText('Forfait 3 Mois', { exact: true })).toBeVisible();
  await expect(page.getByText(/Échéance/)).toBeVisible();
  const summary = await (await postAs('basic', 'account')).json();
  expect(summary.subscription.level).toBe(15000);
  expect(summary.subscription.purchase).toBeUndefined();
  const exported = await postAs('basic', 'account', { action: 'export' });
  expect(exported.status()).toBe(200);
  expect((await exported.json()).account.uid).toBe('fixture-basic');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger mes données disponibles' }).click();
  expect((await download).suggestedFilename()).toBe('asrar-mes-donnees.json');
});

test('la boutique confirme chaque étape dans son interface et l’acheteur retrouve le suivi', async ({ page, login, postAs }) => {
  const created = await postAs('free', 'orders', { action: 'create', productKey: 'product1', requestId: 'commerce-seller-interface-001' });
  expect(created.status()).toBe(200);
  const { order } = await created.json();
  await login('seller'); await page.goto('/commandes?vue=boutique');
  const card = page.getByRole('article').filter({ hasText: order._key.slice(0, 12) });
  await expect(card.getByText('Demande WhatsApp', { exact: true })).toBeVisible();
  for (const action of ['Confirmer la commande', 'Déclarer le paiement reçu', 'Déclarer la livraison']) {
    await card.getByRole('button', { name: action, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Confirmer le changement de statut' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Note de suivi, visible par l’acheteur').fill('Étape vérifiée en recette.');
    await dialog.getByRole('button', { name: 'Confirmer cette étape' }).click();
    await expect(dialog).toHaveCount(0);
  }
  await expect(card.getByText('Livrée', { exact: true })).toBeVisible();
  const history = await (await postAs('free', 'orders')).json();
  expect(history.items.find((item: any) => item._key === order._key).status).toBe('delivered');
});

test('la fenêtre de suppression reste accessible au clavier et restitue le focus', async ({ page, login, postAs }) => {
  await login('basic'); await page.goto('/compte');
  const trigger = page.getByRole('button', { name: 'Demander la suppression de mon compte' });
  await expect(trigger).toBeVisible(); await trigger.focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Demander la suppression du compte' });
  await expect(dialog).toBeVisible();
  const email = dialog.getByLabel('Saisissez votre adresse e-mail pour confirmer');
  await expect(email).toBeFocused();
  for (let i = 0; i < 5; i++) { await page.keyboard.press('Tab'); expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true); }
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  await trigger.click(); await email.fill('basic@asrar.test');
  await dialog.getByRole('button', { name: 'Envoyer ma demande de suppression' }).click();
  await expect(page.getByText('Votre demande est enregistrée et sera examinée par l’administration.')).toBeVisible();
  const summary = await (await postAs('basic', 'account')).json();
  expect(summary.privacyRequest).toMatchObject({ kind: 'delete', status: 'pending' });
  expect(summary.account.uid).toBe('fixture-basic');
});

test('les préférences personnelles sont appliquées côté serveur', async ({ postAs }) => {
  expect((await postAs('premium', 'account', { action: 'settings', analytics: false, pushEnabled: false })).status()).toBe(200);
  expect((await postAs('premium', 'push-fcm-register', { action: 'register', platform: 'android', token: 'emulator-device-should-not-register' })).status()).toBe(409);
  const summary = await (await postAs('premium', 'account')).json();
  expect(summary.settings).toEqual({ analytics: false, pushEnabled: false });
  expect((await postAs('premium', 'account', { action: 'privacy-list' })).status()).toBe(403);
  expect((await postAs('admin', 'account', { action: 'privacy-list' })).status()).toBe(200);
});

test('le menu profil est navigable au clavier et mène au compte', async ({ page, login }) => {
  await login('free'); await page.goto('/menu');
  const trigger = page.getByRole('button', { name: /Profil et réglages/ });
  await trigger.focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Menu', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Fermer le menu' })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  await trigger.click(); await dialog.getByRole('link', { name: 'Mon compte et mes données' }).click();
  await expect(page).toHaveURL(/\/compte$/);
  await expect(page.getByRole('heading', { name: 'Mon compte', exact: true })).toBeVisible();
});
