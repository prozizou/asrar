import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { database, runtime } from './support/runtime';

const day = new Date().toISOString().slice(0, 10);

function request(body, contentType = 'application/csp-report') {
  const req = new EventEmitter();
  Object.assign(req, { method: 'POST', headers: { 'content-type': contentType, 'x-forwarded-for': '203.0.113.9' }, destroy() {} });
  setTimeout(() => { req.emit('data', Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))); req.emit('end'); }, 0);
  return req;
}
async function send(db, body, contentType, stubs = {}) {
  const handler = runtime(db, { stubs, globals: { process: { ...process, env: { ...process.env, SITE_URL: 'https://www.asrarpro.com' } } } })('pages/api/csp-report.js').default;
  const res = { code: 0, status(n) { this.code = n; return this; }, end() { return this; } };
  await handler(request(body, contentType), res);
  return res;
}
const violation = (blockedURL, effectiveDirective, documentURL = 'https://www.asrarpro.com/zikr') =>
  ({ type: 'csp-violation', body: { documentURL, blockedURL, effectiveDirective } });

describe('Collecte des rapports CSP (/api/csp-report)', () => {
  it('agrège par jour, directive et domaine, sans URL complète', async () => {
    const db = database();
    await send(db, [violation('https://ads.one.example/s.js?u=1', 'script-src-elem'), violation('https://ads.one.example/t.js', 'script-src-elem'), violation('https://beacon.two.example/i', 'connect-src')], 'application/reports+json');
    await send(db, { 'csp-report': { 'document-uri': 'https://www.asrarpro.com/', 'blocked-uri': 'https://beacon.two.example/x', 'violated-directive': 'connect-src' } });
    expect(db.read('analytics/csp/' + day)).toEqual({
      _n: 4,
      'script-src-elem': { 'ads,one,example': 2 },
      'connect-src': { 'beacon,two,example': 2 },
    });
  });

  it('ignore les rapports d’autres sites, les corps invalides et les autres méthodes', async () => {
    const db = database();
    expect((await send(db, [violation('https://x.example/', 'script-src', 'https://autre-site.example/')], 'application/reports+json')).code).toBe(204);
    expect((await send(db, 'pas du json')).code).toBe(204);
    expect(db.read('analytics/csp')).toBeNull();
    const handler = runtime(database())('pages/api/csp-report.js').default;
    const res = { code: 0, status(n) { this.code = n; return this; }, end() { return this; } };
    await handler({ method: 'GET', headers: {} }, res);
    expect(res.code).toBe(405);
  });

  it('respecte le plafond quotidien et la limite de débit', async () => {
    const full = database({ analytics: { csp: { [day]: { _n: 20000 } } } });
    await send(full, [violation('https://ads.one.example/', 'script-src')], 'application/reports+json');
    expect(full.read('analytics/csp/' + day)).toEqual({ _n: 20000 });
    const limited = database();
    await send(limited, [violation('https://ads.one.example/', 'script-src')], 'application/reports+json', { 'lib/rateLimit.js': { rateLimit: () => false } });
    expect(limited.read('analytics/csp')).toBeNull();
  });
});
