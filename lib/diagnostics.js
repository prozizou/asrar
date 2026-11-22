'use client';
const { sanitizeDiagnostic } = require('./diagnosticPrivacy');
export const LAG_THRESHOLD_MS = 1000;
const HEARTBEAT_MS = 250;
const FLUSH_MS = 5000;

let queue = [], seen = new Map(), started = false, sending = false;
let tokenGetter = async () => null;
let version = process.env.NEXT_PUBLIC_APP_VERSION || 'inconnue';
let minuteAt = 0, minuteCount = 0;

// Jamais d'exception ni de blocage de l'action qui produit le diagnostic.
export function reportDiagnostic(input) {
  if (typeof window === 'undefined') return;
  try {
    const event = sanitizeDiagnostic({ ...input, page: window.location.pathname, version, online: navigator.onLine });
    const isLag = event.kind === 'freeze' || event.kind === 'slow_api';
    if (isLag && event.durationMs <= LAG_THRESHOLD_MS) return;
    const fingerprint = item => JSON.stringify([item.kind, item.name, item.page, item.endpoint, item.stack, item.statusCode]);
    const key = fingerprint(event);
    const pending = isLag ? queue.find(item => fingerprint(item) === key) : null;
    if (pending && pending.occurrences < 100) {
      pending.occurrences = Math.min(100, pending.occurrences + event.occurrences);
      pending.durationMs = Math.max(pending.durationMs, event.durationMs);
      return;
    }
    const now = Date.now();
    if (!isLag && seen.has(key) && now - seen.get(key) < 60000) return;
    if (now - minuteAt >= 60000) { minuteAt = now; minuteCount = 0; seen.clear(); }
    if ((!seen.has(key) && minuteCount >= 12) || queue.length >= 20) return;
    if (!seen.has(key)) minuteCount++;
    seen.set(key, now);
    queue.push(event);
  } catch { /* diagnostic facultatif */ }
}

export async function flushDiagnostics() {
  if (sending || !queue.length || navigator.onLine === false) return;
  sending = true;
  const events = queue.splice(0, 5);
  let tokenTimer, requestTimer;
  try {
    const idToken = await Promise.race([
      Promise.resolve().then(() => tokenGetter()).catch(() => null),
      new Promise(resolve => { tokenTimer = setTimeout(() => resolve(null), 1000); }),
    ]);
    clearTimeout(tokenTimer);
    const controller = new AbortController();
    requestTimer = setTimeout(() => controller.abort(), 5000);
    await fetch('/api/client-error', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events, ...(idToken ? { idToken } : {}) }),
      keepalive: true, signal: controller.signal,
    });
  } catch { /* Pas de réessai infini ni de collecte persistante hors ligne. */ }
  finally { clearTimeout(tokenTimer); clearTimeout(requestTimer); sending = false; }
}

// Heartbeat visible uniquement : les suspensions en arrière-plan et les
// longues mises en veille ne sont pas des blocages de l'application.
export function startDiagnostics(options = {}) {
  if (typeof window === 'undefined' || started) return () => {};
  started = true;
  tokenGetter = options.getToken || (async () => null);
  version = options.version || 'inconnue';
  const onError = event => {
    if (event.error) reportDiagnostic({ kind: 'javascript', name: event.error.name, stack: event.error.stack });
    else if (event.target?.tagName === 'SCRIPT' || event.target?.tagName === 'LINK') reportDiagnostic({ kind: 'resource' });
    else if (event.message) reportDiagnostic({ kind: 'javascript' });
  };
  const onRejection = event => reportDiagnostic({ kind: 'javascript', name: event.reason?.name, stack: event.reason?.stack });
  let tickAt = performance.now(), visibleAt = tickAt, flushedAt = tickAt;
  const visibility = () => {
    tickAt = performance.now(); visibleAt = tickAt;
    if (document.visibilityState === 'hidden') void flushDiagnostics();
  };
  let observer = null;
  // Chrome/Android : mesure réelle de chaque tâche bloquante. Les callbacks
  // arrivent une fois le thread libéré, donc sans ralentir la tâche observée.
  try {
    if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      observer = new PerformanceObserver(list => {
        if (document.visibilityState !== 'visible') return;
        for (const entry of list.getEntries()) {
          if (entry.startTime >= visibleAt && entry.duration > LAG_THRESHOLD_MS) {
            reportDiagnostic({ kind: 'freeze', durationMs: entry.duration });
          }
        }
      });
      observer.observe({ type: 'longtask' });
    }
  } catch { observer?.disconnect(); observer = null; }
  const timer = setInterval(() => {
    const now = performance.now();
    const delay = now - tickAt - HEARTBEAT_MS;
    // Repli pour les navigateurs sans Long Tasks : retard du heartbeat,
    // sans compter les suspensions en arrière-plan ou les longues veilles.
    if (!observer && document.visibilityState === 'visible' && delay > LAG_THRESHOLD_MS && now - tickAt < 30000) {
      reportDiagnostic({ kind: 'freeze', durationMs: delay });
    }
    tickAt = now;
    if (now - flushedAt >= FLUSH_MS) {
      flushedAt = now;
      void flushDiagnostics();
    }
  }, HEARTBEAT_MS);
  const flush = () => { void flushDiagnostics(); };
  window.addEventListener('error', onError, true);
  window.addEventListener('unhandledrejection', onRejection);
  window.addEventListener('online', flush);
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', visibility);
  return () => {
    started = false; clearInterval(timer); observer?.disconnect();
    window.removeEventListener('error', onError, true);
    window.removeEventListener('unhandledrejection', onRejection);
    window.removeEventListener('online', flush);
    window.removeEventListener('pagehide', flush);
    document.removeEventListener('visibilitychange', visibility);
  };
}
