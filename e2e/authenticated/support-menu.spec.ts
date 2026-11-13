import { test, expect } from './fixtures';

// Menu (page la plus visitée) : fenêtre « Soutenir ASRAR PRO » une fois par
// session, « Passer » actif seulement après 5 secondes.
test('menu : soutien présenté une fois par session, passable après 5 s', async ({ page, login }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await login('basic');
  await page.evaluate(() => { localStorage.setItem('e2e_support_gate', '1'); sessionStorage.clear(); localStorage.removeItem('asrar_support_prompt'); });
  await page.goto('/menu');
  const dialog = page.getByRole('dialog', { name: 'Soutenir ASRAR PRO' });
  await expect(dialog).toBeVisible({ timeout: 5000 });
  const skip = dialog.getByRole('button', { name: /^Passer/ });
  await expect(skip).toBeDisabled();
  await expect(skip).toHaveText(/Passer dans \d s/);
  await expect(dialog.getByRole('button', { name: 'Fermer' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('J’ai déjà contribué')).toHaveCount(0);
  await dialog.getByRole('radio', { name: 'WhatsApp' }).check();
  await expect(dialog.getByRole('button', { name: 'Demander comment envoyer' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('support-menu-attente.png') });
  await expect(skip).toBeEnabled({ timeout: 7000 });
  await expect(skip).toHaveText('Passer');
  await skip.click();
  await expect(dialog).toHaveCount(0);
  // Même session : plus de présentation au retour sur le menu.
  await page.goto('/combinaisons');
  await page.goto('/menu');
  await page.waitForTimeout(2000);
  await expect(dialog).toHaveCount(0);
});
