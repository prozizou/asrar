import { afterEach, describe, expect, it, vi } from 'vitest';
import { database, runtime, invoke } from './support/runtime';
import { emailVendorKey } from '../lib/market';
import { computePday, buildHourList } from '../lib/planete';

afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
const jobs = (db) => Object.values(db.read('notification_jobs') || {}).filter((j) => j.kind === 'fanout');
const owner = { uid: 'owner', email: 'owner@example.test', name: 'Vendeur' };
const fan = { uid: 'fan', email: 'fan@example.test', name: 'Awa' };

describe('Boutique : likes, commentaires et avis', () => {
  const setup = (user) => {
    const db = database({ det_produits: { p1: { produit: 'Bague de protection', uid: owner.uid, email: owner.email } } });
    return { db, handler: runtime(db, { user })('pages/api/social.js').default };
  };

  it('prévient le propriétaire une seule fois par personne qui aime un produit', async () => {
    const { db, handler } = setup(fan);
    for (let i = 0; i < 3; i++) await invoke(handler, { cat: 'product', key: 'p1', action: 'toggle-like' });
    const list = jobs(db);
    expect(list).toHaveLength(1);
    expect(list[0].audience.uids).toEqual(['owner']);
    expect(list[0].notification).toMatchObject({ type: 'social', title: '❤️ Awa aime votre produit « Bague de protection »', targetUrl: '/?item=p1' });
  });

  it('prévient la boutique d’un commentaire ou d’un avis, jamais de ses propres actions', async () => {
    const vendorId = emailVendorKey(owner.email);
    const { db, handler } = setup(fan);
    await invoke(handler, { cat: 'vendor', key: vendorId, action: 'comment', text: 'Très sérieux', stars: 5 });
    await invoke(handler, { cat: 'product', key: 'p1', action: 'comment', text: 'Disponible ?' });
    const titles = jobs(db).map((j) => j.notification.title).sort();
    expect(titles).toEqual(['⭐ Awa a laissé un avis sur votre boutique', '💬 Awa a commenté votre produit « Bague de protection »']);

    const self = setup(owner);
    await invoke(self.handler, { cat: 'product', key: 'p1', action: 'toggle-like' });
    expect(jobs(self.db)).toHaveLength(0);
  });

  it('ne prévient personne pour un secret aimé', async () => {
    const { db, handler } = setup(fan);
    await invoke(handler, { cat: 'secret', key: 's1', action: 'toggle-like' });
    expect(jobs(db)).toHaveLength(0);
  });
});

describe('Bibliothèque : l’administration est prévenue', () => {
  it('like et commentaire d’un livre vont aux administrateurs', async () => {
    vi.stubEnv('SUPER_ADMIN_EMAIL', 'boss@example.test');
    const db = database({ almaqtab: { b1: { titre: 'Manuscrit ancien' } }, admins: { 'aide@example,test': true } });
    const uids = { 'boss@example.test': 'boss', 'aide@example.test': 'aide' };
    const load = runtime(db, { user: fan, stubs: { 'server/grant.js': { app: () => ({ database: () => db,
      auth: () => ({ getUserByEmail: async (email) => ({ uid: uids[email] }) }) }) } } });
    load('server/shopOwners.js').resetAdminCache();
    const handler = load('pages/api/book-social.js').default;
    await invoke(handler, { action: 'like', bookKey: 'b1' });
    await invoke(handler, { action: 'comment', bookKey: 'b1', text: 'Merci pour ce livre' });
    const list = jobs(db);
    expect(list).toHaveLength(2);
    expect(list.every((j) => JSON.stringify(j.audience.uids) === '["aide","boss"]')).toBe(true);
    expect(list.map((j) => j.notification.title).sort()).toEqual(['❤️ Awa aime « Manuscrit ancien »', '💬 Awa a commenté « Manuscrit ancien »']);
  });
});

describe('Date du jour : le 1er et le 16 du mois', () => {
  const load = (db) => runtime(db)('server/monthDayNotice.js');
  const hijri = (day) => async () => ({ hijri: { day: String(day), monthEn: 'Rajab', monthAr: 'رجب', year: '1448' } });

  it('diffuse à tous, WhatsApp compris, une seule fois le 16 grégorien', async () => {
    const db = database({});
    const { queueMonthDayNotice } = load(db);
    const now = new Date('2026-11-16T09:00:00Z');
    expect((await queueMonthDayNotice(db, now, { fetchHijri: hijri(6) })).status).toBe('queued');
    expect((await queueMonthDayNotice(db, now, { fetchHijri: hijri(6) })).status).toBe('done');
    const list = jobs(db);
    expect(list).toHaveLength(1);
    expect(list[0].audience).toEqual({ type: 'all' });
    expect(list[0].notification).toMatchObject({ whatsappBroadcast: true, targetUrl: '/hijri', title: '📅 Date du jour — 16 du mois',
      body: 'Lundi 16 novembre 2026 · 6 Rajab (رجب) 1448 H' });
  });

  it('se déclenche aussi le 1er du mois hégirien, pas les autres jours ni avant 7 h', async () => {
    const db = database({});
    const { queueMonthDayNotice } = load(db);
    expect((await queueMonthDayNotice(db, new Date('2026-11-20T05:00:00Z'), { fetchHijri: hijri(1) })).status).toBe('early');
    expect((await queueMonthDayNotice(db, new Date('2026-11-20T08:00:00Z'), { fetchHijri: hijri(1) })).status).toBe('queued');
    expect(jobs(db)[0].notification.title).toBe('📅 Date du jour — début du mois hégirien');
    expect((await queueMonthDayNotice(db, new Date('2026-11-21T08:00:00Z'), { fetchHijri: hijri(2) })).status).toBe('not-due');
  });

  it('utilise le calendrier Umm al-Qura si AlAdhan est injoignable', async () => {
    const db = database({});
    const { hijriOf } = load(db);
    const h = await hijriOf(new Date('2026-11-10T09:00:00Z'), async () => { throw new Error('hors ligne'); });
    expect(h.day).toBeGreaterThanOrEqual(1);
    expect(h.label).toMatch(/1448 H$/);
  });
});

describe('Transport : options par notification', () => {
  it('une diffusion autorisée part sur WhatsApp ; inApp/push coupés sont respectés', async () => {
    vi.stubEnv('FIREBASE_TEST_MODE', 'false');
    vi.stubEnv('WHATSAPP_CLOUD_TOKEN', 't');
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '123456789');
    const sent = [], pushed = [];
    const notification = { type: 'planet_alarm', title: 'Heure', body: 'Jupiter', targetUrl: '/planete', inApp: false, push: false };
    const db = database({
      notification_jobs: { d: { kind: 'delivery', uid: 'u', notificationId: 'e', audienceType: 'all', notification: { ...notification, whatsappBroadcast: true },
        status: 'queued', availableAt: 0, createdAt: Date.now(), attempts: 0 } },
      account_settings: { u: { whatsapp: { enabled: true, phone: '+221770000000' } } },
      fcm_devices: { u: { a: { token: 'tok', updatedAt: 1 } } },
    });
    const fetch = async (url, init) => { sent.push(JSON.parse(init.body)); return { ok: true, status: 200, json: async () => ({}) }; };
    const load = runtime(db, { globals: { fetch }, stubs: { 'server/grant.js': { app: () => ({ messaging: () => ({ send: async (m) => pushed.push(m) }) }) } } });
    await load('server/notificationWorker.js').processNotificationQueue(db);
    expect(sent).toHaveLength(1);
    expect(pushed).toHaveLength(0);
    expect(db.read('notifications/u')).toBeNull();
    expect(db.read('notification_jobs/d/status')).toBe('completed');
  });
});

describe('Alarme d’heure planétaire (cloche) sur WhatsApp', () => {
  const lat = 14.69, lng = -17.44;
  function nextRow() {
    const base = new Date('2026-11-10T10:00:00Z');
    const pday = computePday(base, lat, lng, {}, 'UTC');
    const rows = [...buildHourList(pday, { isDay: null, idx: -1 }, true, 'UTC'), ...buildHourList(pday, { isDay: null, idx: -1 }, false, 'UTC')];
    return rows.find((r) => r.start.getTime() > base.getTime() + 3600000);
  }

  it('l’alarme Android déclarée au serveur part sur WhatsApp à son heure, une seule fois', async () => {
    vi.stubEnv('CRON_SECRET', 'secret');
    vi.stubEnv('WHATSAPP_CLOUD_TOKEN', 't');
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '123456789');
    for (const n of ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']) vi.stubEnv(n, 'x');
    const row = nextRow();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(row.start.getTime() - 3 * 3600000);
    const user = { uid: 'u1', email: 'u1@example.test' };
    const db = database({ account_settings: { u1: { whatsapp: { enabled: true, phone: '+221770000000' } } } });
    const load = runtime(db, { user, stubs: { 'web-push': { setVapidDetails: () => {} } } });
    const alarmApi = load('pages/api/planet-web-alarm.js').default;
    expect((await invoke(alarmApi, { action: 'native-set', planet: row.planet, enabled: true, offsetMin: 0, startMs: null })).code).toBe(400);
    expect((await invoke(alarmApi, { action: 'native-set', planet: row.planet, enabled: true, offsetMin: 0,
      startMs: row.start.getTime(), lat, lng, timeZone: 'UTC' })).code).toBe(200);

    const cron = load('pages/api/cron/planet-push.js').default;
    const call = () => cron({ method: 'GET', headers: { authorization: 'Bearer secret' }, query: {} },
      { status() { return this; }, json(v) { this.body = v; return this; }, setHeader() {} });
    vi.setSystemTime(row.start.getTime() + 60000);
    await call();
    await call();
    const list = jobs(db);
    expect(list).toHaveLength(1);
    expect(list[0].audience.uids).toEqual(['u1']);
    expect(list[0].notification).toMatchObject({ type: 'planet_alarm', inApp: false, push: false, title: `🪐 C’est l’heure de ${row.planet}` });
    expect(Object.keys(db.read('planet_native_alarms/u1') || {})).toEqual([]); // alarme ponctuelle consommée
  });
});
