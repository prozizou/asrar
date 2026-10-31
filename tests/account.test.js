import { describe, expect, it } from 'vitest';
import { database, runtime, invoke } from './support/runtime';
const user = { uid: 'tester', email: 'user@example.test' };
function setup(initial = {}, { recent = true, admin = false, status = null } = {}) {
  const db = database(initial), load = runtime(db, { user, stubs: {
    'server/grant.js': { app: () => ({ database: () => db, auth: () => ({
      verifyIdToken: async () => ({ auth_time: Date.now() / 1000 - (recent ? 0 : 10000) }),
      getUser: async () => ({ displayName: 'Utilisateur', emailVerified: true, metadata: { creationTime: '2026-01-01' } }),
      updateUser: async () => {},
    }) }) },
    'server/access.js': { verifyUser: async () => user, emailKey: (email) => email.replace(/\./g, ','), isAdmin: async () => admin,
      getAccessStatus: async () => status || ({ allowed: true, admin, vip: false, level: 15000, expiresAt: Date.now() + 86400000, purchase: { token: 'must-stay-private' } }) },
  } });
  return { db, load, handler: load('pages/api/account.js').default };
}
describe('Compte et données personnelles', () => {
  it('app gratuite : affiche le vrai abonnement, pas l’accès ouvert à tous', async () => {
    const { handler } = setup({}, { status: { allowed: true, adFree: false, subscriptionLevel: 0, admin: false, vip: false, level: Infinity, expiresAt: null } });
    const result = await invoke(handler);
    expect(result.body.subscription).toMatchObject({ allowed: false, level: 0 });
  });
  it('affiche le palier et la date sans livrer les jetons d’achat ou d’appareil', async () => {
    const { handler } = setup({ fcm_devices: { tester: { device: { token: 'private-device' } } } });
    const result = await invoke(handler);
    expect(result.code).toBe(200);
    expect(result.body.subscription).toMatchObject({ level: 15000, allowed: true });
    expect(JSON.stringify(result.body)).not.toContain('must-stay-private');
    expect(JSON.stringify(result.body)).not.toContain('private-device');
    expect(result.headers['Cache-Control']).toBe('no-store');
  });
  it('exige une connexion récente pour l’export et la demande de suppression', async () => {
    const { db, handler } = setup({}, { recent: false });
    for (const body of [{ action: 'export' }, { action: 'request-privacy', kind: 'delete' }]) {
      const result = await invoke(handler, body);
      expect(result.code).toBe(401); expect(result.body.code).toBe('RECENT_LOGIN_REQUIRED');
    }
    expect(db.read('privacy_requests')).toBeNull();
  });
  it('ne crée qu’une demande de données en cours et la réserve à son propriétaire', async () => {
    const { db, handler } = setup();
    const result = await Promise.all([invoke(handler, { action: 'request-privacy', kind: 'delete', uid: 'other' }), invoke(handler, { action: 'request-privacy', kind: 'delete' })]);
    expect(result.every((r) => r.code === 200)).toBe(true);
    expect(Object.keys(db.read('privacy_requests'))).toEqual(['tester']);
    expect(db.read('privacy_requests/tester/status')).toBe('pending');
    expect(db.read('user_sessions/tester')).toBeNull();
  });
  it('le refus des notifications retire les appareils et empêche leur réinscription automatique', async () => {
    const { db, handler, load } = setup({ fcm_devices: { tester: { device: { token: 'old' } } }, push_subscriptions: { tester: { web: {} } } });
    expect((await invoke(handler, { action: 'settings', analytics: false, pushEnabled: false })).code).toBe(200);
    expect(db.read('fcm_devices/tester')).toBeNull(); expect(db.read('push_subscriptions/tester')).toBeNull();
    expect((await invoke(load('pages/api/push-fcm-register.js').default, { action: 'register', platform: 'android', token: 'valid-length-local-token' })).code).toBe(409);
  });
  it('conserve les notifications dans l’application même après refus des push', async () => {
    const { db, load } = setup({ account_settings: { tester: { pushEnabled: false } },
      fcm_devices: { tester: { d: { token: 'must-not-send' } } } });
    await load('server/notificationQueue.js').enqueueNotification(db, { type: 'users', uids: ['tester'] },
      { type: 'document', title: 'Notification', body: 'Dans l’application', targetUrl: '/notifications' }, 'private-push-test');
    await load('server/notificationWorker.js').processNotificationQueue(db);
    expect(Object.keys(db.read('notifications/tester'))).toHaveLength(1);
    expect(Object.values(db.read('notification_jobs')).every((job) => job.status === 'completed')).toBe(true);
  });
  it('ne collecte pas de statistiques facultatives sans accord explicite', async () => {
    const { db, load } = setup();
    expect((await invoke(load('pages/api/track.js').default, { type: 'product_view', productKey: 'p' })).code).toBe(200);
    expect(db.read('analytics')).toBeNull(); expect(db.read('activity_feed')).toBeNull(); expect(db.read('views')).toBeNull();
    expect(db.read('user_sessions/tester/uid')).toBe('tester');
  });
  it('interdit le traitement des demandes de données à un utilisateur ordinaire', async () => {
    const { db, handler } = setup({ privacy_requests: { other: { status: 'pending' } } });
    expect((await invoke(handler, { action: 'privacy-list' })).code).toBe(403);
    expect((await invoke(handler, { action: 'privacy-update', uid: 'other', status: 'completed', note: 'Falsifiée' })).code).toBe(403);
    expect(db.read('privacy_requests/other/status')).toBe('pending');
  });
  it('journalise une réponse administrateur et ne confond pas réponse et effacement automatique', async () => {
    const { db, handler } = setup({ privacy_requests: { other: { uid: 'other', status: 'pending', kind: 'delete' } } }, { admin: true });
    expect((await invoke(handler, { action: 'privacy-update', uid: 'other', status: 'processing', note: 'Examen en cours.' })).code).toBe(200);
    expect(db.read('privacy_requests/other')).toMatchObject({ status: 'processing', processedBy: 'tester', response: 'Examen en cours.' });
  });
});
