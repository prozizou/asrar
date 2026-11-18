import { test, expect } from './fixtures';

// Écriture spirituelle : actions de fichier regroupées dans l'onglet Fichier
// (plus de doublon sous le résultat), ornement et taille dans Outils.
test('Al Qalam : onglets Fichier / Outils, sans actions dupliquées', async ({ page, login }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await login('premium'); await page.goto('/alqalam');
  await page.getByRole('button', { name: /Écriture simple/ }).click();
  await page.getByLabel('Zone de saisie du texte arabe').fill('الله');
  await page.getByRole('button', { name: 'Générer le texte', exact: true }).click();
  // Plus de barre d'actions sous le résultat : un lien vers l'onglet Fichier.
  await expect(page.locator('.alq-result-actions')).toHaveCount(0);
  await page.getByRole('button', { name: 'Copier, partager ou exporter : onglet Fichier' }).click();
  const tabs = page.getByRole('tablist', { name: 'Fichier et outils' });
  await expect(tabs.getByRole('tab', { name: 'Fichier' })).toHaveAttribute('aria-selected', 'true');
  const actions = page.getByRole('toolbar', { name: 'Actions sur le résultat' });
  for (const name of ['Copier', 'Modifier', 'Partager', 'PDF', 'Word']) await expect(actions.getByRole('button', { name, exact: true })).toBeEnabled();
  // Une seule fois chaque action dans la page.
  await expect(page.getByRole('button', { name: 'PDF', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Cumuler' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rechercher dans le texte' })).toBeVisible();
  await expect(page.getByText('Taille du texte')).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('alqalam-fichier.png') });
  await tabs.getByRole('tab', { name: 'Outils' }).click();
  await expect(tabs.getByRole('tab', { name: 'Outils' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Taille du texte')).toBeVisible();
  await expect(actions).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('alqalam-outils.png') });
});
