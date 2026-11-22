import { afterEach, describe, expect, it, vi } from 'vitest';
import { database, runtime } from './support/runtime';
afterEach(() => vi.useRealTimers());
function setup(apiPost, navigator = { onLine: true }) {
  return runtime(database(), { stubs: { 'lib/api.js': { apiPost } }, globals: { navigator } })('lib/catalogRequest.js');
}
describe('Reprise du catalogue en lecture seule', () => {
  it('reprend une coupure brève une seule fois et restitue les produits', async () => {
    vi.useFakeTimers();
    const api = vi.fn().mockRejectedValueOnce(Object.assign(new Error('Network'), { status: 0 })).mockResolvedValue({ items: [{ _key: 'p' }] });
    const pending = setup(api).readCatalog('product');
    await vi.advanceTimersByTimeAsync(399); expect(api).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); expect(await pending).toEqual({ items: [{ _key: 'p' }] });
    expect(api).toHaveBeenCalledTimes(2); expect(api.mock.calls.every(([path, body]) => path === 'list-content' && body.kind === 'product')).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('ne répète ni refus, ni limite de débit, ni long délai déjà expiré', async () => {
    for (const error of [{ status: 401 }, { status: 403 }, { status: 429 }, { status: 0, timeout: true }]) {
      const api = vi.fn().mockRejectedValue(Object.assign(new Error('Refus'), error));
      await expect(setup(api).readCatalog('shop')).rejects.toMatchObject(error);
      expect(api).toHaveBeenCalledTimes(1);
    }
  });
  it('borne aussi les erreurs de passerelle et ne transforme pas une réponse invalide en liste vide', async () => {
    vi.useFakeTimers();
    const api = vi.fn().mockRejectedValue(Object.assign(new Error('Gateway'), { status: 503 }));
    const failed = expect(setup(api).readCatalog('product')).rejects.toMatchObject({ status: 503 });
    await vi.advanceTimersByTimeAsync(401); await failed;
    expect(api).toHaveBeenCalledTimes(2);
    await expect(setup(async () => ({})).readCatalog('product')).rejects.toMatchObject({ invalidResponse: true });
  });
  it('n’envoie rien hors ligne et annule une reprise après la sortie de la page', async () => {
    const api = vi.fn();
    await expect(setup(api, { onLine: false }).readCatalog('product')).rejects.toMatchObject({ status: 0 });
    expect(api).not.toHaveBeenCalled();
    vi.useFakeTimers();
    api.mockRejectedValue(Object.assign(new Error('Network'), { status: 0 }));
    const controller = new AbortController();
    const failed = expect(setup(api).readCatalog('product', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(1); controller.abort(); await failed;
    await vi.advanceTimersByTimeAsync(1000); expect(api).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  });
});

it('classe l’erreur réseau du diagnostic sans transmettre le message libre', async () => {
  const reports = [];
  const api = runtime(database(), { stubs: {
    'lib/firebase.js': { auth: { currentUser: { getIdToken: async () => 'test-session' } } },
    'lib/diagnostics.js': { LAG_THRESHOLD_MS: 1000, reportDiagnostic: event => reports.push(event) },
  }, globals: { fetch: async () => { throw new TypeError('PRIVATE CONTENT'); } } })('lib/api.js');
  await expect(api.apiPost('list-content', { kind: 'product' })).rejects.toMatchObject({ status: 0 });
  expect(reports[0]).toMatchObject({ kind: 'api', name: 'NetworkError', statusCode: 0 });
  expect(JSON.stringify(reports)).not.toMatch(/PRIVATE CONTENT|test-session/);
});
