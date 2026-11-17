import { test, expect } from './fixtures';
const { app } = require('../../server/grant');

// Liste des zikrs collectifs : parcours Découvrir → Choisir → Participer.
async function seed() {
  const db = app().database(); const now = Date.now();
  const base = { presetId: 'libre', approved: true, ownerUid: 'fixture-premium', ownerEmail: 'premium@asrar.test' };
  await db.ref().update({
    'zikr_groups/list-rejoint': { ...base, name: 'Liste test rapprochement', arabic: 'لَا إِلَٰهَ إِلَّا ٱللَّٰه', transliteration: 'La ilaha illa Allah', target: 165000, total: 118490, membersCount: 18, createdAt: now - 3000 },
    'zikr_groups/list-ouvert': { ...base, name: 'Liste test pardon', arabic: 'أَسْتَغْفِرُ ٱللَّٰه', transliteration: 'Astaghfiroullah', target: 70, total: 31, membersCount: 1, createdAt: now - 2000 },
    'zikr_groups/list-termine': { ...base, name: 'Liste test salawat', arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّد', transliteration: 'Salawat', target: 1000, total: 1000, membersCount: 4, createdAt: now - 1000 },
    'zikr_members/list-rejoint': { 'fixture-premium': { name: 'Créateur', email: 'premium@asrar.test', fait: 100 }, 'fixture-free': { name: 'Moi', email: 'free@asrar.test', fait: 50 } },
    'zikr_members/list-ouvert': { 'fixture-premium': { name: 'Créateur', email: 'premium@asrar.test', fait: 31 } },
    'zikr_members/list-termine': { 'fixture-premium': { name: 'Créateur', email: 'premium@asrar.test', fait: 1000 } },
  });
}

for (const width of [390, 320]) test(`liste : onglets, une action claire par carte, lisible à ${width}px`, async ({ page, login }) => {
  await seed();
  await page.setViewportSize({ width, height: 900 });
  await login('free'); await page.goto('/zikr');
  await expect(page.getByRole('heading', { name: 'Zikrs collectifs' })).toBeVisible();
  const tabs = page.getByRole('tablist', { name: 'Zikrs collectifs' });
  await expect(tabs.getByRole('tab', { name: /Découvrir/ })).toHaveAttribute('aria-selected', 'true');
  const joined = page.getByRole('button', { name: /^Liste test rapprochement,.*Reprendre$/ });
  const open = page.getByRole('button', { name: /^Liste test pardon,.*Participer$/ });
  await expect(joined).toBeVisible();
  await expect(open).toBeVisible();
  await expect(page.getByRole('button', { name: /^Liste test salawat/ })).toHaveCount(0); // terminé : onglet dédié
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath(`liste-${width}.png`), fullPage: true });

  await tabs.getByRole('tab', { name: /Mes zikrs/ }).click();
  await expect(joined).toBeVisible();
  await expect(open).toHaveCount(0);
  await tabs.getByRole('tab', { name: /Terminés/ }).click();
  await expect(page.getByRole('button', { name: /^Liste test salawat,.*Complet$/ })).toBeVisible();

  // Participer ouvre le zikr avec le formulaire d'adhésion.
  await tabs.getByRole('tab', { name: /Découvrir/ }).click();
  await open.click();
  await expect(page.getByRole('heading', { name: 'Rejoindre ce zikr collectif' })).toBeVisible();
});

test('liste : indication de départ pour un compte qui n’a rejoint aucun zikr', async ({ page, login }) => {
  await seed();
  await page.setViewportSize({ width: 390, height: 900 });
  await login('seller'); await page.goto('/zikr');
  await expect(page.getByRole('note')).toContainText('choisissez un zikr ci-dessous');
  await page.getByRole('tab', { name: /Mes zikrs/ }).click();
  await expect(page.getByText('Vous n’avez rejoint aucun zikr')).toBeVisible();
  await page.getByRole('button', { name: 'Découvrir les zikrs' }).click();
  await expect(page.getByRole('tab', { name: /Découvrir/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Créer un zikr collectif' })).toBeVisible();
});
