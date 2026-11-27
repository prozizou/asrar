import { describe, expect, it } from 'vitest';
import { database, runtime, invoke } from './support/runtime';

const event = { kind: 'render', name: 'TypeError', page: '/zikr', version: 'v46.93', stack: 'TypeError\n at x (https://www.asrarpro.com/_next/static/chunks/a.js:12:8)' };
const now = Date.UTC(2026, 10, 27, 12);

describe('Diagnostics envoyés par lots', () => {
  it('un lot de 5 événements identiques coûte 3 transactions au lieu de 15', async () => {
    const db = database();
    const { recordDiagnostics } = runtime(db)('server/diagnostics.js');
    expect(await recordDiagnostics(db, Array.from({ length: 5 }, () => event), { source: 'ip' }, now)).toBe(5);
    expect(db.metrics.transactions).toBe(3);
    const groups = Object.values(db.read('app_diagnostics'));
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(5);
    expect(db.read('app_diagnostic_limits/20261127_total')).toBe(5);
  });
  it('le quota par source reste respecté sur un lot partiel', async () => {
    const db = database();
    const { recordDiagnostics } = runtime(db)('server/diagnostics.js');
    for (let i = 0; i < 98; i++) await recordDiagnostics(db, [event], { source: 'ip' }, now);
    expect(await recordDiagnostics(db, Array.from({ length: 5 }, () => event), { source: 'ip' }, now)).toBe(2);
    expect(Object.values(db.read('app_diagnostics'))[0].count).toBe(100);
  });
  it('la réception ne vérifie plus la révocation du jeton (appel réseau évité)', async () => {
    const db = database();
    const calls = [];
    const handler = runtime(db, { stubs: { 'server/grant.js': { app: () => ({ database: () => db, auth: () => ({ verifyIdToken: async (...args) => { calls.push(args); return { uid: 'u' }; } }) }) } } })('pages/api/client-error.js').default;
    expect((await invoke(handler, { idToken: 'tok', events: [event, event] })).code).toBe(204);
    expect(calls).toEqual([['tok']]);
    expect(Object.values(db.read('app_diagnostics'))[0]).toMatchObject({ count: 2, lastUid: 'u' });
  });
});

describe('Fil d’activité', () => {
  it('un lot d’actions est écrit en une seule mise à jour', async () => {
    const db = database();
    const handler = runtime(db, { user: { uid: 'u1', email: 'u1@example.test' } })('pages/api/track.js').default;
    const t = Date.now();
    const events = Array.from({ length: 20 }, (_, i) => ({ type: 'click', page: 'marche', label: 'b' + i, at: t - 1000 }));
    let updates = 0;
    const origRef = db.ref;
    db.ref = (p) => { const r = origRef(p); if (!p) { const u = r.update; r.update = (v) => { updates++; return u(v); }; } return r; };
    const res = await invoke(handler, { idToken: 'x', type: 'actions', events });
    expect(res.body).toEqual({ ok: true, count: 20 });
    expect(updates).toBe(1);
    expect(Object.keys(db.read('activity_feed'))).toHaveLength(20);
    expect(db.read('user_sessions/u1')).toMatchObject({ email: 'u1@example.test', lastAction: 'b19', lastPage: 'marche' });
  });
  it('purge les entrées de plus de 14 jours par clé, sans toucher aux récentes', async () => {
    const { pushKeyPrefix, purgeActivityFeed } = runtime(database())('server/activityFeed.js');
    const DAY = 86400000;
    const old = pushKeyPrefix(now - 20 * DAY) + 'aaaaaaaaaaaa';
    const old2 = pushKeyPrefix(now - 15 * DAY) + 'bbbbbbbbbbbb';
    const fresh = pushKeyPrefix(now - 2 * DAY) + 'cccccccccccc';
    const db = database({ activity_feed: { [old]: { at: 1 }, [old2]: { at: 2 }, [fresh]: { at: 3 } } });
    expect(await purgeActivityFeed(db, now)).toBe(2);
    expect(Object.keys(db.read('activity_feed'))).toEqual([fresh]);
    expect(db.metrics.reads.every((r) => r.query.order === '.key')).toBe(true);
  });
  it('les clés push générées suivent l’ordre chronologique', () => {
    const { pushKeyPrefix } = runtime(database())('server/activityFeed.js');
    expect(pushKeyPrefix(now)).toHaveLength(8);
    expect(pushKeyPrefix(now - 1) < pushKeyPrefix(now)).toBe(true);
    expect(pushKeyPrefix(1795820000000).startsWith('-P')).toBe(true);
  });
});

describe('Lectures globales partagées (téléchargements RTDB)', () => {
  it('le Marché ne relit pas tous les likes/avis à chaque ouverture, mais voit un nouveau like', async () => {
    const db = database({ ratings: { product: { p1: { a: 1 } } }, comments: { product: {} } });
    const handler = runtime(db, { user: { uid: 'b', email: 'b@example.test' } })('pages/api/social.js').default;
    for (let i = 0; i < 5; i++) await invoke(handler, { action: 'market-popularity' });
    expect(db.metrics.reads.filter((r) => r.path === 'ratings/product')).toHaveLength(1);
    await invoke(handler, { action: 'toggle-like', cat: 'product', key: 'p1' });
    const res = await invoke(handler, { action: 'market-popularity' });
    expect(Object.keys(res.body.likes.p1)).toEqual(['a', 'b']);
  });
  it('la liste des zikr est partagée entre sondages et rafraîchie après une création', async () => {
    const db = database({ zikr_groups: { g1: { name: 'A', target: 10, total: 0, ownerUid: 'u', approved: true } } });
    const handler = runtime(db, { user: { uid: 'u', email: 'u@example.test' } })('pages/api/zikr.js').default;
    await invoke(handler, { action: 'list' });
    await invoke(handler, { action: 'list' });
    expect(db.metrics.reads.filter((r) => r.path === 'zikr_groups')).toHaveLength(1);
    await invoke(handler, { action: 'delete', groupId: 'g1' });
    await invoke(handler, { action: 'list' });
    expect(db.metrics.reads.filter((r) => r.path === 'zikr_groups')).toHaveLength(2);
  });
});
