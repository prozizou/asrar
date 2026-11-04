import { describe, expect, it } from 'vitest';
import { database, runtime, invoke } from './support/runtime';

const user = { uid: 'visitor', email: 'visitor@example.test' };
const day = new Date().toISOString().slice(0, 10);

async function visit(db, ua) {
  const handler = runtime(db, { user })('pages/api/track.js').default;
  const res = {
    code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.code = n; return this; },
    json(v) { this.body = v; return this; }, end() { return this; },
  };
  await handler({ method: 'POST', headers: { 'user-agent': ua }, body: { idToken: 'x', type: 'visit', page: 'accueil' } }, res);
  return res;
}

describe('Type d’appareil à la visite (/api/track)', () => {
  it('enregistre la catégorie, jamais le user-agent', async () => {
    const db = database({ account_settings: { visitor: { analytics: true } } });
    const ua = 'Mozilla/5.0 (Linux; Android 13; SM-A145F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36';
    await visit(db, ua);
    const stored = db.read('analytics/visits/' + day + '/visitor');
    expect(stored.platform).toBe('android_app');
    expect(JSON.stringify(stored)).not.toContain('Mozilla');
  });
  it('sans accord statistiques, rien n’est enregistré', async () => {
    const db = database();
    await visit(db, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
    expect(db.read('analytics/visits')).toBeNull();
  });
});
