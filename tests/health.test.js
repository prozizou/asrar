import { expect, it } from 'vitest';
import { runtime, database } from './support/runtime';
async function check(app, method = 'GET') {
  const db = database({});
  const handler = runtime(db, { stubs: { 'server/grant.js': { app } } })('pages/api/health.js').default;
  const res = { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.code = n; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method, headers: {} }, res); return { ...res, db };
}
it('vérifie le démarrage sans requête ni écriture dans Firebase', async () => {
  const result = await check(() => ({ auth() {}, database() {} }));
  expect(result.code).toBe(200); expect(result.body.status).toBe('ready');
  expect(result.body.databaseConnection).toBe('not_tested');
  expect(result.headers['Cache-Control']).toBe('no-store');
  expect(result.db.metrics.reads).toHaveLength(0); expect(result.db.metrics.transactions).toBe(0);
});
it('ne divulgue ni secret ni stack si la configuration Firebase échoue', async () => {
  const result = await check(() => { throw new Error('private_key: private-content'); });
  expect(result.code).toBe(503); expect(result.body.stage).toBe('firebase_configuration');
  expect(JSON.stringify(result.body)).not.toContain('private-content');
  expect(result.body.stack).toBeUndefined();
});
it('limite le diagnostic d’une dépendance absente à son nom public', async () => {
  const result = await check(() => { throw Object.assign(new Error("Cannot find module 'some-package/internal'\nprivate stack"), { code: 'MODULE_NOT_FOUND' }); });
  expect(result.body).toMatchObject({ code: 'MODULE_NOT_FOUND', dependency: 'some-package/internal' });
  expect(JSON.stringify(result.body)).not.toContain('private stack');
});
it('ne divulgue pas un chemin local dans le diagnostic', async () => {
  const result = await check(() => { throw Object.assign(new Error("Cannot find module '/private/account.json'"), { code: 'MODULE_NOT_FOUND' }); });
  expect(result.body.dependency).toBeUndefined();
});
it('refuse toute méthode qui pourrait modifier des données', async () => {
  const result = await check(() => { throw new Error('ne doit pas être appelé'); }, 'POST');
  expect(result.code).toBe(405);
});
