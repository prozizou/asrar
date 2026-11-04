// Un vrai blocage de la CSP (lib/csp.js, report-uri) dans un vrai navigateur
// doit être compté par pages/api/csp-report.js dans analytics/csp/{jour} —
// directive et domaine seulement.
import { test, expect } from './fixtures';

test('un script bloqué par la CSP est compté par domaine dans analytics/csp', async ({ page, login }) => {
  await login('free');
  await page.goto('/menu');
  await page.evaluate(() => {
    const s = document.createElement('script');
    s.src = 'https://blocked-ads.example.test/tag.js?visiteur=secret';
    document.body.appendChild(s);
  });
  const { app } = require('../../server/grant');
  const ref = app().database().ref('analytics/csp/' + new Date().toISOString().slice(0, 10));
  await expect.poll(async () => (await ref.once('value')).val(), { timeout: 20_000 })
    .toMatchObject({ 'script-src-elem': { 'blocked-ads,example,test': expect.any(Number) } });
  expect(JSON.stringify((await ref.once('value')).val())).not.toContain('secret');
});
