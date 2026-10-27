import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { database, runtime, invoke } from './support/runtime';

afterEach(() => vi.unstubAllEnvs());

function fixture(initial, options = {}) {
  vi.stubEnv('CRON_SECRET', 'fixture-secret');
  vi.stubEnv('VERCEL', '0');
  vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', '');
  const db = database(initial);
  const load = runtime(db, { stubs: {
    'server/grant.js': { app: () => ({ database: () => db,
      auth: () => ({ getUserByEmail: async () => ({ uid: 'tester' }), ...options.auth }) }) },
  } });
  const handler = load('pages/api/cron/reminders.js').default;
  const run = () => invoke((req, res) => handler({ ...req, headers: { authorization: 'Bearer fixture-secret' } }, res));
  return { db, load, run };
}

describe('Rappels persistants', () => {
  it('deux crons concurrents créent un seul rappel par session sans exiger VAPID', async () => {
    const sessionAt = Date.now() + 1200000;
    const { db, load, run } = fixture({ zikr_groups: { g: { ownerUid: 'tester', name: 'Groupe', sessionAt } },
      zikr_members: { g: { tester: {}, member: {} } } });
    for (const response of await Promise.all([run(), run()])) expect(response.code).toBe(200);
    expect(Object.keys(db.read('notification_jobs'))).toHaveLength(1);
    expect(db.read('zikr_groups/g/sessionReminderSent')).toBe(true);
    await load('server/notificationWorker.js').processNotificationQueue(db);
    for (const uid of ['tester', 'member']) expect(Object.keys(db.read(`notifications/${uid}`))).toHaveLength(1);
  });

  it('une panne de mise en file ne marque pas le rappel comme pris en charge', async () => {
    const sessionAt = Date.now() + 1200000;
    const { db, run } = fixture({ zikr_groups: { g: { ownerUid: 'tester', sessionAt } } });
    const id = createHash('sha256').update(`session:g:${sessionAt}`).digest('hex');
    db.failNext(`notification_jobs/${id}`, 'transaction');
    expect((await run()).code).toBe(500);
    expect(db.read('zikr_groups/g/sessionReminderSent')).toBeNull();
    expect(db.read('notification_jobs')).toBeNull();
    expect((await run()).code).toBe(200);
    expect(db.read('zikr_groups/g/sessionReminderSent')).toBe(true);
  });

  it('ne livre pas le rappel d’une session reprogrammée', async () => {
    const sessionAt = Date.now() + 1200000;
    const { db, load, run } = fixture({ zikr_groups: { g: { ownerUid: 'tester', sessionAt } } });
    await run();
    await db.ref('zikr_groups/g').update({ sessionAt: sessionAt + 86400000, sessionReminderSent: false });
    const stats = await load('server/notificationWorker.js').processNotificationQueue(db);
    expect(stats.skipped).toBe(1);
    expect(db.read('notifications/tester')).toBeNull();
  });

  it('annule un rappel d’échéance après une prolongation', async () => {
    const expiresAt = Date.now() + 86400000;
    const { db, load, run } = fixture({ purchased_user: { 'user@example,test': { token: 'purchase', expiresAt } } });
    expect((await run()).code).toBe(200);
    expect(Object.keys(db.read('notification_jobs'))).toHaveLength(1);
    await db.ref('purchased_user/user@example,test/expiresAt').set(expiresAt + 30 * 86400000);
    expect((await load('server/notificationWorker.js').processNotificationQueue(db)).skipped).toBe(1);
    expect(db.read('notifications/tester')).toBeNull();
  });

  it('conserve la tâche si l’écriture du marqueur échoue et ne renvoie pas le rappel déjà livré', async () => {
    const expiresAt = Date.now() + 86400000, key = 'user@example,test';
    const { db, load, run } = fixture({ purchased_user: { [key]: { token: 'purchase', expiresAt } } });
    db.failNext(`purchased_user/${key}`, 'update');
    expect((await run()).code).toBe(500);
    expect(Object.keys(db.read('notification_jobs'))).toHaveLength(1);
    await load('server/notificationWorker.js').processNotificationQueue(db);
    expect((await run()).code).toBe(200);
    await load('server/notificationWorker.js').processNotificationQueue(db);
    expect(Object.keys(db.read('notifications/tester'))).toHaveLength(1);
  });

  it('une panne Auth n’est pas confondue avec un compte inexistant', async () => {
    const expiresAt = Date.now() + 86400000;
    const { db, run } = fixture({ purchased_user: { 'user@example,test': { token: 'purchase', expiresAt } } }, {
      auth: { getUserByEmail: async () => { throw { code: 'auth/internal-error' }; } },
    });
    expect((await run()).code).toBe(500);
    expect(db.read('purchased_user/user@example,test/renewalReminderForExpiry')).toBeNull();
  });
});

describe('Publication atomique des activations', () => {
  function admin(db) {
    return runtime(db, { stubs: {
      'server/access.js': { verifyUser: async () => ({ uid: 'admin', email: 'admin@example.test' }),
        isAdmin: async () => true, emailKey: (email) => email.replace(/\./g, ',') },
      'server/grant.js': { app: () => ({ database: () => db, auth: () => ({ getUserByEmail: async () => ({ uid: 'tester' }) }) }) },
    } })('pages/api/admin.js').default;
  }
  it('ne valide pas un accès si sa notification ne peut pas être persistée', async () => {
    const db = database();
    db.failNext('', 'update');
    expect((await invoke(admin(db), { action: 'grant-access', email: 'user@example.test', days: 30, level: 15000 })).code).toBe(500);
    expect(db.read('allowedUsers')).toBeNull();
    expect(db.read('notification_jobs')).toBeNull();
  });
  it('ne valide pas l’activation d’une boutique sans sa notification', async () => {
    const db = database({ sellers: { tester: { shopActive: false, shop: { name: 'Boutique' } } } });
    db.failNext('', 'update');
    expect((await invoke(admin(db), { action: 'seller-action', uid: 'tester', op: 'activate' })).code).toBe(500);
    expect(db.read('sellers/tester/shopActive')).toBe(false);
    expect(db.read('notification_jobs')).toBeNull();
  });
});
