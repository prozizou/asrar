import { test, expect } from './fixtures';
const { app } = require('../../server/grant');

// Interprétation de la Géomancie : un long bloc Firebase est affiché en
// une phrase par ligne, numérotée, justifiée.
const LONG = Array.from({ length: 9 }, (_, i) => `Phrase ${i + 1} : la chambre à coucher représente le foyer intime, les possessions et l’état d’esprit du consultant.`).join(' ');

test('géomancie : une phrase par ligne, numérotée', async ({ page, login }) => {
  const db = app().database();
  const previous = (await db.ref('theme_fondamental').once('value')).val();
  await db.ref('theme_fondamental').set(Array.from({ length: 16 }, (_, i) => ({ titre: `Figure${i + 1} (Témoin droit / Témoin du passé)`, domaine: 'L’intimité et l’acquis.', interpretation: LONG })));
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await login('premium'); await page.goto('/geomancie');
    await page.locator('button.btn.primary').first().click();
    await page.getByRole('button', { name: 'Maison 1', exact: true }).click({ timeout: 20_000 });
    const modal = page.getByRole('dialog', { name: 'Détail de la maison' });
    const lines = modal.locator('ol.geo-reading').first().locator('li');
    await expect(lines).toHaveCount(9); // une ligne numérotée par phrase
    await expect(lines.first()).toHaveText(/^Phrase 1 :.*consultant\.$/);
    expect(await lines.first().evaluate((li) => getComputedStyle(li).textAlign)).toBe('justify');
    await page.screenshot({ path: test.info().outputPath('geomancie-lecture.png') });
  } finally {
    await db.ref('theme_fondamental').set(previous);
  }
});
