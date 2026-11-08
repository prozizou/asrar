import { test, expect } from './fixtures';
import { VIEW_ROUTES } from './view-routes';

// body est un flex centré (app/globals.css) : une page sans largeur explicite
// se réduit à la largeur de son contenu et laisse de grandes marges vides.
test('chaque vue occupe toute la largeur d’un téléphone', async ({ page, login }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 412, height: 900 }); await login('basic');
  for (const route of VIEW_ROUTES) {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    const widths = await page.evaluate(() => Array.from(document.body.children)
      .filter((node) => /^(DIV|MAIN)$/.test(node.tagName) && !node.classList.contains('cosmic-bg')
        && !node.classList.contains('expiry-banner') && (node as HTMLElement).offsetWidth > 0)
      .map((node) => Math.round(node.getBoundingClientRect().width)));
    expect(widths.length, route).toBeGreaterThan(0);
    expect(Math.min(...widths), route).toBe(412);
  }
});
