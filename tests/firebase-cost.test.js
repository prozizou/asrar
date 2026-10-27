import { afterEach, describe, expect, it, vi } from 'vitest';
import { database, runtime, invoke } from './support/runtime';

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('Volume des lectures RTDB', () => {
  it('le badge conserve le bon total en lisant moins de 6 % de l’historique du scénario', async () => {
    const db = database({ notifications: { tester: Object.fromEntries(Array.from({ length: 200 }, (_, i) =>
      ['n' + i, { createdAt: i, read: i < 190, body: 'x'.repeat(1000) }])) } });
    const handler = runtime(db)('pages/api/notifications.js').default;
    const list = await invoke(handler, { action: 'list' });
    const baseline = db.metrics.readBytes;
    const badge = await invoke(handler, { action: 'badge' });
    expect(badge.body).toEqual({ unread: list.body.unread });
    expect(badge.body.unread).toBe(10);
    expect(db.metrics.readBytes - baseline).toBeLessThan(baseline * 0.06);
  });

  it('inclut les anciennes notifications sans champ read', async () => {
    const db = database({ notifications: { tester: { legacy: { body: 'Ancienne' }, read: { read: true }, fresh: { read: false } } } });
    expect((await invoke(runtime(db)('pages/api/notifications.js').default, { action: 'badge' })).body.unread).toBe(2);
  });

  it('50 consultations concurrentes du catalogue partagent une seule lecture sans exposer le PDF', async () => {
    const db = database({ almaqtab: { book: { titre: 'Livre', description: 'x'.repeat(1000), pdf: 'https://private.invalid/paywall' } } });
    const handler = runtime(db)('pages/api/list-content.js').default;
    const results = await Promise.all(Array.from({ length: 50 }, () => invoke(handler, { kind: 'book' })));
    expect(results.every((result) => result.code === 200)).toBe(true);
    expect(db.metrics.reads).toHaveLength(1);
    expect(results[0].body.items[0].pdf).toBeUndefined();
    results[0].body.items[0].titre = 'Mutation du client';
    expect((await invoke(handler, { kind: 'book' })).body.items[0].titre).toBe('Livre');
  });

  it('expire le cache public et ne met pas en cache les échecs', async () => {
    vi.useFakeTimers();
    const db = database({ almaqtab: { book: { titre: 'Ancien' } } }), load = runtime(db);
    const handler = load('pages/api/list-content.js').default;
    await invoke(handler, { kind: 'book' });
    await db.ref('almaqtab/book/titre').set('Nouveau');
    vi.advanceTimersByTime(30001);
    db.failNext('almaqtab', 'read');
    expect((await invoke(handler, { kind: 'book' })).code).toBe(500);
    expect((await invoke(handler, { kind: 'book' })).body.items[0].titre).toBe('Nouveau');
  });

  it('une lecture commencée avant invalidation ne repeuple pas le cache avec un ancien catalogue', async () => {
    const db = database(), cache = runtime(db)('server/publicCatalogCache.js');
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const old = cache.publicCatalog(db, 'almaqtab', async () => { await gate; return ['Ancien']; });
    cache.invalidatePublicCatalog(db, 'almaqtab/book');
    expect(await cache.publicCatalog(db, 'almaqtab', async () => ['Nouveau'])).toEqual(['Nouveau']);
    release(); await old;
    expect(await cache.publicCatalog(db, 'almaqtab', async () => ['Incorrect'])).toEqual(['Nouveau']);
  });

  it('le catalogue en cache reste inaccessible sans identité vérifiée', async () => {
    const db = database({ almaqtab: { book: { titre: 'Livre' } } });
    let verified = true;
    const load = runtime(db, { stubs: { 'server/access.js': { verifyUser: async () => {
      if (!verified) throw Object.assign(new Error('Session refusée'), { statusCode: 403 });
    } } } });
    const handler = load('pages/api/list-content.js').default;
    expect((await invoke(handler, { kind: 'book' })).code).toBe(200);
    verified = false;
    expect((await invoke(handler, { kind: 'book' })).code).toBe(403);
    expect(db.metrics.reads).toHaveLength(1);
  });

  it('une discussion inchangée ne relit pas ses 200 anciens messages', async () => {
    const db = database({ zikr_members: { g: { tester: { joinedAt: 1 } } },
      zikr_chat: { g: Object.fromEntries(Array.from({ length: 200 }, (_, i) =>
        ['m' + String(i).padStart(3, '0'), { uid: 'tester', text: 'x'.repeat(500), at: i }])) } });
    const handler = runtime(db)('pages/api/zikr.js').default;
    expect((await invoke(handler, { action: 'messages', groupId: 'g' })).body.messages).toHaveLength(200);
    const baseline = db.metrics.readBytes;
    expect((await invoke(handler, { action: 'messages', groupId: 'g', after: 'm199' })).body).toEqual({ messages: [], incremental: true });
    expect(db.metrics.readBytes - baseline).toBeLessThan(baseline * 0.001);
    await db.ref('zikr_chat/g/m200').set({ uid: 'tester', text: 'Nouveau', at: 200 });
    expect((await invoke(handler, { action: 'messages', groupId: 'g', after: 'm199' })).body.messages.map((m) => m.text)).toEqual(['Nouveau']);
    await db.ref('zikr_members/g/tester').remove();
    expect((await invoke(handler, { action: 'messages', groupId: 'g', after: 'm200' })).code).toBe(403);
  });

  it('le cron des sessions ne télécharge pas les 1000 groupes hors fenêtre', async () => {
    vi.stubEnv('CRON_SECRET', 'fixture'); vi.stubEnv('VERCEL', '0');
    const now = Date.now();
    const groups = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => ['g' + i,
      { sessionAt: now - 86400000, name: 'Ancien', description: 'x'.repeat(500) }]));
    groups.current = { sessionAt: now + 600000, ownerUid: 'tester', name: 'Actuel' };
    const db = database({ zikr_groups: groups }), handler = runtime(db)('pages/api/cron/reminders.js').default;
    const response = await invoke((req, res) => handler({ ...req, headers: { authorization: 'Bearer fixture' } }, res));
    expect(response.code).toBe(200);
    expect(response.body.sessionQueued).toBe(1);
    const scan = db.metrics.reads.find((read) => read.path === 'zikr_groups');
    expect(scan.bytes).toBeLessThan(200);
    expect(scan.bytes).toBeLessThan(Buffer.byteLength(JSON.stringify(groups)) * 0.001);
  });
});
