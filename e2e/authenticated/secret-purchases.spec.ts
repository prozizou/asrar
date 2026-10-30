import { test, expect } from './fixtures';
const { app } = require('../../server/grant');
const { accounts } = require('./accounts.cjs');
const key = 'paid-secret-fixture', productId = 'secret_fixture_paid';
test.beforeEach(async () => {
  await app().database().ref().update({
    ['db_sirr_protection/' + key]: { faida: 'Secret à achat individuel', sirr: 'Recette réservée aux acheteurs.' },
    'secret_billing/settings': { enabled: true },
    ['secret_products/protection/' + key]: { productId, enabled: true },
  });
});
test.afterEach(async () => {
  await app().database().ref().update({ ['db_sirr_protection/' + key]: null, secret_billing: null,
    secret_products: null, secret_legacy_access: null, secret_entitlements: null, play_secret_receipts: null });
});
test('un secret verrouillé propose son achat sans abonnement et le web explique la disponibilité dans Android', async ({ page, login, postAs }) => {
  await login('free'); await page.goto('/asrar?cat=protection&item=' + key);
  const dialog = page.getByRole('dialog', { name: 'Débloquer ce secret' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('alert')).toContainText('Android');
  await expect(dialog.getByRole('button', { name: 'Restaurer mes achats' })).toBeVisible();
  await expect(page.locator('.secret-detail')).toHaveCount(0);
  const denied = await postAs('free', 'get-content', { kind: 'secret', cat: 'protection', key });
  expect(denied.status()).toBe(403); expect((await denied.json()).code).toBe('SECRET_PURCHASE_REQUIRED');
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
});
test('l’abonné conserve son échéance figée et perd seulement l’accès aux secrets après celle-ci', async ({ page, login, postAs }) => {
  const emailKey = accounts.premium.email.replace(/\./g, ',');
  await app().database().ref('secret_legacy_access/' + emailKey).set({ expiresAt: Date.now() + 60000 });
  await login('premium'); await page.goto('/asrar?cat=protection&item=' + key);
  await expect(page.locator('.secret-detail')).toContainText('Recette réservée aux acheteurs.');
  await app().database().ref('secret_legacy_access/' + emailKey + '/expiresAt').set(1);
  const denied = await postAs('premium', 'get-content', { kind: 'secret', cat: 'protection', key }); expect(denied.status()).toBe(403);
  const subscription = await postAs('premium', 'check-access'); expect((await subscription.json()).allowed).toBe(true);
});
test('un droit individuel validé fonctionne sur le web et ne donne pas les autres secrets', async ({ page, login, postAs }) => {
  const uid = accounts.free.uid, id = 'fixture-verified-receipt';
  await app().database().ref().update({ [`secret_entitlements/${uid}/protection/${key}`]: { state: 'purchased', tokenId: id },
    ['play_secret_receipts/' + id]: { uid, cat: 'protection', key, productId, state: 'purchased', checkedAt: Date.now() } });
  await login('free'); await page.goto('/asrar?cat=protection&item=' + key);
  await expect(page.locator('.secret-detail')).toContainText('Recette réservée aux acheteurs.');
  const another = await postAs('free', 'get-content', { kind: 'secret', cat: 'protection', key: 'secret1' });
  expect(another.status()).not.toBe(200);
  const forbidden = await postAs('free', 'secret-purchases', { action: 'activate' }); expect(forbidden.status()).toBe(403);
});

test('le prix localisé vient du bridge Play et un achat en attente ne livre aucun contenu', async ({ page, login }) => {
  await page.addInitScript(() => {
    const win = window as any;
    win.CapacitorCustomPlatform = { name: 'android' };
    win.Capacitor = {
      isNativePlatform: () => true, getPlatform: () => 'android',
      PluginHeaders: [{ name: 'SecretBilling', methods: ['product', 'buy', 'restore'].map((name) => ({ name, rtype: 'promise' })) }],
      nativePromise: async (plugin: string, method: string) => {
        if (plugin !== 'SecretBilling') throw new Error('Plugin indisponible');
        if (method === 'product') return { price: '2 500 F CFA', productId: 'secret_fixture_paid' };
        if (method === 'buy') return { pending: true, productId: 'secret_fixture_paid' };
        return { purchases: [] };
      },
    };
  });
  await login('free'); await page.goto('/asrar?cat=protection&item=' + key);
  const dialog = page.getByRole('dialog', { name: 'Débloquer ce secret' });
  const buy = dialog.getByRole('button', { name: /Débloquer pour.*2.*500 F CFA/ });
  await expect(buy).toBeEnabled();
  await expect(dialog.getByRole('button', { name: /Orange Money/ })).toHaveCount(0);
  await buy.click();
  await expect(dialog.getByRole('status')).toContainText('Paiement en attente');
  await expect(page.locator('.secret-detail')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Restaurer mes achats' }).click();
  await expect(dialog.getByRole('status')).toContainText('0 achat(s) restauré(s)');
});


test('l’administration retrouve le produit approuvé pour RETOUR À L’ENVOYEUR sans saisie manuelle', async ({ page, login, postAs }) => {
  const key = '-P2PntsHubOw5y3jXbI_';
  await app().database().ref('db_sirr_protection/' + key).set({ faida: 'RETOUR À L’ENVOYEUR', sirr: 'Texte fictif de recette pilote pour les émulateurs.' });
  try {
    await login('admin'); await page.goto('/asrar?cat=protection&item=' + key);
    await page.getByRole('button', { name: 'Configurer l’achat de ce secret' }).click();
    const dialog = page.getByRole('dialog', { name: 'Vente individuelle du secret' });
    await expect(dialog).toContainText('RETOUR À L’ENVOYEUR');
    const input = dialog.getByRole('textbox', { name: 'Identifiant Google Play' });
    await expect(input).toHaveValue('secret_protection_001'); await expect(input).toHaveAttribute('readonly');
    await expect(dialog.getByRole('button', { name: 'Association enregistrée' })).toBeDisabled();
    const denied = await postAs('free', 'secret-purchases', { action: 'configuration', cat: 'protection', key }); expect(denied.status()).toBe(403);
  } finally { await app().database().ref('db_sirr_protection/' + key).remove(); }
});
