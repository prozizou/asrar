import { test, expect } from './fixtures';
const { app } = require('../../server/grant');

// Interprétation de la Géomancie : un long bloc Firebase est affiché en
// une phrase par ligne, « Interprétation N : », justifiée.
const LONG = 'La chambre à coucher représente le foyer intime et les possessions personnelles. Elle symbolise l’espace privé du consultant. Elle représente ce qui est intérieur et familier. Elle permet d’explorer son état d’esprit. Elle évoque aussi la vie conjugale. Le lit est un symbole de repos et de sécurité. Il représente la tranquillité ou l’inquiétude. Selon le contexte, il évoque le sommeil ou la santé. Il touche enfin à la paix du foyer.';

test('géomancie : une phrase par ligne « Interprétation N : »', async ({ page, login }) => {
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
    await expect(lines.first()).toHaveText(/^Interprétation 1 : La chambre à coucher.*personnelles\.$/);
    await expect(lines.nth(1)).toHaveText(/^Interprétation 2 : Elle symbolise/);
    expect(await lines.first().evaluate((li) => getComputedStyle(li).textAlign)).toBe('justify');
    await page.screenshot({ path: test.info().outputPath('geomancie-lecture.png') });
  } finally {
    await db.ref('theme_fondamental').set(previous);
  }
});
