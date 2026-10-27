import { afterEach, describe, expect, it, vi } from 'vitest';
import { startVisiblePolling } from './visiblePolling';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function environment() {
  vi.useFakeTimers();
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const win = new EventTarget();
  const nav = { onLine: true, serviceWorker: new EventTarget() };
  vi.stubGlobal('document', doc); vi.stubGlobal('window', win); vi.stubGlobal('navigator', nav);
  return { doc, win, nav };
}

describe('Sondage visible uniquement', () => {
  it('ne lit rien dans un onglet masqué ou hors ligne et reprend immédiatement', async () => {
    const { doc, nav, win } = environment(), load = vi.fn(async () => {});
    const stop = startVisiblePolling(load, 30000);
    await vi.advanceTimersByTimeAsync(60000);
    expect(load).toHaveBeenCalledTimes(3);
    doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(3600000);
    expect(load).toHaveBeenCalledTimes(3);
    doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(4);
    nav.onLine = false; win.dispatchEvent(new Event('offline'));
    await vi.advanceTimersByTimeAsync(60000);
    expect(load).toHaveBeenCalledTimes(4);
    nav.onLine = true; win.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(5);
    stop(); await vi.advanceTimersByTimeAsync(60000);
    expect(load).toHaveBeenCalledTimes(5);
  });

  it('regroupe les événements push pendant une requête lente sans chevaucher les lectures', async () => {
    const { nav } = environment();
    let release, active = 0, max = 0;
    const gate = new Promise((resolve) => { release = resolve; });
    const load = vi.fn(async () => { active++; max = Math.max(max, active); await gate; active--; });
    const stop = startVisiblePolling(load, 30000, { push: true });
    for (let i = 0; i < 10; i++) nav.serviceWorker.dispatchEvent(Object.assign(new Event('message'), { data: { type: 'asrar-notification' } }));
    await vi.advanceTimersByTimeAsync(60000);
    expect(load).toHaveBeenCalledTimes(1);
    release(); await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(2);
    expect(max).toBe(1);
    stop();
  });
});
