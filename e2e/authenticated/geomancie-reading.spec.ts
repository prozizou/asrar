import { test, expect } from './fixtures';
const { app } = require('../../server/grant');

// Interprétation de la Géomancie : un long bloc Firebase est affiché en
// une phrase par ligne, « Interprétation N : », justifiée.
const LONG = 'La chambre à coucher représente le foyer intime et les possessions personnelles. Elle symbolise l’espace privé du consultant. Elle représente ce qui est intérieur et familier. Elle permet d’explorer son état d’esprit. Elle évoque aussi la vie conjugale. Le lit est un symbole de repos et de sécurité. Il représente la tranquillité ou l’inquiétude. Selon le contexte, il évoque le sommeil ou la santé. Il touche enfin à la paix du foyer.';

test('géomancie : une phrase par ligne « Interprétation N : »', async ({ page, login }) => {
  const db = app().database();
  const previous = (await db.ref('theme_fondamental').once('value')).val();
  // Index 1..16 comme dans Firebase (lib/geomancie.js figureToJsonIndex).
  const NAMES = ['', 'Youssouf', 'Adama', 'Mahdiou', 'Idrissa', 'Ibrahima', 'Issa', 'Oumar', 'Ayyoube', 'Allahou tall', 'Souleymane', 'Ali', 'Nouhou', 'Housseynou', 'Younouss', 'Ousmane', 'Moussa'];
  await db.ref('theme_fondamental').set(NAMES.map((name, i) => (i ? { titre: `${name} (Témoin droit / Témoin du passé)`, domaine: 'L’intimité et l’acquis.', interpretation: LONG } : { titre: '' })));
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await login('premium'); await page.goto('/geomancie');
    await page.locator('button.btn.primary').first().click();
    await page.getByRole('button', { name: 'Maison 1', exact: true }).click({ timeout: 20_000 });
    const modal = page.getByRole('dialog', { name: 'Détail de la maison' });
    // Raisonnement : occupant, Parole, Juge, Parole + Juge.
    const calc = modal.locator('.geo-calc');
    await expect(calc).toContainText('Parole');
    await expect(calc).toContainText('Juge (M15)');
    await expect(calc).toContainText('Parole + Juge');
    await expect(modal.getByRole('heading', { name: /^Parole :/ })).toBeVisible();
    await page.waitForTimeout(400); // fin de l'animation d'ouverture avant la capture
    await page.screenshot({ path: test.info().outputPath('geomancie-calcul.png') });
    const lines = modal.locator('ol.geo-reading').first().locator('li');
    await expect(lines).toHaveCount(9); // une ligne numérotée par phrase
    await expect(lines.first()).toHaveText(/^Interprétation 1 : La chambre à coucher.*personnelles\.$/);
    await expect(lines.nth(1)).toHaveText(/^Interprétation 2 : Elle symbolise/);
    expect(await lines.first().evaluate((li) => getComputedStyle(li).textAlign)).toBe('justify');
    await page.screenshot({ path: test.info().outputPath('geomancie-lecture.png') });
    // Juge (M15) et Sentence (M16) : même raisonnement.
    await page.keyboard.press('Escape');
    for (const house of ['Maison 15', 'Maison 16']) {
      await page.getByRole('button', { name: house, exact: true }).click();
      const m = page.getByRole('dialog', { name: 'Détail de la maison' });
      await expect(m.locator('.geo-calc')).toContainText('Parole + Juge');
      await expect(m.getByRole('heading', { name: /^Parole :/ })).toBeVisible();
      await expect(m.getByRole('heading', { name: /^Secret final :/ })).toBeVisible();
      await page.waitForTimeout(400);
      await page.screenshot({ path: test.info().outputPath(`geomancie-${house.replace(' ', '-')}.png`) });
      await page.keyboard.press('Escape');
    }
  } finally {
    await db.ref('theme_fondamental').set(previous);
  }
});
