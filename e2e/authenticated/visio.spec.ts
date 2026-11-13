import { test, expect } from './fixtures';
const { app } = require('../../server/grant');

const TITLE = 'Cours en ligne e2e';

test('une visioconférence proposée n’est visible de tous qu’après validation par l’administration', async ({ browser, login }) => {
  await app().database().ref('visio_meetings').remove();
  const start = new Date(Date.now() + 26 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const local = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`;

  // 1. Un utilisateur propose la réunion depuis le menu.
  const creator = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await login('free', creator);
  await creator.goto('/visio');
  await creator.getByRole('button', { name: 'Proposer une visioconférence' }).click();
  await creator.getByLabel('Titre').fill(TITLE);
  await creator.getByLabel('Lien Google Meet').fill('https://evil.example/abc-defg-hij');
  await creator.getByLabel('Début').fill(local);
  await creator.getByRole('button', { name: 'Envoyer pour validation' }).click();
  await expect(creator.locator('.vi-error')).toContainText('lien Google Meet valide');
  await creator.getByLabel('Lien Google Meet').fill('https://meet.google.com/abc-defg-hij');
  await creator.getByLabel('Description').fill('Introduction et questions-réponses.');
  await creator.getByRole('button', { name: 'Envoyer pour validation' }).click();
  const pending = creator.getByRole('article', { name: TITLE });
  await expect(pending).toContainText('En attente');
  await creator.screenshot({ path: test.info().outputPath('visio-pending.png') });

  // 2. Un autre compte ne la voit pas encore.
  const viewer = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await login('basic', viewer);
  await viewer.goto('/visio');
  await expect(viewer.getByText('Aucune visioconférence programmée')).toBeVisible();

  // 3. L'administrateur l'approuve depuis la file « À valider ».
  const admin = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await login('admin', admin);
  await admin.goto('/visio');
  const toValidate = admin.getByRole('region', { name: 'Visioconférences à valider' }).getByRole('article', { name: TITLE });
  await expect(toValidate).toContainText('free@asrar.test');
  await toValidate.getByRole('button', { name: 'Approuver' }).click();
  await expect(admin.getByRole('region', { name: 'Visioconférences programmées' }).getByRole('article', { name: TITLE })).toBeVisible();

  // 4. Visible de tous, avec le lien Meet, et notification diffusée.
  await viewer.reload();
  const card = viewer.getByRole('article', { name: TITLE });
  await expect(card).toContainText('Introduction et questions-réponses.');
  await expect(card.getByRole('link', { name: 'Rejoindre sur Google Meet' })).toHaveAttribute('href', 'https://meet.google.com/abc-defg-hij');
  await expect(card.getByRole('button', { name: 'Supprimer' })).toHaveCount(0);
  await viewer.screenshot({ path: test.info().outputPath('visio-approved.png') });
  const jobs = (await app().database().ref('notification_jobs').once('value')).val() || {};
  expect(JSON.stringify(jobs)).toContain('Nouvelle visioconférence');
});
