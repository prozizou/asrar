import { test, expect, tokenAs } from './fixtures';
const { app } = require('../../server/grant');

test('les diagnostics reçus sont nettoyés et les lectures directes restent interdites', async ({ request }) => {
  const token = await tokenAs(request, 'free');
  // La suite ouvre de nombreuses pages depuis 127.0.0.1 ; ses diagnostics
  // automatiques peuvent épuiser le quota de cette IP. Source de test isolée,
  // sans désactiver ni relever les limites appliquées au vrai endpoint.
  const response = await request.post('/api/client-error', { headers: { 'x-forwarded-for': '192.0.2.42' }, data: {
    idToken: token,
    events: [{ kind: 'api', endpoint: 'diagnostic-fixture', page: '/zikr?token=private', name: 'TypeError', message: 'private message', idToken: 'private', uid: 'forged', version: 'v46.93' }],
    uid: 'forged',
  } });
  expect(response.status()).toBe(204);
  const snap = await app().database().ref('app_diagnostics').once('value');
  const item: any = Object.values(snap.val() || {}).find((value: any) => value.endpoint === '/api/diagnostic-fixture');
  expect(item).toMatchObject({ lastUid: 'fixture-free', page: '/zikr', kind: 'api' });
  expect(JSON.stringify(item)).not.toMatch(/private|forged/);
  // Firebase ID token via auth= (Bearer OAuth est traité comme un compte
  // de service par l’émulateur et contournerait les règles à tester).
  const url = 'http://127.0.0.1:9000/app_diagnostics.json?ns=demo-asrar-test-default-rtdb&auth=' + encodeURIComponent(token);
  expect((await request.get(url)).status()).toBe(401);
  const write = await request.put(url.replace('/app_diagnostics.json', '/app_diagnostics/injected.json'), { data: { count: 999 } });
  expect(write.status()).toBe(401);
});

test('une erreur navigateur est transmise automatiquement avec sa version et la session vérifiée', async ({ page, login }) => {
  await login('free');
  await page.goto('/notifications');
  await expect(page.getByText('Notification personnelle', { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const error = new TypeError('private text');
    error.stack = 'TypeError: private text\n at fn (' + location.origin + '/_next/static/chunks/diagnostic-fixture.js?token=private:7:9)';
    window.dispatchEvent(new ErrorEvent('error', { error, message: error.message }));
  });
  await expect.poll(async () => {
    const snap = await app().database().ref('app_diagnostics').once('value');
    return Object.values(snap.val() || {}).find((value: any) => value.stack === '/_next/static/chunks/diagnostic-fixture.js:7:9');
  }, { timeout: 15000 }).toMatchObject({ kind: 'javascript', name: 'TypeError', page: '/notifications', version: 'v46.93', lastUid: 'fixture-free' });
});
