import { afterEach, describe, expect, it, vi } from 'vitest';
import { database, runtime } from './support/runtime';
import { effectiveAccess } from '../lib/accessStatus';

afterEach(() => vi.useRealTimers());

describe('Droits actifs et échéances', () => {
  const now = 1700000000000;
  it('ignore un ancien achat expiré quand un accès manuel est actif', () => {
    expect(effectiveAccess({ token: 'old', level: 45000, expiresAt: now - 1 }, { until: now + 100, level: 15000 }, now))
      .toEqual({ allowed: true, level: 15000, expiresAt: now + 100 });
  });
  it('ne reprend pas le niveau d’un accès manuel expiré', () => {
    expect(effectiveAccess({ token: 'new', level: 15000, expiresAt: now + 100 }, { until: now - 1, level: 45000 }, now).level)
      .toBe(15000);
  });
  it('prend la dernière échéance des droits actifs et respecte un accès à vie', () => {
    const purchase = { token: 'paid', level: 15000, expiresAt: now + 100 };
    expect(effectiveAccess(purchase, { until: now + 200, level: 25000 }, now).expiresAt).toBe(now + 200);
    expect(effectiveAccess(purchase, true, now).expiresAt).toBeNull();
  });
  it('préserve le premium payé jusqu’à son terme, puis laisse uniquement la récompense de base', () => {
    const purchase = { token: 'paid', level: 45000, expiresAt: now + 100,
      referralAccess: { token: 'reward', level: 15000, expiresAt: now + 1000 } };
    expect(effectiveAccess(purchase, null, now).level).toBe(45000);
    expect(effectiveAccess(purchase, null, now + 101).level).toBe(15000);
    expect(effectiveAccess(purchase, null, now + 1001).allowed).toBe(false);
  });
});

describe('Délais réseau et reprise', () => {
  it('interrompt un corps JSON suspendu après réception des en-têtes', async () => {
    vi.useFakeTimers();
    const api = runtime(database(), {
      stubs: { 'lib/firebase.js': { auth: { currentUser: { getIdToken: async () => 'fixture' } } } },
      globals: { fetch: async () => ({ ok: true, status: 200, json: () => new Promise(() => {}) }) },
    })('lib/api.js');
    const outcome = expect(api.apiPost('fixture')).rejects.toMatchObject({ timeout: true, status: 0 });
    await vi.advanceTimersByTimeAsync(15001);
    await outcome;
    expect(vi.getTimerCount()).toBe(0);
  });
  it('détache l’écouteur d’authentification après son délai', async () => {
    vi.useFakeTimers();
    const unsubscribe = vi.fn();
    const api = runtime(database(), { stubs: {
      'lib/firebase.js': { auth: {} },
      'firebase/auth': { onAuthStateChanged: () => unsubscribe },
    } })('lib/api.js');
    const outcome = expect(api.authReady()).rejects.toMatchObject({ timeout: true });
    await vi.advanceTimersByTimeAsync(15001);
    await outcome;
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('une panne 503 est un statut indisponible, pas un refus commercial définitif', async () => {
    const { checkAccess } = runtime(database(), { stubs: {
      'lib/api.js': { apiPost: async () => { throw Object.assign(new Error('Unavailable'), { status: 503 }); } },
    } })('lib/access.js');
    expect(await checkAccess({ email: 'fixture@example.invalid' })).toMatchObject({ allowed: false, unavailable: true });
  });
  it('le jeton vérifié provient toujours de la session, même si le payload contient idToken', async () => {
    let body;
    const api = runtime(database(), {
      stubs: { 'lib/firebase.js': { auth: { currentUser: { getIdToken: async () => 'session-token' } } } },
      globals: { fetch: async (_url, options) => {
        body = JSON.parse(options.body);
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      } },
    })('lib/api.js');
    await api.apiPost('fixture', { idToken: 'payload-token' });
    expect(body.idToken).toBe('session-token');
  });
});

describe('Ouverture des livres et visioconférences', () => {
  it('réserve une seule fenêtre, coupe opener et ne fait pas naviguer l’application', () => {
    const popup = { opener: {}, location: { replace: vi.fn() }, close: vi.fn() };
    const win = { open: vi.fn(() => popup), location: { origin: 'https://app.example.invalid' } };
    const { reserveExternalWindow } = runtime(database(), { globals: { window: win } })('lib/externalWindow.js');
    const destination = reserveExternalWindow();
    destination.navigate('https://meet.google.com/fixture');
    expect(popup.opener).toBeNull();
    expect(win.open).toHaveBeenCalledExactlyOnceWith('about:blank', '_blank');
    expect(popup.location.replace).toHaveBeenCalledExactlyOnceWith('https://meet.google.com/fixture');
    expect(win.location.href).toBeUndefined();
  });
  it('signale un popup bloqué avant tout appel qui consommerait des minutes', () => {
    const { reserveExternalWindow } = runtime(database(), { globals: { window: { open: () => null } } })('lib/externalWindow.js');
    expect(reserveExternalWindow()).toBeNull();
  });
});
