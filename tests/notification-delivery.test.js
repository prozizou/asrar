import { afterEach, describe, expect, it, vi } from 'vitest';
import { database, runtime } from './support/runtime';

const notification = { type: 'document', title: 'Document', body: 'Disponible', targetUrl: '/bibliotheque' };
afterEach(() => vi.unstubAllEnvs());

function fixture({ web = {}, sendWeb = async () => {}, sendFcm = async () => {}, vapid = () => {} } = {}) {
  vi.stubEnv('FIREBASE_TEST_MODE', 'false');
  for (const name of ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']) vi.stubEnv(name, 'fixture');
  const db = database({ notification_jobs: { delivery: { kind: 'delivery', uid: 'tester', notificationId: 'event',
    notification, status: 'queued', availableAt: 0, createdAt: Date.now(), attempts: 0 } },
    push_subscriptions: { tester: web }, fcm_devices: { tester: { android: { token: 'android', updatedAt: 1 } } } });
  const load = runtime(db, { stubs: {
    'web-push': { setVapidDetails: vapid },
    'server/webPush.js': { sendWebPush: sendWeb },
    'server/grant.js': { app: () => ({ messaging: () => ({ send: sendFcm }) }) },
  } });
  return { db, queue: load('server/notificationQueue.js'), worker: load('server/notificationWorker.js') };
}

describe('Livraison indépendante par appareil', () => {
  it('deux abonnements Web en panne ne bloquent ni le troisième ni Android', async () => {
    const webSent = [], fcmSent = [];
    const { db, worker } = fixture({ web: { a: { endpoint: 'a' }, b: { endpoint: 'b' }, c: { endpoint: 'c' } },
      sendWeb: async (sub) => { webSent.push(sub.endpoint); if (sub.endpoint !== 'c') throw { statusCode: 503 }; },
      sendFcm: async (message) => { fcmSent.push(message); },
    });
    const now = Date.now();
    await worker.processNotificationQueue(db, { now: () => now });
    expect(webSent).toEqual(['a', 'b', 'c']);
    expect(fcmSent).toHaveLength(1);
    expect(fcmSent[0].android.notification.tag).toBe('document');
    expect(fcmSent[0].android.ttl).toBe(86400000);
    expect(db.read('notification_jobs/delivery/status')).toBe('queued');
    expect(db.read('notification_jobs/delivery/availableAt')).toBe(now + 60000);
    expect(db.read('notification_jobs/delivery/progress/fcm/android')).toBe(true);
    expect(Object.keys(db.read('notifications/tester'))).toEqual(['event']);
  });

  it('une configuration VAPID invalide ne bloque pas Android', async () => {
    const sent = [];
    const { db, worker } = fixture({ web: { a: { endpoint: 'a' } },
      vapid: () => { throw new Error('VAPID invalide'); }, sendFcm: async (message) => { sent.push(message.token); } });
    await worker.processNotificationQueue(db);
    expect(sent).toEqual(['android']);
    expect(db.read('notification_jobs/delivery/progress/failures/web/a/attempts')).toBe(1);
  });

  it('met en échec après cinq essais par appareil puis relance uniquement les appareils en échec', async () => {
    const webSent = [], fcmSent = [];
    let restored = false, now = Date.now();
    const { db, queue, worker } = fixture({ web: { a: { endpoint: 'a' } },
      sendWeb: async () => { webSent.push('a'); if (!restored) throw { statusCode: 503 }; },
      sendFcm: async () => { fcmSent.push('android'); } });
    for (let i = 0; i < 5; i++) {
      await worker.processNotificationQueue(db, { now: () => now });
      now += 3600000;
    }
    expect(webSent).toHaveLength(5);
    expect(fcmSent).toHaveLength(1);
    expect(db.read('notification_jobs/delivery/status')).toBe('dead');
    await db.ref('notifications/tester/event/read').set(true);
    restored = true;
    expect(await queue.retryDeadJob(db, 'delivery')).toBe(true);
    await worker.processNotificationQueue(db, { now: () => now });
    expect(webSent).toHaveLength(6);
    expect(fcmSent).toHaveLength(1);
    expect(db.read('notifications/tester/event/read')).toBe(true);
    expect(db.read('notification_jobs/delivery/status')).toBe('completed');
  });

  it('un ancien abonnement expiré ne supprime pas des clés réenregistrées pendant son envoi', async () => {
    let db;
    const result = fixture({ web: { a: { endpoint: 'a', keys: { auth: 'old', p256dh: 'old' } } },
      sendWeb: async () => {
        await db.ref('push_subscriptions/tester/a/keys').set({ auth: 'new', p256dh: 'new' });
        throw { statusCode: 410 };
      } });
    db = result.db;
    await result.worker.processNotificationQueue(db);
    expect(db.read('push_subscriptions/tester/a/keys/auth')).toBe('new');
    expect(db.read('notification_jobs/delivery/status')).toBe('completed');
  });

  it('borne le stockage des rappels chez les fournisseurs à leur durée restante', async () => {
    const now = Date.now(), messages = [], webOptions = [];
    const { db, worker } = fixture({ web: { a: { endpoint: 'a' } },
      sendWeb: async (_sub, _payload, options) => { webOptions.push(options); },
      sendFcm: async (message) => { messages.push(message); } });
    await db.ref('notification_jobs/delivery/notification/expiresAt').set(now + 120000);
    await worker.processNotificationQueue(db, { now: () => now });
    expect(webOptions[0].TTL).toBe(120);
    expect(messages[0].android.ttl).toBe(120000);
  });
});
