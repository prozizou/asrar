import { afterEach, describe, expect, it, vi } from 'vitest';
import { database, runtime, invoke } from './support/runtime';
import { sanitizeDiagnostic, diagnosticStack } from '../lib/diagnosticPrivacy';

afterEach(() => vi.useRealTimers());
const now = Date.UTC(2026, 10, 22, 12);
const event = { kind: 'render', name: 'TypeError', page: '/zikr?token=secret', version: 'v46.93', stack: 'TypeError: private chat\n at secret (https://www.asrarpro.com/_next/static/chunks/1234567890abcdef.js?token=secret:12:8)' };

describe('Contrat de confidentialité', () => {
  it('supprime message, jetons, query, fragments et arguments ; nettoyage idempotent des frames', () => {
    const clean = sanitizeDiagnostic({ ...event, message: 'email@test.invalid private chat', idToken: 'secret', request: { password: 'secret' } });
    const serialized = JSON.stringify(clean);
    expect(serialized).not.toMatch(/secret|private chat|email@test|password|idToken/);
    expect(clean.page).toBe('/zikr');
    expect(clean.stack).toBe('/_next/static/chunks/1234567890abcdef.js:12:8');
    expect(diagnosticStack(clean.stack)).toBe(clean.stack);
    expect(sanitizeDiagnostic(clean)).toEqual(clean);
  });
  it('masque les identifiants des chemins et refuse les valeurs libres', () => {
    const clean = sanitizeDiagnostic({ kind: '__proto__', name: 'PRIVATE', page: '/users/4d89ef42-ffa9-4448-98bc-3a6fac29081b/x%40example.com', durationMs: Infinity, statusCode: -2, version: 'secret token' });
    expect(clean.page).toBe('/users/:id/:id');
    expect(clean.kind).toBe('javascript'); expect(clean.name).toBe('Error');
    expect(clean.version).toBe('inconnue'); expect(clean.durationMs).toBe(0); expect(clean.statusCode).toBe(0);
  });
});

describe('Persistance des diagnostics', () => {
  it('regroupe sans perdre les occurrences concurrentes, puis rouvre après résolution', async () => {
    const db = database(); const { recordDiagnostic } = runtime(db)('server/diagnostics.js');
    await Promise.all(Array.from({ length: 12 }, (_, i) => recordDiagnostic(db, { ...event, durationMs: i * 1000 }, { source: 'same-ip', platform: 'android_app', uid: 'verified' }, now)));
    const [[key, group]] = Object.entries(db.read('app_diagnostics'));
    expect(group.count).toBe(12); expect(group.maxDurationMs).toBe(11000);
    expect(group.lastUid).toBe('verified'); expect(group.stack).toContain('.js:12:8');
    await db.ref('app_diagnostics/' + key).update({ status: 'resolved', resolvedAt: now });
    await recordDiagnostic(db, event, { source: 'same-ip', platform: 'android_app' }, now + 1);
    expect(db.read('app_diagnostics/' + key)).toMatchObject({ status: 'open', count: 13, resolvedAt: null });
    expect(JSON.stringify(db.read('app_diagnostic_limits'))).not.toContain('same-ip');
  });
  it('borne les écritures par source et globalement, même entre instances', async () => {
    const db = database(); const a = runtime(db)('server/diagnostics.js'), b = runtime(db)('server/diagnostics.js');
    for (let i = 0; i < 102; i++) await (i % 2 ? a : b).recordDiagnostic(db, event, { source: 'ip' }, now);
    expect(Object.values(db.read('app_diagnostics'))[0].count).toBe(100);
    await db.ref('app_diagnostic_limits/20261122_total').set(2000);
    expect(await a.recordDiagnostic(db, event, { source: 'new-ip' }, now)).toBe(false);
    expect(Object.keys(db.read('app_diagnostic_limits'))).toHaveLength(2);
  });
  it('compte les répétitions reçues et rejette les lenteurs sous le seuil avant toute écriture', async () => {
    const db = database(); const { recordDiagnostic } = runtime(db)('server/diagnostics.js');
    for (const durationMs of [999, 1000]) expect(await recordDiagnostic(db, { kind: 'freeze', durationMs }, {}, now)).toBe(false);
    expect(db.metrics.transactions).toBe(0);
    await recordDiagnostic(db, { kind: 'freeze', durationMs: 1000.1, occurrences: 3 }, {}, now);
    expect(Object.values(db.read('app_diagnostics'))[0]).toMatchObject({ count: 3, durationMs: 1001 });
  });
  it('nettoie seulement les jours expirés, requêtes indexées et bornées', async () => {
    const db = database({ app_diagnostics: { '20261021_old': {}, '20261024_keep': {} }, app_diagnostic_limits: { '20261021_total': 2, '20261122_total': 3 } });
    const { purgeDiagnostics } = runtime(db)('server/diagnostics.js');
    expect(await purgeDiagnostics(db, now)).toBe(2);
    expect(db.read('app_diagnostics/20261024_keep')).toEqual({});
    expect(db.metrics.reads.every(read => read.query.first === 2000 && read.query.order === '.key')).toBe(true);
  });
  it('réception publique : UID fourni ignoré, jeton invalide anonyme, batch borné, serveur usurpé refusé', async () => {
    const db = database();
    const handler = runtime(db, { stubs: { 'server/grant.js': { app: () => ({ database: () => db, auth: () => ({ verifyIdToken: async () => { throw Error('Invalid'); } }) }) } } })('pages/api/client-error.js').default;
    const res = await invoke(handler, { idToken: 'invalid', uid: 'fake', events: Array.from({ length: 10 }, () => ({ ...event, uid: 'fake', kind: 'server' })) });
    expect(res.code).toBe(204);
    const item = Object.values(db.read('app_diagnostics'))[0];
    expect(item).toMatchObject({ count: 5, lastUid: null, kind: 'javascript', platform: 'desktop' });
  });
  it('associe uniquement l’UID de la session vérifiée et ignore une panne du stockage', async () => {
    const db = database();
    const handler = runtime(db, { stubs: { 'server/grant.js': { app: () => ({ database: () => db, auth: () => ({ verifyIdToken: async () => ({ uid: 'real' }) }) }) } } })('pages/api/client-error.js').default;
    await invoke(handler, { ...event, uid: 'fake' });
    expect(Object.values(db.read('app_diagnostics'))[0].lastUid).toBe('real');
    db.failNext('app_diagnostic_limits/20261122_total', 'transaction');
    // L'horloge courante du handler diffère du now de test : panne au vrai jour.
    const key = new Date().toISOString().slice(0, 10).replace(/-/g, '') + '_total';
    db.failNext('app_diagnostic_limits/' + key, 'transaction');
    expect((await invoke(handler, event)).code).toBe(204);
  });
});

describe('Collecteur navigateur et APIs', () => {
  function browser() {
    const listeners = {}, docListeners = {};
    let time = 0, tick;
    const doc = { visibilityState: 'visible', addEventListener: (k, f) => { docListeners[k] = f; }, removeEventListener: vi.fn() };
    const fetch = vi.fn(async () => ({ status: 204 }));
    const load = runtime(database(), { globals: {
      window: { location: { pathname: '/zikr' }, addEventListener: (k, f) => { listeners[k] = f; }, removeEventListener: vi.fn() },
      navigator: { onLine: true }, document: doc, performance: { now: () => time },
      setInterval: f => { tick = f; return 1; }, clearInterval: vi.fn(), fetch,
    } });
    const monitor = load('lib/diagnostics.js');
    const stop = monitor.startDiagnostics({ version: 'v46.93', getToken: async () => 'verified-token' });
    return { monitor, fetch, listeners, docListeners, doc, stop, tick: t => { time = t; tick(); } };
  }
  it('déduplique, ne transmet pas le contenu privé et ne boucle pas sur un échec d’envoi', async () => {
    const b = browser();
    b.listeners.error({ error: { name: 'TypeError', message: 'private chat', stack: event.stack } });
    b.listeners.error({ error: { name: 'TypeError', stack: event.stack } });
    await b.monitor.flushDiagnostics();
    expect(b.fetch).toHaveBeenCalledOnce();
    const body = JSON.parse(b.fetch.mock.calls[0][1].body);
    expect(body.events).toHaveLength(1); expect(body.idToken).toBe('verified-token');
    expect(JSON.stringify(body.events)).not.toMatch(/private chat|token=secret/);
    b.fetch.mockRejectedValueOnce(new Error('Offline'));
    b.monitor.reportDiagnostic({ kind: 'resource' });
    await b.monitor.flushDiagnostics(); await b.monitor.flushDiagnostics();
    expect(b.fetch).toHaveBeenCalledTimes(2); b.stop();
  });
  it('détecte un blocage visible mais ignore arrière-plan et longue mise en veille', async () => {
    const b = browser();
    for (let t = 1000; t <= 6000; t += 1000) b.tick(t);
    b.doc.visibilityState = 'hidden'; b.docListeners.visibilitychange(); b.tick(15000);
    b.doc.visibilityState = 'visible'; b.docListeners.visibilitychange(); b.tick(55000);
    await b.monitor.flushDiagnostics(); expect(b.fetch).not.toHaveBeenCalled();
    for (let t = 56000; t <= 61000; t += 1000) b.tick(t);
    b.tick(65500); await Promise.resolve(); await b.monitor.flushDiagnostics();
    await vi.waitFor(() => expect(b.fetch).toHaveBeenCalledOnce());
    expect(JSON.parse(b.fetch.mock.calls[0][1].body).events[0]).toMatchObject({ kind: 'freeze', durationMs: 4250 }); b.stop();
  });
  it('ne signale que les retards du heartbeat strictement supérieurs à une seconde', async () => {
    const b = browser();
    b.tick(1250); // 1 250 - intervalle normal de 250 = 1 000 ms : exclu.
    await b.monitor.flushDiagnostics(); expect(b.fetch).not.toHaveBeenCalled();
    b.tick(2501); // retard réel de 1 001 ms : signalé.
    await b.monitor.flushDiagnostics();
    expect(JSON.parse(b.fetch.mock.calls[0][1].body).events[0]).toMatchObject({ kind: 'freeze', durationMs: 1001 });
    b.stop();
  });
  it('mesure les longues tâches dès 1 000,1 ms et regroupe les occurrences pour RTDB', async () => {
    let callback;
    const disconnect = vi.fn();
    const docListeners = {};
    const doc = { visibilityState: 'visible', addEventListener: (k, f) => { docListeners[k] = f; }, removeEventListener: vi.fn() };
    const fetch = vi.fn(async () => ({ status: 204 }));
    class Observer {
      static supportedEntryTypes = ['longtask'];
      constructor(fn) { callback = fn; }
      observe() {}
      disconnect = disconnect;
    }
    const monitor = runtime(database(), { globals: {
      window: { location: { pathname: '/zikr' }, addEventListener: vi.fn(), removeEventListener: vi.fn() },
      document: doc, navigator: { onLine: true }, performance: { now: () => 0 }, PerformanceObserver: Observer,
      setInterval: () => 1, clearInterval: vi.fn(), fetch,
    } })('lib/diagnostics.js');
    const stop = monitor.startDiagnostics();
    callback({ getEntries: () => [{ startTime: 1, duration: 999 }, { startTime: 2, duration: 1000 }] });
    await monitor.flushDiagnostics(); expect(fetch).not.toHaveBeenCalled();
    callback({ getEntries: () => [{ startTime: 3, duration: 1000.1 }, { startTime: 1010, duration: 1500 }] });
    await monitor.flushDiagnostics();
    expect(JSON.parse(fetch.mock.calls[0][1].body).events[0]).toMatchObject({ kind: 'freeze', durationMs: 1500, occurrences: 2 });
    doc.visibilityState = 'hidden';
    callback({ getEntries: () => [{ startTime: 3000, duration: 2000 }] });
    await monitor.flushDiagnostics(); expect(fetch).toHaveBeenCalledTimes(1);
    stop(); expect(disconnect).toHaveBeenCalled();
  });
  it('signale une API à 1 001 ms mais pas à 1 000 ms', async () => {
    vi.useFakeTimers();
    const reports = [];
    let duration = 1000;
    const api = runtime(database(), { stubs: {
      'lib/firebase.js': { auth: { currentUser: { getIdToken: async () => 'secret' } } },
      'lib/diagnostics.js': { LAG_THRESHOLD_MS: 1000, reportDiagnostic: event => reports.push(event) },
    }, globals: { fetch: async () => { vi.setSystemTime(Date.now() + duration); return { ok: true, status: 200, json: async () => ({ ok: true }) }; } } })('lib/api.js');
    await api.apiPost('fixture'); expect(reports).toHaveLength(0);
    duration = 1001;
    await api.apiPost('fixture'); expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ kind: 'slow_api', durationMs: 1001 });
  });
  it('signale HTTP 500 et JSON invalide, sans capturer les refus attendus ni les payloads', async () => {
    const reports = [];
    let response;
    const api = runtime(database(), { stubs: {
      'lib/firebase.js': { auth: { currentUser: { getIdToken: async () => 'secret' } } },
      'lib/diagnostics.js': { reportDiagnostic: event => reports.push(event) },
    }, globals: { fetch: async () => response } })('lib/api.js');
    response = { ok: false, status: 403, json: async () => ({ error: 'Denied' }) };
    await expect(api.apiPost('get-content', { password: 'secret' })).rejects.toMatchObject({ status: 403 });
    expect(reports).toEqual([]);
    response = { ok: false, status: 500, json: async () => ({}) };
    await expect(api.apiPost('get-content')).rejects.toMatchObject({ status: 500 });
    response = { ok: true, status: 200, json: async () => { throw Error('Invalid'); } };
    await expect(api.apiPost('get-content')).rejects.toMatchObject({ invalidResponse: true });
    expect(reports).toHaveLength(2); expect(JSON.stringify(reports)).not.toContain('secret');
  });
});
