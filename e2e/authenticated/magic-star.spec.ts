import { test, expect } from './fixtures';
import { MAGIC_STAR_LINES } from '../../lib/magicStar';

test('étoile 18 cases : saisie instantanée, alignements, copie, export et mobile', async ({ page, login }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await login('premium'); await page.goto('/wafq/carre/6');
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true, value: { writeText: async (text: string) => { (window as any).copiedStar = text; } },
  }));
  await page.reload();
  await page.getByRole('radio', { name: 'Étoile', exact: true }).check();
  await page.getByLabel('Configuration de l’étoile', { exact: true }).selectOption('six');
  const input = page.getByLabel('Constante magique S', { exact: true });
  const diagram = page.getByRole('region', { name: 'Diagramme de l’étoile magique', exact: true });
  await expect(input).toBeVisible();
  for (const s of [38, 117, 644]) {
    await input.fill(String(s));
    const values = await diagram.locator('[data-case]').evaluateAll((nodes) => {
      const result: number[] = [];
      for (const node of nodes) result[Number(node.getAttribute('data-case')) - 1] = Number(node.lastChild!.textContent);
      return result;
    });
    expect(values.length).toBe(18); expect(new Set(values).size).toBe(18);
    for (const line of MAGIC_STAR_LINES) expect(line.reduce((sum, i) => sum + values[i - 1], 0)).toBe(s);
    await expect(page.locator('.kz-star-checks li')).toHaveCount(6);
  }
  await page.getByRole('button', { name: 'Copier les valeurs', exact: true }).click();
  expect(await page.evaluate(() => (window as any).copiedStar)).toContain('S = 644');
  expect(await page.evaluate(() => (window as any).copiedStar)).toContain('156 + 158 + 159 + 171 = 644');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter l’étoile (SVG)', exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('etoile-magique-644.svg');
  const stream = await download.createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const exported = Buffer.concat(chunks).toString();
  expect(exported).toContain('xmlns="http://www.w3.org/2000/svg"');
  expect(exported.match(/data-case=/g)).toHaveLength(18);
  expect(exported).toContain('--star-surface:#fff');
  for (const bad of ['', '37', '-38', '38.5', 'abc', '9007199254740992', '1e3']) {
    await input.fill(bad); await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(diagram).toHaveCount(0);
  }
  await input.fill('9007199254740991'); await expect(diagram).toBeVisible();
  expect(await diagram.evaluate((n) => n.scrollWidth > n.clientWidth)).toBe(true);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 850 });
    for (const theme of ['dark', 'light']) {
      await page.evaluate((t) => document.documentElement.dataset.theme = t, theme);
      for (const value of ['38', '9007199254740991']) {
        await input.fill(value);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      await input.fill('38');
      await diagram.screenshot({ path: test.info().outputPath(`etoile-${width}-${theme}.png`) });
    }
  }
  await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', { value: async () => { throw new Error('denied'); } }));
  await page.getByRole('button', { name: 'Copier les valeurs', exact: true }).click();
  await expect(page.getByLabel('Étoile à copier manuellement')).toContainText('S = 38');
  await page.getByRole('radio', { name: 'Carré', exact: true }).check();
  await expect(diagram).toHaveCount(0);
  await page.getByLabel('Nombre', { exact: true }).fill('111');
  await page.getByRole('button', { name: 'Calculer', exact: true }).click();
  await expect(page.locator('.kz-grid .kz-cell')).toHaveCount(36);
});

test('le générateur étoile conserve la vérification de l’accès premium', async ({ page, login }) => {
  await login('free'); await page.goto('/wafq/carre/6');
  await page.getByRole('radio', { name: 'Étoile', exact: true }).check();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Constante magique S', { exact: true })).toHaveCount(0);
});

test('le modèle à sept alignements affiche les valeurs dans les mêmes positions et exporte sept sommes de 57', async ({ page, login }) => {
  await login('premium'); await page.goto('/wafq/carre/6');
  await page.getByRole('radio', { name: 'Étoile', exact: true }).check();
  await expect(page.getByLabel('Configuration de l’étoile', { exact: true })).toHaveValue('seven');
  await expect(page.getByLabel('Constante magique S', { exact: true })).toHaveValue('57');
  await expect(page.getByLabel('Constante magique S', { exact: true })).toHaveAttribute('readonly', '');
  const diagram = page.getByRole('region', { name: 'Diagramme de l’étoile magique', exact: true });
  const expected = [6, 17, 4, 5, 18, 15, 7, 8, 9, 10, 11, 12, 2, 3, 16, 13, 1, 14];
  for (let i = 0; i < 18; i++) {
    const cell = diagram.locator(`[data-case="${i + 1}"]`);
    expect(await cell.evaluate((node) => Number(node.lastChild!.textContent))).toBe(expected[i]);
  }
  await expect(page.locator('.kz-star-checks li')).toHaveCount(7);
  await expect(page.locator('.kz-star-checks li strong')).toHaveText(Array(7).fill('57'));
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 850 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate((t) => document.documentElement.dataset.theme = t, theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true,
    value: { writeText: async (text: string) => { (window as any).copiedStar = text; } } }));
  await page.getByRole('button', { name: 'Copier les valeurs', exact: true }).click();
  const copied = await page.evaluate(() => (window as any).copiedStar as string);
  expect(copied.split('\n').filter((line) => line.includes(' + ') && line.endsWith('= 57'))).toHaveLength(7);
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter l’étoile (SVG)', exact: true }).click();
  const download = await event;
  expect(download.suggestedFilename()).toBe('etoile-magique-57.svg');
  const stream = await download.createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toContain('Les 7 alignements ont pour somme 57');
  await page.getByLabel('Configuration de l’étoile', { exact: true }).selectOption('six');
  await expect(page.locator('.kz-star-checks li')).toHaveCount(6);
  await page.getByLabel('Configuration de l’étoile', { exact: true }).selectOption('seven');
  await expect(page.locator('.kz-star-checks li strong')).toHaveText(Array(7).fill('57'));
});
