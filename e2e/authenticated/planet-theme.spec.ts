import { test, expect } from './fixtures';

test('Planète suit le thème global jusque dans ses fenêtres et garde des boutons contrastés', async ({ page, login }) => {
  await page.setViewportSize({ width: 360, height: 850 }); await login('free');
  await page.evaluate(() => localStorage.setItem('asrar_planete_place', JSON.stringify({ name: 'Dakar', lat: 14.7167, lng: -17.4677, timeZone: 'Africa/Dakar' })));
  await page.goto('/planete');
  const root = page.locator('.planete-page'); const card = page.locator('.pm-card').first();
  await expect(card).toBeVisible();
  const colors: string[] = [];
  for (const theme of ['dark', 'light']) {
    await page.evaluate((value) => document.documentElement.dataset.theme = value, theme);
    await expect(root).toHaveCSS('color-scheme', theme);
    const background = await card.evaluate((node) => getComputedStyle(node).backgroundColor); colors.push(background);
    await page.getByRole('button', { name: /^Position :/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Choisir la ville' });
    await expect(dialog).toBeVisible(); await expect(dialog.locator('.pm-sheet')).toHaveCSS('background-color', background);
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
    const contrast = async () => page.locator('.pm-btn-filled').first().evaluate((node) => {
      const luminance = (color: string) => {
        const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((v) => { const s = v / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; });
        return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
      };
      const s = getComputedStyle(node), a = luminance(s.color), b = luminance(s.backgroundColor);
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    });
    await expect.poll(contrast).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: test.info().outputPath('planete-' + theme + '.png') });
  }
  expect(colors[0]).not.toBe(colors[1]);
});
