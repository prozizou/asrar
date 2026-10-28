import { test, expect } from './fixtures';
import { NAMES_SORTED } from '../../lib/combinaisons';

test('Combinaisons conserve la recherche sans calculateur ni tableau des noms', async ({ page, login }) => {
  await login('premium'); await page.goto('/combinaisons');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Calculateur Abjad', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Tableau des 99 Noms et leurs poids Abjad', { exact: true })).toHaveCount(0);
  await expect(page.locator('.calc-text, .names-table, .names-grid')).toHaveCount(0);
  const target = NAMES_SORTED[0].weight + NAMES_SORTED[1].weight;
  await page.getByLabel('Poids cible', { exact: false }).fill(String(target));
  await page.getByLabel('Nombre de noms', { exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Rechercher', exact: true }).click();
  await expect(page.locator('.result-card').first()).toBeVisible();
  await page.locator('.result-card').first().click();
  await expect(page.getByRole('dialog', { name: 'Détail de la combinaison', exact: true })).toBeVisible();
});
