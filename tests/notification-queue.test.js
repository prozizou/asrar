import { afterEach, describe, expect, it, vi } from 'vitest';
import { database, runtime } from './support/runtime';
import { emulatorConfig } from '../lib/emulatorConfig';

const message = { type: 'document', title: 'Document', body: 'Disponible', targetUrl: '/bibliotheque' };
afterEach(() => vi.unstubAllEnvs());

describe('Mode émulateur : refus des configurations dangereuses', () => {
  const safe = { FIREBASE_TEST_MODE: 'true', FIREBASE_PROJECT_ID: 'demo-asrar-test',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:9000' };
  it('utilise uniquement le projet demo local', () => expect(emulatorConfig(safe).projectId).toBe('demo-asrar-test'));
  it.each([
    { ...safe, FIREBASE_PROJECT_ID: 'asrar-bc059' },
    { ...safe, VERCEL: '1' },
    { ...safe, VERCEL_ENV: 'production' },
    { ...safe, FIREBASE_AUTH_EMULATOR_HOST: 'remote.invalid:9099' },
    { NEXT_PUBLIC_FIREBASE_EMULATORS: 'true' },
    { FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:9000' },
  ])('refuse une configuration partielle, distante ou hébergée', (env) => expect(() => emulatorConfig(env)).toThrow());
});

describe('File persistante : baux, diffusion et reprise', () => {
  it('un même événement conserve sa tâche, même après une première prise en charge', async () => {
    const db = database(), queue = runtime(db)('server/notificationQueue.js');
    const id = await queue.enqueueNotification(db, { type: 'users', uids: ['tester'] }, message, 'event1');
    await queue.claimJob(db, id);
    await queue.enqueueNotification(db, { type: 'users', uids: ['tester'] }, message, 'event1');
    expect(db.read(`notification_jobs/${id}/status`)).toBe('processing');
  });
  it('deux workers ne peuvent pas louer la même tâche', async () => {
    const db = database(), queue = runtime(db)('server/notificationQueue.js');
    const id = await queue.enqueueNotification(db, { type: 'all' }, message, 'lease');
    const claims = await Promise.all([queue.claimJob(db, id), queue.claimJob(db, id)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const afterCrash = await queue.claimJob(db, id, Date.now() + queue.LEASE_MS + 1000);
    expect(afterCrash).not.toBeNull();
    expect(afterCrash.owner).not.toBe(claims.find(Boolean).owner);
  });
  it('la diffusion ne lit qu’une page et ne duplique pas les enfants après reprise', async () => {
    const db = database({ user_sessions: Object.fromEntries(Array.from({ length: 45 }, (_, i) => ['user' + String(i).padStart(3, '0'), {}])) });
    const queue = runtime(db)('server/notificationQueue.js');
    const id = await queue.enqueueNotification(db, { type: 'all' }, message, 'broadcast');
    const job = await queue.claimJob(db, id);
    await queue.expandAudience(db, job);
    expect(Object.keys(db.read('notification_jobs'))).toHaveLength(21);
    expect(db.read(`notification_jobs/${id}/cursor`)).toBe('user019');
    const next = await queue.claimJob(db, id);
    await queue.expandAudience(db, next);
    expect(Object.keys(db.read('notification_jobs'))).toHaveLength(41);
  });
  it('la publication et sa notification sont enregistrées atomiquement', async () => {
    const db = database(), notify = runtime(db)('server/notify.js');
    db.failNext('', 'update');
    await expect(notify.publishAndNotify(db, 'almaqtab/book', { titre: 'Livre' }, message, { eventId: 'atomic' })).rejects.toThrow();
    expect(db.read('almaqtab/book')).toBeNull();
    expect(db.read('notification_jobs')).toBeNull();
    await notify.publishAndNotify(db, 'almaqtab/book', { titre: 'Livre' }, message, { eventId: 'atomic' });
    expect(db.read('almaqtab/book/titre')).toBe('Livre');
    expect(Object.keys(db.read('notification_jobs'))).toHaveLength(1);
  });
  it('reprend une livraison en échec sans recréer la notification déjà lue', async () => {
    const db = database(), load = runtime(db), queue = load('server/notificationQueue.js');
    const { processNotificationQueue } = load('server/notificationWorker.js');
    const { storeNotification } = load('server/notificationStore.js');
    const id = await queue.enqueueNotification(db, { type: 'users', uids: ['tester'] }, message, 'retry');
    let calls = 0;
    const deliver = async (_db, job) => {
      await storeNotification(db, job.uid, job.notification, job.notificationId);
      if (++calls === 1) throw new Error('Service push indisponible');
    };
    const first = await processNotificationQueue(db, { deliver });
    expect(first.retried).toBe(1);
    await db.ref(`notifications/tester/${id}/read`).set(true);
    const later = Date.now() + 120000;
    await processNotificationQueue(db, { deliver, now: () => later });
    expect(Object.keys(db.read('notifications/tester'))).toHaveLength(1);
    expect(db.read(`notifications/tester/${id}/read`)).toBe(true);
  });
  it('isole un destinataire en panne et termine les autres', async () => {
    const db = database(), load = runtime(db);
    await load('server/notificationQueue.js').enqueueNotification(db, { type: 'users', uids: ['bad', 'good'] }, message, 'partial');
    const completed = [];
    await load('server/notificationWorker.js').processNotificationQueue(db, { deliver: async (_db, job) => {
      if (job.uid === 'bad') throw new Error('Transient');
      completed.push(job.uid);
    } });
    expect(completed).toEqual(['good']);
    const deliveries = Object.values(db.read('notification_jobs')).filter((job) => job.kind === 'delivery');
    expect(deliveries.find((job) => job.uid === 'bad').status).toBe('retry');
    expect(deliveries.find((job) => job.uid === 'good').status).toBe('completed');
  });
  it('arrête les reprises automatiques puis permet une relance manuelle', async () => {
    const db = database(), queue = runtime(db)('server/notificationQueue.js');
    const id = await queue.enqueueNotification(db, { type: 'all' }, message, 'dead');
    let now = Date.now();
    for (let i = 0; i < queue.MAX_ATTEMPTS; i++) {
      const job = await queue.claimJob(db, id, now);
      await queue.retryJob(db, job, { code: 'UNAVAILABLE' }, now);
      now += 3600001;
    }
    expect(db.read(`notification_jobs/${id}/status`)).toBe('dead');
    expect(await queue.claimJob(db, id, now)).toBeNull();
    expect(await queue.retryDeadJob(db, id)).toBe(true);
    expect(db.read(`notification_jobs/${id}/attempts`)).toBe(0);
  });
  it('borne la concurrence et attend les opérations en cours même en cas d’erreur', async () => {
    const { mapBounded } = runtime(database())('server/notificationTransport.js');
    let active = 0, max = 0, finished = 0;
    await expect(mapBounded([0, 1, 2, 3, 4], 2, async (i) => {
      active++; max = Math.max(max, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--; finished++;
      if (i === 0) throw new Error('Panne');
    })).rejects.toThrow('Panne');
    expect(max).toBeLessThanOrEqual(2);
    expect(active).toBe(0);
    expect(finished).toBeGreaterThanOrEqual(2);
  });
  it('conserve les accusés par appareil et supprime les abonnements expirés à la reprise', async () => {
    vi.stubEnv('FIREBASE_TEST_MODE', 'false');
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'local');
    vi.stubEnv('VAPID_PRIVATE_KEY', 'local');
    vi.stubEnv('VAPID_SUBJECT', 'mailto:test@example.invalid');
    const db = database({ notification_jobs: { delivery: { kind: 'delivery', status: 'queued', attempts: 0,
      availableAt: 0, createdAt: Date.now(), notificationId: 'event', uid: 'tester', notification: message } },
      push_subscriptions: { tester: { a: { endpoint: 'a', updatedAt: 1 }, b: { endpoint: 'b', updatedAt: 2 } } },
      fcm_devices: { tester: { android: { token: 'expired', updatedAt: 1 } } } });
    const sent = [], fcm = [];
    let retry = false;
    const load = runtime(db, { stubs: {
      'web-push': { setVapidDetails() {} },
      'server/webPush.js': { sendWebPush: async (subscription) => {
        sent.push(subscription.endpoint);
        if (subscription.endpoint === 'b') throw Object.assign(new Error('Provider'), { statusCode: retry ? 410 : 503 });
      } },
      'server/grant.js': { app: () => ({ messaging: () => ({ send: async ({ token }) => {
        fcm.push(token);
        throw Object.assign(new Error('Expired'), { code: 'messaging/registration-token-not-registered' });
      } }) }) },
    } });
    const queue = load('server/notificationQueue.js'), transport = load('server/notificationTransport.js');
    const job = await queue.claimJob(db, 'delivery');
    await expect(transport.deliverNotification(db, job)).rejects.toMatchObject({ statusCode: 503 });
    expect(db.read('notification_jobs/delivery/progress/web/a')).toBe(true);
    await queue.retryJob(db, job, { statusCode: 503 });
    retry = true;
    const next = await queue.claimJob(db, 'delivery', Date.now() + 120000);
    expect(await transport.deliverNotification(db, next)).toMatchObject({ pending: false });
    expect(sent).toEqual(['a', 'b', 'b']);
    expect(fcm).toEqual(['expired']);
    expect(db.read('push_subscriptions/tester/b')).toBeNull();
    expect(db.read('fcm_devices/tester/android')).toBeNull();
    expect(Object.keys(db.read('notifications/tester'))).toEqual(['event']);
  });
  it('ne nettoie que les tâches terminées depuis plus de trente jours', async () => {
    const now = Date.now(), old = now - 31 * 86400000;
    const db = database({ notification_jobs: {
      completed: { status: 'completed', finishedAt: old },
      dead: { status: 'dead', finishedAt: old },
      retry: { status: 'queued', finishedAt: old },
      recent: { status: 'completed', finishedAt: now },
    } });
    await runtime(db)('server/notificationWorker.js').cleanupNotificationJobs(db, now);
    expect(db.read('notification_jobs/completed')).toBeNull();
    expect(db.read('notification_jobs/dead')).toBeNull();
    expect(db.read('notification_jobs/retry')).not.toBeNull();
    expect(db.read('notification_jobs/recent')).not.toBeNull();
  });
});
