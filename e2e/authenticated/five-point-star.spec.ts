import { test, expect } from './fixtures';
import { mockActionCreative } from './helpers/ad-creative';

test('Hatim 5×5 : modèle cinq branches, constantes, chiffres, copie, exports et retour aux carrés', async ({ page, login }) => {
  await login('premium');
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true, value: { writeText: async (value: string) => { (window as any).copiedStar = value; } },
  }));
  await page.goto('/wafq/carre/5');
  await page.getByRole('radio', { name: 'Étoile 5 branches', exact: true }).check();
  await page.getByRole('combobox', { name: 'Modèle de l’étoile', exact: true }).selectOption('10');
  const input = page.getByLabel('Constante magique', { exact: true });
  const diagram = page.getByRole('region', { name: 'Diagramme de l’étoile magique' });
  await expect(input).toBeVisible();
  await expect(diagram.locator('circle')).toHaveCount(10);
  await expect(diagram.locator('[data-case]')).toHaveCount(0);
  await input.fill('24');
  const values = await diagram.locator('[data-case]').evaluateAll((nodes) => nodes.map((node) => Number(node.lastChild!.textContent)));
  expect(values).toEqual([1, 2, 3, 4, 5, 9, 8, 12, 6, 10]);
  await page.getByText('5 sommes vérifiées', { exact: true }).click();
  await expect(page.locator('.kz-star-checks li')).toHaveCount(5);
  await expect(page.locator('.kz-star-checks')).toContainText('5 + 9 + 8 + 2 = 24');
  await page.getByRole('button', { name: 'Copier', exact: true }).click();
  expect(await page.evaluate(() => (window as any).copiedStar)).toContain('Étoile à 5 branches — S = 24');
  for (const format of ['SVG', 'PNG']) {
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: `Exporter en ${format}`, exact: true }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe(`etoile-5-branches-24.${format.toLowerCase()}`);
    const stream = await download.createReadStream(); const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);
    if (format === 'SVG') {
      expect(bytes.toString().match(/data-case=/g)).toHaveLength(10);
      expect(bytes.toString()).toContain('--star-surface:#fff');
    } else {
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      await download.saveAs(test.info().outputPath('etoile-5-branches-24.png'));
    }
  }
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 850 });
    for (const theme of ['dark', 'light']) {
      await page.evaluate((value) => document.documentElement.dataset.theme = value, theme);
      for (const numerals of ['latin', 'eastern']) {
        await page.getByRole('combobox', { name: 'Chiffres', exact: true }).selectOption(numerals);
        for (const constant of ['24', '26', '644', '9007199254740990']) {
          await input.fill(constant);
          const outside = await diagram.locator('[data-case]').evaluateAll((nodes: SVGTextElement[]) => nodes.flatMap((text) => {
            const box = text.getBBox();
            const circle = text.ownerSVGElement!.querySelector(`[data-region="${text.dataset.case}"]`) as SVGCircleElement;
            const corners = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]];
            return corners.every(([x, y]) => circle.isPointInFill(new DOMPoint(x, y))) ? [] : [text.dataset.case];
          }));
          expect(outside).toEqual([]);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        }
      }
      await input.fill('24');
      await page.getByRole('combobox', { name: 'Chiffres', exact: true }).selectOption('latin');
      await diagram.screenshot({ path: test.info().outputPath(`etoile-5-${width}-${theme}.png`) });
    }
  }
  await page.getByRole('combobox', { name: 'Chiffres', exact: true }).selectOption('eastern');
  expect(await diagram.locator('[data-case]').first().evaluate((node) => node.lastChild!.textContent)).toBe('۱');
  for (const bad of ['23', '25', '-24', '24.5', 'abc', '1e3', '9007199254740992']) {
    await input.fill(bad);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(diagram.locator('[data-case]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Exporter en PNG', exact: true })).toBeDisabled();
  }
  await page.getByRole('radio', { name: 'Base', exact: true }).check();
  await expect(diagram).toHaveCount(0);
  await page.getByLabel('Nombre', { exact: true }).fill('65');
  await page.getByRole('button', { name: 'Calculer', exact: true }).click();
  await expect(page.locator('.kz-grid .kz-cell')).toHaveCount(25);
  await page.getByRole('radio', { name: 'Askandria', exact: true }).check();
  for (const field of ['t8', 't4', 't21', 't17']) await page.getByLabel(field, { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Calculer', exact: true }).click();
  await expect(page.locator('.kz-grid .kz-cell')).toHaveCount(25);
});

test('Hatim cinq branches : le générateur attend la validation publicitaire du compte gratuit', async ({ page, login }) => {
  await login('free'); await mockActionCreative(page);
  await page.goto('/wafq/carre/5'); await page.waitForLoadState('networkidle');
  const popup = page.waitForEvent('popup');
  await page.getByRole('radio', { name: 'Étoile 5 branches', exact: true }).check();
  await (await popup).close();
  const ad = page.getByRole('dialog', { name: 'Publicité' });
  await expect(ad).toBeVisible();
  await expect(page.getByLabel('Constante magique', { exact: true })).toHaveCount(0);
  await ad.getByRole('button', { name: 'Continuer' }).click({ timeout: 7000 });
  await expect(page.getByLabel('Constante magique', { exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Modèle de l’étoile', exact: true })).toHaveValue('15');
  await page.getByLabel('Constante magique', { exact: true }).fill('903');
  await expect(page.locator('[data-case]')).toHaveCount(15);
});

test('étoile 15 cases : cinq lignes géométriques à 903, entiers, mobile et exports', async ({ page, login }) => {
  await login('premium');
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true, value: { writeText: async (value: string) => { (window as any).copiedStar = value; } },
  }));
  await page.goto('/wafq/carre/5');
  await page.getByRole('radio', { name: 'Étoile 5 branches', exact: true }).check();
  const model = page.getByRole('combobox', { name: 'Modèle de l’étoile', exact: true });
  const input = page.getByLabel('Constante magique', { exact: true });
  const diagram = page.getByRole('region', { name: 'Diagramme de l’étoile magique' });
  await expect(model).toHaveValue('15');
  await expect(input).toHaveValue('');
  await expect(diagram.locator('circle')).toHaveCount(15);
  await input.fill('903');
  const values = await diagram.locator('[data-case]').evaluateAll((nodes) => nodes.map((node) => Number(node.lastChild!.textContent)));
  expect(values).toEqual([174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 192, 184, 191, 188, 190]);
  const geometry = await diagram.locator('svg').evaluate((svg) => {
    const nodes = Array.from(svg.querySelectorAll<SVGCircleElement>('[data-region]')).map((circle) => ({
      x: circle.cx.baseVal.value, y: circle.cy.baseVal.value,
      value: Number(svg.querySelector(`[data-case="${circle.dataset.region}"]`)!.lastChild!.textContent),
    }));
    return [[0, 2], [2, 4], [4, 1], [1, 3], [3, 0]].map(([a, b]) => {
      const p = nodes[a], q = nodes[b];
      const line = nodes.filter((n) => Math.abs((q.x - p.x) * (n.y - p.y) - (q.y - p.y) * (n.x - p.x)) / Math.hypot(q.x - p.x, q.y - p.y) < 0.01);
      return { count: line.length, sum: line.reduce((sum, n) => sum + n.value, 0) };
    });
  });
  expect(geometry).toEqual(Array(5).fill({ count: 5, sum: 903 }));
  await page.getByText('5 sommes vérifiées', { exact: true }).click();
  await expect(page.locator('.kz-star-checks li')).toHaveCount(5);
  await expect(page.locator('.kz-star-checks')).toContainText('174 + 192 + 180 + 181 + 176 = 903');
  await page.getByRole('button', { name: 'Copier', exact: true }).click();
  expect(await page.evaluate(() => (window as any).copiedStar)).toContain('Étoile à 5 branches (15 cases) — S = 903');
  for (const format of ['SVG', 'PNG']) {
    const event = page.waitForEvent('download');
    await page.getByRole('button', { name: `Exporter en ${format}`, exact: true }).click();
    const download = await event;
    expect(download.suggestedFilename()).toBe(`etoile-5-branches-15-cases-903.${format.toLowerCase()}`);
    const stream = await download.createReadStream(); const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);
    if (format === 'SVG') {
      expect(bytes.toString().match(/data-case=/g)).toHaveLength(15);
      expect(bytes.toString()).toContain('--star-surface:#fff');
      expect(bytes.toString()).toContain('var(--star-extra, #6d28d9)');
    } else {
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      await download.saveAs(test.info().outputPath('etoile-15-cases-903.png'));
    }
  }
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 850 });
    for (const theme of ['dark', 'light']) {
      await page.evaluate((value) => document.documentElement.dataset.theme = value, theme);
      for (const numerals of ['latin', 'eastern']) {
        await page.getByRole('combobox', { name: 'Chiffres', exact: true }).selectOption(numerals);
        for (const constant of ['38', '39', '903', '904', '9007199254740991']) {
          await input.fill(constant);
          const outside = await diagram.locator('[data-case]').evaluateAll((nodes: SVGTextElement[]) => nodes.flatMap((text) => {
            const box = text.getBBox();
            const circle = text.ownerSVGElement!.querySelector(`[data-region="${text.dataset.case}"]`) as SVGCircleElement;
            return [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]]
              .every(([x, y]) => circle.isPointInFill(new DOMPoint(x, y))) ? [] : [text.dataset.case];
          }));
          expect(outside).toEqual([]);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        }
      }
      await page.getByRole('combobox', { name: 'Chiffres', exact: true }).selectOption('latin');
      await input.fill('903');
      await page.screenshot({ path: test.info().outputPath(`etoile-15-${width}-${theme}.png`), fullPage: true });
    }
  }
  await model.selectOption('10');
  await expect(input).toHaveValue('903');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(diagram.locator('circle')).toHaveCount(10);
  await expect(diagram.locator('[data-case]')).toHaveCount(0);
  await model.selectOption('15');
  await expect(input).toHaveAttribute('aria-invalid', 'false');
  await expect(diagram.locator('[data-case]')).toHaveCount(15);
  for (const bad of ['37', '-38', '903.5', 'abc', '1e3', '9007199254740992']) {
    await input.fill(bad); await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(diagram.locator('[data-case]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Exporter en PNG', exact: true })).toBeDisabled();
  }
});
