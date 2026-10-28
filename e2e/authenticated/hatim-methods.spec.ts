import { test, expect } from './fixtures';

for (const size of [3, 5, 8]) {
  test(`Hatim ${size} : choix compact, clavier et changement de méthode`, async ({ page, login }) => {
    await login('premium');
    await page.goto(`/wafq/carre/${size}`);
    const methods = page.getByRole('group', { name: 'Méthode' });
    const radios = methods.getByRole('radio');
    await expect(radios).toHaveCount(size === 3 ? 4 : 2);
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 850 });
      for (const theme of ['dark', 'light']) {
        await page.evaluate((value) => document.documentElement.dataset.theme = value, theme);
        const boxes = await methods.locator('.kz-method-chip').evaluateAll((nodes) => nodes.map((node) => {
          const { x, y, width, height } = node.getBoundingClientRect(); return { x, y, width, height };
        }));
        expect(boxes[0].y).toBe(boxes[1].y);
        expect(boxes[1].x).toBeGreaterThan(boxes[0].x);
        for (const box of boxes) {
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(width);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    }
    const first = radios.first();
    await first.check(); await first.focus();
    await page.keyboard.press('ArrowRight');
    await expect(radios.nth(1)).toBeChecked();
    await expect(radios.nth(1)).toBeFocused();
    if (size === 3) {
      await page.getByLabel('Nombre (hajah)', { exact: true }).fill('21');
      await page.getByRole('button', { name: 'Calculer', exact: true }).click();
      await expect(page.locator('.kz-grid')).toBeVisible();
      await page.getByRole('radio', { name: 'Bayt', exact: true }).check();
      await expect(page.locator('.kz-grid')).toHaveCount(0);
      await expect(page.getByText('2 valeurs à renseigner : le nombre et l’entrée.', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Entrée', { exact: true })).toBeVisible();
      await page.getByRole('radio', { name: 'Ghazaly', exact: true }).check();
      await expect(page.getByLabel('Nombre (hajah)', { exact: true })).toHaveValue('21');
      await page.getByRole('radio', { name: 'Triangulaire', exact: true }).check();
      await expect(page.locator('details')).not.toHaveAttribute('open', '');
      await page.getByText('Comprendre le Hatim triangulaire', { exact: true }).click();
      await expect(page.locator('details')).toHaveAttribute('open', '');
    } else if (size === 5) {
      await expect(page.getByLabel('t8', { exact: true })).toBeVisible();
      await expect(page.getByLabel('t17', { exact: true })).toBeVisible();
    } else {
      await expect(page.getByLabel('Nombre (au moins 124)', { exact: true })).toBeVisible();
    }
    await page.setViewportSize({ width: 390, height: 850 });
    await page.screenshot({ path: test.info().outputPath(`hatim-${size}-chips.png`) });
  });
}
