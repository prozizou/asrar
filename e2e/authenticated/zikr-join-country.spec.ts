import { test, expect } from './fixtures';
const { app } = require('../../server/grant');

// Rejoindre un zikr : tous les pays sont proposés (fréquents d'abord), le
// numéro est composé avec l'indicatif choisi et la demande part.
test('rejoindre : pays hors Afrique de l’Ouest disponible, demande envoyée', async ({ page, login }) => {
  const db = app().database(); const gid = 'join-country';
  await db.ref('zikr_groups/' + gid).set({ name: 'Zikr ouvert', arabic: 'سبحان الله', transliteration: 'Soubhanallah', presetId: 'soubhanallah', target: 1000, total: 0,
    membersCount: 1, ownerUid: 'fixture-free', ownerEmail: 'free@asrar.test', approved: true });
  await db.ref('zikr_members/' + gid).set({ 'fixture-free': { name: 'Créateur', email: 'free@asrar.test', fait: 0 } });
  await db.ref('zikr_requests/' + gid).remove();
  await page.setViewportSize({ width: 390, height: 844 });
  await login('basic'); await page.goto('/zikr?item=' + gid);
  const select = page.getByLabel('Indicatif du pays');
  await expect(select.locator('optgroup')).toHaveCount(2);
  expect(await select.locator('option').count()).toBeGreaterThanOrEqual(220);
  await select.selectOption('PK');
  await expect(page.locator('.zk-phone-dial')).toHaveText('+92');
  await page.getByLabel('Numéro WhatsApp').fill('0300 1234567');
  await expect(page.locator('#zk-join-phone-help')).toContainText('+923001234567');
  await page.screenshot({ path: test.info().outputPath('join-pakistan.png') });
  await page.getByRole('button', { name: 'Demander à rejoindre' }).click();
  await expect.poll(async () => (await db.ref(`zikr_requests/${gid}/fixture-basic/phone`).once('value')).val()).toBe('+923001234567');
});
