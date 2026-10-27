// Un seul appel en cours ; aucune lecture périodique en arrière-plan ou
// hors ligne. Le retour au premier plan et les push déclenchent une reprise.
export function startVisiblePolling(load, intervalMs, { immediate = true, push = false } = {}) {
  if (typeof window === 'undefined') return () => {};
  let timer, running = false, stopped = false, queued = false;
  const active = () => document.visibilityState !== 'hidden' && navigator.onLine !== false;
  const schedule = () => { if (!stopped && active()) timer = setTimeout(run, intervalMs); };
  async function run() {
    clearTimeout(timer);
    if (stopped || !active()) return;
    if (running) { queued = true; return; }
    running = true;
    try { await load(); } catch { /* L'appelant gère son affichage d'erreur. */ }
    finally {
      running = false;
      if (queued && !stopped && active()) { queued = false; void run(); }
      else { queued = false; schedule(); }
    }
  }
  const resume = () => { clearTimeout(timer); if (active()) void run(); };
  const onPush = (event) => { if (event.data?.type === 'asrar-notification') resume(); };
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('online', resume);
  window.addEventListener('offline', resume);
  if (push) navigator.serviceWorker?.addEventListener('message', onPush);
  if (immediate) void run(); else schedule();
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', resume);
    window.removeEventListener('online', resume);
    window.removeEventListener('offline', resume);
    if (push) navigator.serviceWorker?.removeEventListener('message', onPush);
  };
}
