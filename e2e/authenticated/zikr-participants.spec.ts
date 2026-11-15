import { test, expect } from './fixtures';
const { app } = require('../../server/grant');

// Écran Participants (maquette 2026-11) : 4 indicateurs, recherche, tri,
// filtres, rappel aux inactifs sans doublon, classement, utilisateur en
// évidence ; lisible à 390 et 320 px sans débordement horizontal.
const GID = 'participants-ui';
async function seed() {
  const db = app().database();
  const now = Date.now();
  const members: Record<string, any> = {
    'fixture-free': { name: 'Zizou Pro', email: 'free@asrar.test', fait: 7638, lastSeenAt: now, joinedAt: now - 9e6 },
    'fixture-extra-1': { name: 'Amadou Sow', email: 'amadousow41@asrar.test', fait: 40000, joinedAt: now - 8e6 },
    'fixture-extra-2': { name: 'Ismaila Diallo', email: 'ismaila0518@asrar.test', fait: 11333, rythme: 72, joinedAt: now - 7e6 },
    'fixture-extra-3': { name: 'boubawague', email: 'boubawague@asrar.test', fait: 10539, joinedAt: now - 6e6 },
    'fixture-extra-4': { name: 'rabiatou moussa', email: 'mhmdrabiatou6@asrar.test', fait: 8600, rythme: 64, joinedAt: now - 5e6 },
  };
  for (let i = 5; i <= 12; i++) members['fixture-extra-' + i] = { name: 'Participant ' + i, email: `participant${i}@asrar.test`, fait: 100 * (13 - i), joinedAt: now - i * 1000 };
  for (let i = 13; i <= 15; i++) members['fixture-extra-' + i] = { name: 'Inactif ' + i, email: `inactif${i}@asrar.test`, fait: 0, phone: '+22170000000' + (i - 10), joinedAt: now - i * 1000 };
  await db.ref('zikr_groups/' + GID).set({ name: 'Pour se rapprocher d’Allah', arabic: 'لَا إِلَٰهَ إِلَّا ٱللَّٰه', transliteration: 'Lâ ilâha illa Allâh',
    presetId: 'libre', target: 1000000, total: 80000, membersCount: 16, ownerUid: 'fixture-free', ownerEmail: 'free@asrar.test', ownerName: 'Zizou Pro', approved: true });
  await db.ref('zikr_members/' + GID).set(members);
  const day = new Date().toISOString().slice(0, 10);
  await db.ref(`zikr_daily/${GID}`).remove();
  return { db, day };
}

for (const width of [390, 320]) test(`participants : maquette lisible à ${width}px, filtres, recherche, tri et rappel sans doublon`, async ({ page, login }) => {
  test.setTimeout(90_000);
  const { db } = await seed();
  await page.setViewportSize({ width, height: 900 });
  await login('free'); await page.goto('/zikr?item=' + GID);
  await page.getByRole('button', { name: 'Participants', exact: true }).click();
  const board = page.getByRole('region', { name: 'Participants' });
  await expect(board.getByRole('listitem').filter({ hasText: 'Participants' })).toContainText('16');
  await expect(board.getByRole('listitem').filter({ hasText: 'Ont récité' })).toContainText('13');
  await expect(board.getByRole('listitem').filter({ hasText: 'Inactifs' })).toContainText('3');
  // Classement : Amadou 1er, l'utilisateur mis en évidence.
  const rows = board.locator('.zp-row');
  await expect(rows.first()).toContainText('Amadou Sow');
  await expect(rows.first().getByLabel('Rang 1')).toBeVisible();
  await expect(board.locator('.zp-row.me')).toContainText('Vous');
  // Aucun débordement horizontal.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath(`participants-${width}.png`), fullPage: true });

  // Filtres et recherche instantanée.
  await board.getByRole('button', { name: 'Inactifs (3)', exact: true }).click();
  await expect(rows).toHaveCount(3);
  await board.getByRole('button', { name: 'Tous (16)', exact: true }).click();
  await board.getByLabel('Rechercher un participant').fill('isma');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Ismaila Diallo');
  await expect(rows.first().getByLabel('Rang 2')).toBeVisible(); // le rang ne dépend pas du filtre
  await board.getByLabel('Effacer la recherche').click();
  await board.getByLabel('Trier les participants').selectOption('name');
  await expect(rows.first()).toContainText('Amadou Sow');

  // Rappel aux inactifs : une fois, puis plus de doublon.
  page.once('dialog', (d) => d.accept());
  await board.getByRole('button', { name: 'Notifier les inactifs (3)' }).click();
  await expect(board.getByRole('button', { name: 'Inactifs déjà avertis' })).toBeDisabled({ timeout: 15_000 });
  await expect(board.getByText(/3 déjà avertis/)).toBeVisible();
  const warned = (await db.ref(`zikr_members/${GID}`).once('value')).val();
  expect(Object.values(warned).filter((m: any) => m.warning).length).toBe(3);
  await page.screenshot({ path: test.info().outputPath(`participants-${width}-avertis.png`) });
});

test('participants : un membre ordinaire ne voit ni e-mails, ni rythme, ni actions de modération', async ({ page, login }) => {
  await seed();
  await app().database().ref(`zikr_members/${GID}/fixture-basic`).set({ name: 'Membre', email: 'basic@asrar.test', fait: 5, joinedAt: Date.now() });
  await page.setViewportSize({ width: 390, height: 900 });
  await login('basic'); await page.goto('/zikr?item=' + GID);
  await page.getByRole('button', { name: 'Participants', exact: true }).click();
  const board = page.getByRole('region', { name: 'Participants' });
  await expect(board.locator('.zp-row').first()).toContainText('Amadou Sow');
  await expect(board.getByText('amadousow41@asrar.test')).toHaveCount(0);
  await expect(board.locator('.zp-pace')).toHaveCount(0);
  await expect(board.getByRole('button', { name: /Actions de modération/ })).toHaveCount(0);
  await expect(board.getByRole('button', { name: /Notifier les inactifs/ })).toHaveCount(0);
});
