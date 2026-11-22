import { test, expect, tokenAs } from './fixtures';
const { app } = require('../../server/grant');

test('les diagnostics reçus sont nettoyés et les lectures directes restent interdites', async ({ postAs, request }) => {
  const response = await postAs('free', 'client-error', {
    events: [{ kind: 'api', endpoint: 'diagnostic-fixture', page: '/zikr?token=private', name: 'TypeError', message: 'private message', idToken: 'private', uid: 'forged', version: 'v46.93' }],
    uid: 'forged',
  });
  expect(response.status()).toBe(204);
  const snap = await app().database().ref('app_diagnostics').orderByKey().limitToLast(500).once('value');
  const item: any = Object.values(snap.val() || {}).find((value: any) => value.endpoint === '/api/diagnostic-fixture');
  expect(item).toMatchObject({ lastUid: 'fixture-free', page: '/zikr', kind: 'api' });
  expect(JSON.stringify(item)).not.toMatch(/private|forged/);
  const token = await tokenAs(request, 'free');
  const direct = await request.get('http://127.0.0.1:9000/app_diagnostics.json?ns=demo-asrar-test-default-rtdb', { headers: { Authorization: 'Bearer ' + token } });
  expect(direct.status()).toBe(401);
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
    const snap = await app().database().ref('app_diagnostics').orderByKey().limitToLast(500).once('value');
    return Object.values(snap.val() || {}).find((value: any) => value.stack === '/_next/static/chunks/diagnostic-fixture.js:7:9');
  }, { timeout: 15000 }).toMatchObject({ kind: 'javascript', name: 'TypeError', page: '/notifications', version: 'v46.93', lastUid: 'fixture-free' });
});
