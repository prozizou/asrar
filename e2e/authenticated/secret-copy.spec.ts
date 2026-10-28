import { test, expect } from './fixtures';
const { app } = require('../../server/grant');
const { accounts } = require('./accounts.cjs');

for (const role of ['premium', 'admin']) {
  test(`le compte ${role} ne voit ni PDF ni copie de recette`, async ({ page, login }) => {
    await login(role); await page.goto('/asrar');
    await page.getByRole('button', { name: /Secret de test/i }).click();
    await expect(page.locator('.secret-detail')).toBeVisible();
    await expect(page.getByRole('button', { name: /PDF|Copier la recette/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Partager', exact: true })).toBeVisible();
  });
}

test('le compte désigné copie les parties numérotées et dispose d’une reprise en cas d’échec', async ({ page, login }) => {
  const account = { uid: 'fixture-recipe-owner', email: 'prozizou298@gmail.com', password: 'Local-emulator-only-2026!' };
  accounts.recipeOwner = account;
  const admin = app();
  try { await admin.auth().deleteUser(account.uid); } catch (error: any) { if (error.code !== 'auth/user-not-found') throw error; }
  await admin.auth().createUser({ ...account, emailVerified: true });
  await admin.database().ref('allowedUsers/prozizou298@gmail,com').set({ level: 45000, until: Date.now() + 86400000 });
  const source = 'Première partie\nيا لطيف 129 fois\n\n2. Deuxième partie\n\nDernière partie';
  // Recette fictive utilisée uniquement dans les émulateurs, ouverte par lien direct.
  await admin.database().ref('db_sirr_protection/copy-fixture').set({ faida: 'Recette à copier', sirr: source });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { (window as any).copiedRecipe = text; } } });
  });
  await login('recipeOwner'); await page.goto('/asrar?cat=protection&item=copy-fixture');
  const copy = page.getByRole('button', { name: 'Copier la recette', exact: true });
  await expect(copy).toBeVisible(); await expect(page.getByRole('button', { name: 'PDF', exact: true })).toHaveCount(0);
  await copy.click();
  const expected = 'Recette à copier\n\n1. Première partie\nيا لطيف 129 fois\n\n2. Deuxième partie\n\n3. Dernière partie';
  await expect(page.getByRole('status').filter({ hasText: 'Recette copiée' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).copiedRecipe)).toBe(expected);
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('Clipboard indisponible'); }; });
  await copy.click(); await expect(page.locator('.secret-detail').getByRole('alert')).toContainText('copie automatique est indisponible');
  await expect(page.getByRole('textbox', { name: 'Recette à copier manuellement' })).toHaveValue(expected);
  await admin.database().ref('db_sirr_protection/copy-fixture').remove();
  await admin.database().ref('allowedUsers/prozizou298@gmail,com').remove();
  await admin.auth().deleteUser(account.uid);
  delete accounts.recipeOwner;
});
