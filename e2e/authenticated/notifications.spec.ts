import { test, expect, tokenAs } from './fixtures';
const { app } = require('../../server/grant');
const { enqueueNotification, claimJob, TERMINAL_TIME } = require('../../server/notificationQueue');

test('les règles RTDB réelles refusent données privées et écritures client', async ({ request }) => {
  const token = await tokenAs(request, 'premium');
  const url = (path: string) => `http://127.0.0.1:9000/${path}.json?ns=demo-asrar-test-default-rtdb&auth=${token}`;
  expect((await request.get(url('data/appData'))).status()).toBe(200);
  for (const path of ['allowedUsers', 'notification_jobs', 'notifications/fixture-free', 'db_sirr_protection']) {
    expect((await request.get(url(path))).status()).toBe(401);
  }
  expect((await request.put(url('admins/premium@asrar,test'), { data: true })).status()).toBe(401);
});

test('un faux jeton ne permet aucun accès', async ({ request }) => {
  expect((await request.post('/api/check-access', { data: { idToken: 'invalid.jwt.token' } })).status()).toBe(401);
});

test('une publication crée une tâche puis une seule notification par destinataire', async ({ postAs, request }) => {
  const publication = await postAs('admin', 'admin', { action: 'save-book', titre: 'Livre diffusé par la file' });
  expect(publication.status()).toBe(200);
  expect((await request.get('/api/cron/notifications')).status()).toBe(401);
  const drain = () => request.get('/api/cron/notifications', { headers: { Authorization: 'Bearer emulator-cron-only' } });
  const workers = await Promise.all([drain(), drain()]);
  for (const result of workers) expect(result.status()).toBe(200);
  await drain();
  const notifications = await (await postAs('free', 'notifications', { action: 'list' })).json();
  const found = notifications.items.filter((item: any) => item.body.includes('Livre diffusé par la file'));
  expect(found).toHaveLength(1);
  expect(notifications.items.map((item: any) => item.id)).toContain('own');
  await drain();
  const again = await (await postAs('free', 'notifications', { action: 'list' })).json();
  expect(again.items.filter((item: any) => item.id === found[0].id)).toHaveLength(1);
});

test('la base réelle accorde un seul bail lors de prises concurrentes', async () => {
  const db = app().database();
  const id = await enqueueNotification(db, { type: 'users', uids: ['fixture-free'] },
    { type: 'document', title: 'Bail', body: 'Test concurrent', targetUrl: '/notifications' }, 'concurrent-real');
  const claims = await Promise.all([claimJob(db, id), claimJob(db, id)]);
  expect(claims.filter(Boolean)).toHaveLength(1);
  await db.ref(`notification_jobs/${id}`).remove();
});

test('seul un administrateur peut voir les échecs et relancer une tâche morte', async ({ postAs }) => {
  const db = app().database();
  const id = await enqueueNotification(db, { type: 'users', uids: ['fixture-free'] },
    { type: 'document', title: 'Relance', body: 'Notification relancée', targetUrl: '/notifications' }, 'dead-real');
  await db.ref(`notification_jobs/${id}`).update({ status: 'dead', attempts: 5, finishedAt: Date.now(), availableAt: TERMINAL_TIME });
  expect((await postAs('premium', 'admin', { action: 'notification-jobs' })).status()).toBe(403);
  expect((await postAs('premium', 'admin', { action: 'retry-notification', jobId: id })).status()).toBe(403);
  const health = await (await postAs('admin', 'admin', { action: 'notification-jobs' })).json();
  expect(health.deadJobs.map((job: any) => job.id)).toContain(id);
  expect(health.deadJobs.find((job: any) => job.id === id).notification).toBeUndefined();
  expect((await postAs('admin', 'admin', { action: 'retry-notification', jobId: id })).status()).toBe(200);
  expect((await db.ref(`notification_jobs/${id}/status`).once('value')).val()).toBe('queued');
  expect((await postAs('admin', 'admin', { action: 'retry-notification', jobId: id })).status()).toBe(409);
});

test('des crons concurrents livrent un seul rappel de session aux membres', async ({ request, postAs }) => {
  const db = app().database();
  await db.ref('zikr_groups/reminder-real').set({ name: 'Session fiable', ownerUid: 'fixture-free', sessionAt: Date.now() + 1200000 });
  await db.ref('zikr_members/reminder-real').set({ 'fixture-free': { joinedAt: Date.now() }, 'fixture-premium': { joinedAt: Date.now() } });
  const headers = { Authorization: 'Bearer emulator-cron-only' };
  const prepare = () => request.get('/api/cron/reminders', { headers });
  for (const result of await Promise.all([prepare(), prepare()])) expect(result.status()).toBe(200);
  expect((await request.get('/api/cron/notifications', { headers })).status()).toBe(200);
  for (const role of ['free', 'premium']) {
    const list = await (await postAs(role, 'notifications', { action: 'list' })).json();
    expect(list.items.filter((item: any) => item.title === '🔔 Session fiable')).toHaveLength(1);
  }
  await prepare();
  await request.get('/api/cron/notifications', { headers });
  const list = await (await postAs('free', 'notifications', { action: 'list' })).json();
  expect(list.items.filter((item: any) => item.title === '🔔 Session fiable')).toHaveLength(1);
});

test('les rappels obsolètes sont écartés après reprogrammation ou prolongation', async ({ request }) => {
  const db = app().database(), now = Date.now();
  await db.ref('zikr_groups/obsolete-real').set({ name: 'Session déplacée', ownerUid: 'fixture-free', sessionAt: now + 1200000 });
  await db.ref('purchased_user/expired@asrar,test').set({ token: 'fixture-purchase', expiresAt: now + 86400000, level: 15000 });
  const headers = { Authorization: 'Bearer emulator-cron-only' };
  expect((await request.get('/api/cron/reminders', { headers })).status()).toBe(200);
  await db.ref('zikr_groups/obsolete-real/sessionAt').set(now + 86400000);
  await db.ref('purchased_user/expired@asrar,test/expiresAt').set(now + 30 * 86400000);
  const drain = await request.get('/api/cron/notifications', { headers });
  expect(drain.status()).toBe(200);
  expect((await drain.json()).skipped).toBeGreaterThanOrEqual(2);
  const own = (await db.ref('notifications/fixture-free').once('value')).val() || {};
  expect(Object.values(own).some((item: any) => item.title === '🔔 Session déplacée')).toBe(false);
  const expired = (await db.ref('notifications/fixture-expired').once('value')).val() || {};
  expect(Object.values(expired).some((item: any) => item.type === 'renewal')).toBe(false);
});

test('l’activation d’un accès conserve sa notification avec le droit accordé', async ({ postAs, request }) => {
  expect((await postAs('admin', 'admin', { action: 'grant-access', email: 'free@asrar.test', days: 30, level: 15000 })).status()).toBe(200);
  expect((await (await postAs('free', 'check-access')).json()).allowed).toBe(true);
  expect((await request.get('/api/cron/notifications', { headers: { Authorization: 'Bearer emulator-cron-only' } })).status()).toBe(200);
  const list = await (await postAs('free', 'notifications', { action: 'list' })).json();
  expect(list.items.filter((item: any) => item.type === 'access')).toHaveLength(1);
});
