import { describe, expect, it } from 'vitest';
import { database, runtime } from './support/runtime';

const day = new Date().toISOString().slice(0, 10);
const UA_APP = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A; wv) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';

async function send(db, body, { stubs = {}, ua = UA_APP, method = 'POST', verify } = {}) {
  const grant = { app: () => ({ database: () => db, auth: () => ({ verifyIdToken: verify || (async () => { throw new Error('invalide'); }) }) }) };
  const logged = [];
  const handler = runtime(db, { stubs: { 'server/grant.js': grant, 'server/log.js': { reportError: async (...a) => { logged.push(a); } }, ...stubs } })('pages/api/client-error.js').default;
  const res = { code: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.code = n; return this; }, end() { return this; }, json() { return this; } };
  await handler({ method, headers: { 'user-agent': ua, 'x-forwarded-for': '203.0.113.7' }, body }, res);
  return { res, logged };
}

describe('Bugs remontés par l’application (/api/client-error)', () => {
  it('regroupe les occurrences d’un même bug et garde le contexte', async () => {
    const db = database();
    const report = (n) => ({ kind: 'error', message: `Groupe ${n} introuvable`, stack: 'Error\n at load (/_next/page-abc12345.js:1:2)', page: '/zikr?x=1', version: 'v46.93' });
    const { res, logged } = await send(db, { reports: [report(1), report(2)] });
    expect(res.code).toBe(204);
    expect(logged).toHaveLength(2);
    const groups = db.read('bug_reports/groups');
    const [fp] = Object.keys(groups);
    expect(Object.keys(groups)).toHaveLength(1);
    expect(groups[fp]).toMatchObject({ kind: 'error', count: 2, status: 'open', page: '/zikr', lastVersion: 'v46.93', platforms: { android_app: 2 }, versions: { 'v46,93': 2 } });
    expect(Object.values(db.read('bug_reports/events/' + fp))).toHaveLength(2);
    expect(db.read('bug_reports/daily/' + day)).toEqual({ _n: 2, error: 2 });
  });

  it('lit encore l’ancien format { message, stack, url }', async () => {
    const db = database();
    await send(db, { message: 'boom', stack: 'Error: boom', url: 'https://www.asrarpro.com/compte' });
    const [group] = Object.values(db.read('bug_reports/groups'));
    expect(group).toMatchObject({ kind: 'error', message: 'boom', page: '/compte', platforms: { android_app: 1 } });
  });

  it('joint l’e-mail d’un compte connecté à un signalement, chacun dans son propre groupe', async () => {
    const db = database();
    const verify = async () => ({ uid: 'u1', email: 'membre@example.invalid' });
    await send(db, { idToken: 'jeton', reports: [{ kind: 'user', detail: 'Le compteur se bloque', page: '/zikr' }] }, { verify });
    await send(db, { idToken: 'jeton', reports: [{ kind: 'user', detail: 'Le compteur se bloque', page: '/zikr' }] }, { verify });
    const groups = Object.values(db.read('bug_reports/groups'));
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ kind: 'user', detail: 'Le compteur se bloque', reporter: 'membre@example.invalid' });
    const fp = Object.keys(db.read('bug_reports/groups'))[0];
    expect(Object.values(db.read('bug_reports/events/' + fp))[0]).toMatchObject({ uid: 'u1', email: 'membre@example.invalid' });
  });

  it('lenteurs : durée max et cumul, pas de journalisation d’erreur', async () => {
    const db = database();
    const lag = (ms) => ({ kind: 'lag', label: 'Interface figée', message: 'Interface figée', durationMs: ms, page: '/planete' });
    const { logged } = await send(db, { reports: [lag(2500), lag(4000)] });
    expect(logged).toHaveLength(0);
    const [group] = Object.values(db.read('bug_reports/groups'));
    expect(group).toMatchObject({ kind: 'lag', count: 2, maxMs: 4000, sumMs: 6500 });
  });

  it('un bug résolu qui revient est rouvert et marqué en régression', async () => {
    const db = database();
    const body = { reports: [{ kind: 'error', message: 'boom', page: '/' }] };
    await send(db, body);
    const fp = Object.keys(db.read('bug_reports/groups'))[0];
    await db.ref('bug_reports/groups/' + fp).update({ status: 'resolved', resolvedAt: 1 });
    await send(db, body);
    expect(db.read('bug_reports/groups/' + fp)).toMatchObject({ status: 'open', regressed: true, count: 2 });
    expect(db.read('bug_reports/groups/' + fp + '/resolvedAt')).toBeNull();
  });

  it('ne garde que les 20 dernières occurrences d’un bug', async () => {
    const db = database();
    for (let i = 0; i < 3; i++) await send(db, { reports: Array.from({ length: 10 }, () => ({ kind: 'error', message: 'boom', page: '/' })) });
    const fp = Object.keys(db.read('bug_reports/groups'))[0];
    expect(db.read('bug_reports/groups/' + fp).count).toBe(30);
    expect(Object.keys(db.read('bug_reports/events/' + fp))).toHaveLength(20);
  });

  it('ignore le bruit, les autres méthodes, et respecte plafond et limite de débit', async () => {
    const db = database();
    await send(db, { reports: [{ kind: 'error', message: 'Script error.' }] });
    expect(db.read('bug_reports')).toBeNull();
    expect((await send(db, {}, { method: 'GET' })).res.code).toBe(405);
    const full = database({ bug_reports: { daily: { [day]: { _n: 5000 } } } });
    await send(full, { reports: [{ kind: 'error', message: 'boom' }] });
    expect(full.read('bug_reports/groups')).toBeNull();
    const limited = database();
    await send(limited, { reports: [{ kind: 'error', message: 'boom' }] }, { stubs: { 'lib/rateLimit.js': { rateLimit: () => false } } });
    expect(limited.read('bug_reports')).toBeNull();
  });
});
