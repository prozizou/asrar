import { test, expect } from './fixtures';
const { app } = require('../../server/grant');

const GROUP = 'owner-menu-ui';
async function seed() {
  const db = app().database();
  const members: Record<string, any> = { 'fixture-free': { name: 'Créateur', email: 'free@asrar.test', fait: 500 } };
  for (let i = 1; i <= 11; i++) members['fixture-extra-' + i] = { name: 'Participant ' + i, email: `participant${i}@asrar.test`, fait: 200 - i * 10, joinedAt: Date.now() - i * 1000 };
  await db.ref('zikr_groups/' + GROUP).set({ name: 'Zikr menu', arabic: 'لا إله إلا الله', transliteration: 'La ilaha illa Allah',
    presetId: 'libre', target: 10000, total: 2000, membersCount: 12, ownerUid: 'fixture-free', ownerEmail: 'free@asrar.test', approved: true });
  await db.ref('zikr_members/' + GROUP).set(members);
}

test('le menu ⋮ du dernier participant reste entièrement visible au-dessus de la barre du bas', async ({ page, login }) => {
  await seed();
  await page.setViewportSize({ width: 390, height: 844 });
  await login('free'); await page.goto('/zikr?item=' + GROUP);
  await page.getByRole('button', { name: 'Participants', exact: true }).click();
  const trigger = page.getByRole('button', { name: 'Actions de modération pour participant11@asrar.test', exact: true });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const exclude = page.getByRole('button', { name: 'Exclure du groupe', exact: true });
  await expect(exclude).toBeVisible();
  const navTop = (await page.locator('.zk-bottom-nav').boundingBox())!.y;
  for (const item of [page.getByRole('button', { name: 'Message et avertissement', exact: true }), exclude]) {
    const box = (await item.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(navTop);
  }
  await page.screenshot({ path: test.info().outputPath('zikr-last-row-menu.png') });
});

test('le créateur modifie le zikr depuis le menu ⋮, sans panneau « Gestion du groupe »', async ({ page, login }) => {
  await seed();
  await page.setViewportSize({ width: 390, height: 844 });
  await login('free'); await page.goto('/zikr?item=' + GROUP);
  await expect(page.getByText('Gestion du groupe')).toHaveCount(0);
  await page.getByRole('button', { name: 'Plus d’actions sur ce zikr collectif', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Gestion du groupe' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Modifier le zikr', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Modifier le zikr', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Annuler', exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('zikr-edit-dialog.png') });
  await dialog.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test('un participant ne voit pas « Modifier le zikr »', async ({ page, login }) => {
  await seed();
  await app().database().ref(`zikr_members/${GROUP}/fixture-basic`).set({ name: 'Membre', email: 'basic@asrar.test', fait: 1 });
  await login('basic'); await page.goto('/zikr?item=' + GROUP);
  await page.getByRole('button', { name: 'Plus d’actions sur ce zikr collectif', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Quitter le groupe', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Modifier le zikr' })).toHaveCount(0);
});
