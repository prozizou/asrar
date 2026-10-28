import { test, expect } from './fixtures';
import { MAGIC_STAR_LINES } from '../../lib/magicStar';

async function checkFitting(page: any) {
  const failures = await page.locator('[data-case]').evaluateAll((nodes: SVGTextElement[]) => nodes.flatMap((text) => {
    const box = text.getBBox();
    const region = text.ownerSVGElement!.querySelector(`[data-region="${text.dataset.case}"]`) as SVGGeometryElement;
    const corners = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]];
    return corners.every(([x, y]) => region.isPointInFill(new DOMPoint(x, y))) ? [] : [text.dataset.case];
  }));
  expect(failures).toEqual([]);
}

test('étoile vide, sept sommes instantanées, chiffres contenus, copie et exports SVG/PNG blanc', async ({ page, login }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await login('premium'); await page.goto('/wafq/carre/6');
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true, value: { writeText: async (text: string) => { (window as any).copiedStar = text; } },
  }));
  await page.reload();
  await page.getByRole('radio', { name: 'Étoile', exact: true }).check();
  const input = page.getByLabel('Constante magique', { exact: true });
  const diagram = page.getByRole('region', { name: 'Diagramme de l’étoile magique', exact: true });
  await expect(input).toHaveValue(''); await expect(input).toHaveAttribute('placeholder', 'Entrer le nombre');
  await expect(diagram).toBeVisible(); await expect(diagram.locator('[data-case]')).toHaveCount(0);
  await expect(page.locator('#magic-star-error')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Exporter en PNG', exact: true })).toBeDisabled();
  await expect(page.locator('.kz-method-hint')).toHaveCount(0);
  await diagram.screenshot({ path: test.info().outputPath('etoile-vide.png') });
  for (const s of [57, 58, 59, 60, 61, 62, 117, 644]) {
    await input.fill(String(s));
    const values = await diagram.locator('[data-case]').evaluateAll((nodes) => {
      const result: number[] = [];
      for (const node of nodes) result[Number(node.getAttribute('data-case')) - 1] = Number(node.lastChild!.textContent);
      return result;
    });
    expect(values.length).toBe(18); expect(new Set(values).size).toBe(18);
    for (const line of MAGIC_STAR_LINES) expect(line.reduce((sum, i) => sum + values[i - 1], 0)).toBe(s);
    await expect(page.locator('.kz-star-checks li')).toHaveCount(7);
    await checkFitting(page);
  }
  await page.getByRole('button', { name: 'Copier', exact: true }).click();
  expect(await page.evaluate(() => (window as any).copiedStar)).toContain('S = 644');
  const svgEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter en SVG', exact: true }).click();
  const svg = await svgEvent;
  expect(svg.suggestedFilename()).toBe('etoile-magique-644.svg');
  const stream = await svg.createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const exported = Buffer.concat(chunks).toString();
  expect(exported.match(/data-case=/g)).toHaveLength(18);
  expect(exported).toContain('--star-surface:#fff');
  const pngEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter en PNG', exact: true }).click();
  const png = await pngEvent;
  expect(png.suggestedFilename()).toBe('etoile-magique-644.png');
  const pngStream = await png.createReadStream(); const pngChunks: Buffer[] = [];
  for await (const chunk of pngStream!) pngChunks.push(Buffer.from(chunk));
  const pngBytes = Buffer.concat(pngChunks);
  expect(pngBytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  const pixels = await page.evaluate(async (base64) => {
    const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let opaque = true, colored = 0;
    for (let i = 0; i < data.length; i += 4) { if (data[i + 3] !== 255) opaque = false; if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) colored++; }
    return { width: image.width, height: image.height, corner: Array.from(data.slice(0, 4)), opaque, colored };
  }, pngBytes.toString('base64'));
  expect(pixels).toMatchObject({ width: 1920, height: 2010, corner: [255, 255, 255, 255], opaque: true });
  expect(pixels.colored).toBeGreaterThan(10000);
  await png.saveAs(test.info().outputPath('etoile-644.png'));
  for (const bad of ['56', '38', '-57', '57.5', 'abc', '9007199254740992', '1e3']) {
    await input.fill(bad); await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(diagram.locator('[data-case]')).toHaveCount(0);
  }
  await input.fill(''); await expect(page.locator('#magic-star-error')).toHaveCount(0);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 850 });
    for (const theme of ['dark', 'light']) {
      await page.evaluate((t) => document.documentElement.dataset.theme = t, theme);
      for (const numerals of ['latin', 'eastern']) {
        await page.getByRole('combobox', { name: 'Chiffres', exact: true }).selectOption(numerals);
        for (const value of ['57', '644', '9007199254740991']) {
          await input.fill(value); await checkFitting(page);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        }
      }
      await page.getByRole('combobox', { name: 'Chiffres', exact: true }).selectOption('latin');
      await input.fill('57');
      await expect(page.locator('.kz-star-checks')).not.toHaveAttribute('open', '');
      expect((await page.locator('.kz-star-generator').boundingBox())!.height).toBeLessThan(850);
      await page.screenshot({ path: test.info().outputPath(`etoile-${width}-${theme}.png`) });
    }
  }
  await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', { value: async () => { throw new Error('denied'); } }));
  await page.getByRole('button', { name: 'Copier', exact: true }).click();
  await expect(page.getByLabel('Étoile à copier manuellement')).toContainText('S = 57');
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
  await expect(page.getByLabel('Constante magique', { exact: true })).toHaveCount(0);
});
