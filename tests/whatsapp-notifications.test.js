import { afterEach, describe, expect, it, vi } from 'vitest';
import { database, runtime, invoke } from './support/runtime';

const notification = { type: 'product_request', title: 'Nouvelle demande de produit de Awa', body: 'Bague\nen argent', targetUrl: '/?shop=v_abc' };
afterEach(() => vi.unstubAllEnvs());

function configure() {
  vi.stubEnv('FIREBASE_TEST_MODE', 'false');
  vi.stubEnv('WHATSAPP_CLOUD_TOKEN', 'fixture-token');
  vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '123456789');
}

function fixture({ audienceType = 'users', settings = { whatsapp: { enabled: true, phone: '+221770000000' } }, respond } = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const { status = 200, json = { messages: [{ id: 'wamid.1' }] } } = respond ? respond(calls.length) : {};
    return { ok: status < 400, status, json: async () => json };
  };
  const db = database({
    notification_jobs: { delivery: { kind: 'delivery', uid: 'tester', notificationId: 'event', audienceType,
      notification, status: 'queued', availableAt: 0, createdAt: Date.now(), attempts: 0 } },
    account_settings: { tester: settings },
  });
  const load = runtime(db, { globals: { fetch } });
  return { db, calls, worker: load('server/notificationWorker.js'), load };
}

describe('Notifications par le compte WhatsApp ASRAR PRO', () => {
  it('envoie le modèle approuvé au numéro choisi, sans retour à la ligne dans les paramètres', async () => {
    configure();
    const { db, calls, worker } = fixture();
    await worker.processNotificationQueue(db);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://graph.facebook.com/v21.0/123456789/messages');
    expect(calls[0].init.headers.Authorization).toBe('Bearer fixture-token');
    expect(calls[0].body).toMatchObject({ messaging_product: 'whatsapp', to: '221770000000', type: 'template',
      template: { name: 'asrar_notification', language: { code: 'fr' } } });
    expect(calls[0].body.template.components[0].parameters.map((p) => p.text)).toEqual([notification.title, 'Bague en argent']);
    expect(db.read('notification_jobs/delivery/progress/whatsapp/main')).toBe(true);
    expect(db.read('notification_jobs/delivery/status')).toBe('completed');
    expect(Object.keys(db.read('notifications/tester'))).toEqual(['event']);
  });

  it('ajoute le bouton lien quand le modèle en possède un', async () => {
    configure();
    vi.stubEnv('WHATSAPP_TEMPLATE_URL_BUTTON', 'true');
    const { db, calls, worker } = fixture();
    await worker.processNotificationQueue(db);
    expect(calls[0].body.template.components[1]).toEqual({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: '?shop=v_abc' }] });
  });

  it('n’envoie rien pour une diffusion à tous, sans accord, ou sans configuration', async () => {
    configure();
    for (const options of [{ audienceType: 'all' }, { settings: { whatsapp: { enabled: false, phone: '+221770000000' } } }, { settings: {} }]) {
      const { db, calls, worker } = fixture(options);
      await worker.processNotificationQueue(db);
      expect(calls).toHaveLength(0);
      expect(db.read('notification_jobs/delivery/status')).toBe('completed');
    }
    vi.stubEnv('WHATSAPP_CLOUD_TOKEN', '');
    const { db, calls, worker } = fixture();
    await worker.processNotificationQueue(db);
    expect(calls).toHaveLength(0);
  });

  it('envoie aussi sur WhatsApp quand les push sur appareil sont refusés', async () => {
    configure();
    const { db, calls, worker } = fixture({ settings: { pushEnabled: false, whatsapp: { enabled: true, phone: '+221770000000' } } });
    await worker.processNotificationQueue(db);
    expect(calls).toHaveLength(1);
  });

  it('réessaie une panne temporaire de Meta mais abandonne un numéro refusé', async () => {
    configure();
    const now = Date.now();
    const temporary = fixture({ respond: () => ({ status: 503, json: { error: { code: 2, message: 'Indisponible' } } }) });
    await temporary.worker.processNotificationQueue(temporary.db, { now: () => now });
    expect(temporary.db.read('notification_jobs/delivery/status')).toBe('queued');
    expect(temporary.db.read('notification_jobs/delivery/progress/failures/whatsapp/main/attempts')).toBe(1);

    const permanent = fixture({ respond: () => ({ status: 400, json: { error: { code: 131026, message: 'Message undeliverable' } } }) });
    await permanent.worker.processNotificationQueue(permanent.db, { now: () => now });
    expect(permanent.calls).toHaveLength(1);
    expect(permanent.db.read('notification_jobs/delivery/status')).toBe('completed');
  });

  it('marque les livraisons issues d’une diffusion à tous', async () => {
    const db = database({ user_sessions: { a: { uid: 'a' } } });
    const load = runtime(db);
    await load('server/notificationQueue.js').enqueueNotification(db, { type: 'all' }, notification, 'broadcast');
    await load('server/notificationQueue.js').enqueueNotification(db, { type: 'users', uids: ['a'] }, notification, 'targeted');
    await load('server/notificationWorker.js').processNotificationQueue(db, { deliver: async () => ({ pending: false }) });
    const deliveries = Object.values(db.read('notification_jobs')).filter((j) => j.kind === 'delivery');
    expect(deliveries.map((j) => j.audienceType).sort()).toEqual(['all', 'users']);
  });
});

describe('Réglage WhatsApp du compte', () => {
  const user = { uid: 'tester', email: 'user@example.test' };
  function setup(initial = {}) {
    const db = database(initial);
    const load = runtime(db, { user, stubs: {
      'server/grant.js': { app: () => ({ database: () => db, auth: () => ({
        verifyIdToken: async () => ({ auth_time: Date.now() / 1000 }),
        getUser: async () => ({ displayName: 'U', emailVerified: true, metadata: {} }),
      }) }) },
      'server/access.js': { verifyUser: async () => user, emailKey: (e) => e.replace(/\./g, ','), isAdmin: async () => false,
        getAccessStatus: async () => ({ allowed: false, admin: false, vip: false, level: 0 }) },
    } });
    return { db, handler: load('pages/api/account.js').default };
  }

  it('valide le numéro, enregistre l’accord et le conserve quand les autres réglages changent', async () => {
    configure();
    const { db, handler } = setup();
    expect((await invoke(handler, { action: 'whatsapp', enabled: true, phone: '77 000' })).code).toBe(400);
    expect((await invoke(handler, { action: 'whatsapp', enabled: true, phone: '00221 77 000 00 00' })).code).toBe(200);
    expect(db.read('account_settings/tester/whatsapp')).toMatchObject({ enabled: true, phone: '+221770000000' });
    expect((await invoke(handler, { action: 'settings', analytics: false, pushEnabled: true })).code).toBe(200);
    expect(db.read('account_settings/tester/whatsapp/enabled')).toBe(true);
    const summary = await invoke(handler);
    expect(summary.body.settings.whatsapp).toEqual({ available: true, enabled: true, phone: '+221770000000' });
    expect((await invoke(handler, { action: 'whatsapp', enabled: false, phone: '' })).code).toBe(200);
    expect(db.read('account_settings/tester/whatsapp')).toBeNull();
  });

  it('refuse l’activation tant que le compte WhatsApp n’est pas configuré', async () => {
    vi.stubEnv('WHATSAPP_CLOUD_TOKEN', '');
    const { handler } = setup();
    expect((await invoke(handler, { action: 'whatsapp', enabled: true, phone: '+221770000000' })).code).toBe(503);
    expect((await invoke(handler)).body.settings.whatsapp.available).toBe(false);
  });
});
