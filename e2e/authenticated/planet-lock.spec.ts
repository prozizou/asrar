import { test, expect } from './fixtures';
const { app } = require('../../server/grant');
const { accounts } = require('./accounts.cjs');

// D'autres scénarios accordent un accès au compte « free » (ex. notifications) :
// on retire cet accès le temps du test, puis on restaure l'état d'origine.
const freeKey = accounts.free.email.replace(/\./g, ',');
const isolatedPaths = ['purchased_user/' + freeKey, 'allowedUsers/' + freeKey];
let saved: Record<string, unknown> = {};
test.beforeEach(async () => {
  const db = app().database(); saved = {};
  for (const path of isolatedPaths) saved[path] = (await db.ref(path).once('value')).val();
  await db.ref().update(Object.fromEntries(isolatedPaths.map((path) => [path, null])));
});
test.afterEach(async () => { await app().database().ref().update(saved); });

const PLANETS = /Saturne|Jupiter|Mars|Soleil|Vénus|Mercure|Lune/;
const DAKAR = JSON.stringify({ name: 'Dakar', lat: 14.7167, lng: -17.4677, timeZone: 'Africa/Dakar' });

test('sans abonnement, l’heure planétaire en cours est floutée et jamais rendue dans la page', async ({ page, login }) => {
  await page.setViewportSize({ width: 360, height: 850 }); await login('free');
  await page.evaluate((place) => localStorage.setItem('asrar_planete_place', place), DAKAR);
  await page.goto('/planete');
  const card = page.getByRole('region', { name: 'Heure planétaire actuelle' });
  await expect(card).toHaveClass(/is-locked/);
  await expect(card.getByText('Réservé aux abonnés')).toBeVisible();
  await expect(card).not.toContainText(PLANETS);
  await expect(card).not.toContainText(/Favorable|Défavorable|Neutre/);
  await expect(card.locator('.pm-locked-body')).toHaveCSS('filter', 'blur(7px)');
  await page.screenshot({ path: test.info().outputPath('planete-locked.png') });
  await card.getByRole('button', { name: 'Débloquer avec l’abonnement' }).click();
  await expect(page.getByRole('dialog', { name: 'Abonnement', exact: true })).toBeVisible();
});

test('avec abonnement, l’heure planétaire en cours reste entièrement visible', async ({ page, login }) => {
  await page.setViewportSize({ width: 360, height: 850 }); await login('basic');
  await page.evaluate((place) => localStorage.setItem('asrar_planete_place', place), DAKAR);
  await page.goto('/planete');
  const card = page.getByRole('region', { name: 'Heure planétaire actuelle' });
  await expect(card.locator('.pm-now-planet')).toHaveText(PLANETS);
  await expect(card).not.toHaveClass(/is-locked/);
  await expect(card.getByRole('progressbar')).toBeVisible();
});
