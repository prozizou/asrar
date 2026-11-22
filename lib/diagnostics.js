'use client';
const { sanitizeDiagnostic } = require('./diagnosticPrivacy');
export const LAG_THRESHOLD_MS = 1000;
const HEARTBEAT_MS = 250;
const FLUSH_MS = 5000;

const breadcrumbs = [], tasks = new Map();
export function diagnosticBreadcrumb(type, path = '', task = '', target = '') {
  breadcrumbs.push({ type, path: path || (typeof window !== 'undefined' ? window.location.pathname : '/'), task, target, at: Math.round(typeof performance === 'undefined' ? 0 : performance.now()) });
  if (breadcrumbs.length > 12) breadcrumbs.shift();
}
export function startDiagnosticTask(task) {
  const start = performance.now(), stack = new Error().stack;
  const id = Symbol(task); tasks.set(id, { task, phase: 'prepare' });
  diagnosticBreadcrumb('task-start', '', task);
  return (error = null) => {
    tasks.delete(id); diagnosticBreadcrumb('task-end', '', task);
    const total = performance.now() - start, dialog = browserDialogWaitMs(start, performance.now());
    if (error || total - dialog > LAG_THRESHOLD_MS) reportDiagnostic({
      kind: error ? 'javascript' : 'slow_task', name: error?.name, stack: error?.stack || stack,
      durationMs: total - dialog, details: { measurement: 'task', task, phase: error ? 'prepare' : 'complete', outcome: error ? 'error' : 'success', timings: { total, dialog } },
    });
  };
}
let queue = [], seen = new Map(), started = false, sending = false;
let tokenGetter = async () => null;
let version = process.env.NEXT_PUBLIC_APP_VERSION || 'inconnue';
let minuteAt = 0, minuteCount = 0;

// Les boîtes natives (impression, enregistrement) peuvent suspendre JS
// pendant une interaction normale. Seul cet intervalle explicite est exclu
// du compteur de blocages ; la préparation du document reste surveillée.
const browserDialogWaits = [];
export function withBrowserDialog(action) {
  const interval = { start: performance.now(), end: Infinity };
  browserDialogWaits.push(interval);
  if (browserDialogWaits.length > 8) browserDialogWaits.shift();
  try { return action(); }
  finally { interval.end = performance.now(); }
}
function browserDialogWaitMs(start, end) {
  let coveredUntil = start, duration = 0;
  for (const wait of browserDialogWaits) {
    const from = Math.max(start, wait.start, coveredUntil), to = Math.min(end, wait.end);
    if (to > from) { duration += to - from; coveredUntil = to; }
  }
  return duration;
}

// Jamais d'exception ni de blocage de l'action qui produit le diagnostic.
export function reportDiagnostic(input) {
  if (typeof window === 'undefined') return;
  try {
    const device = /** @type {any} */ (navigator);
    const connection = device.connection || {};
    const activeTask = [...tasks.values()].slice(-1)[0] || {};
    const details = { ...activeTask, observedAt: Date.now(), visibility: typeof document === 'undefined' ? '' : document.visibilityState,
      connection: connection.effectiveType, rtt: connection.rtt, downlink: connection.downlink,
      viewport: [window.innerWidth, window.innerHeight], cores: navigator.hardwareConcurrency,
      memoryGB: device.deviceMemory, breadcrumbs: [...breadcrumbs], ...input.details };
    const event = sanitizeDiagnostic({ ...input, details, page: window.location.pathname, version, online: navigator.onLine });
    const isLag = event.kind === 'freeze' || event.kind === 'slow_api' || event.kind === 'slow_task';
    if (isLag && event.durationMs <= LAG_THRESHOLD_MS) return;
    const fingerprint = item => JSON.stringify([item.kind, item.name, item.page, item.endpoint, item.stack, item.statusCode, item.details.task, item.details.phase, item.kind === 'resource' ? item.details.sourceFile : '']);
    const key = fingerprint(event);
    const pending = isLag ? queue.find(item => fingerprint(item) === key) : null;
    if (pending && pending.occurrences < 100) {
      pending.occurrences = Math.min(100, pending.occurrences + event.occurrences);
      if (event.durationMs >= pending.durationMs) pending.details = event.details;
      pending.durationMs = Math.max(pending.durationMs, event.durationMs);
      pending.online = event.online;
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
    else if (event.target?.tagName === 'SCRIPT' || event.target?.tagName === 'LINK') {
      const target = event.target;
      reportDiagnostic({ kind: 'resource', name: 'Error', details: {
        measurement: 'resource', sourceFile: target.src || target.href || '',
        resourceType: target.tagName === 'SCRIPT' ? 'script' : target.rel === 'stylesheet' ? 'stylesheet' : 'link',
        outcome: 'error',
      } });
    }
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
          const duration = entry.duration - browserDialogWaitMs(entry.startTime, entry.startTime + entry.duration);
          if (entry.startTime >= visibleAt && duration > LAG_THRESHOLD_MS) {
            reportDiagnostic({ kind: 'freeze', durationMs: duration, details: { measurement: 'longtask', startMs: entry.startTime, rawDurationMs: entry.duration, excludedDialogMs: entry.duration - duration, sourceFile: (/** @type {any} */ (entry)).attribution?.[0]?.containerSrc || '' } });
          }
        }
      });
      observer.observe({ type: 'longtask' });
    }
  } catch { observer?.disconnect(); observer = null; }
  const timer = setInterval(() => {
    const now = performance.now();
    const delay = now - tickAt - HEARTBEAT_MS - browserDialogWaitMs(tickAt, now);
    // Repli pour les navigateurs sans Long Tasks : retard du heartbeat,
    // sans compter les suspensions en arrière-plan ou les longues veilles.
    if (!observer && document.visibilityState === 'visible' && delay > LAG_THRESHOLD_MS && now - tickAt < 30000) {
      reportDiagnostic({ kind: 'freeze', durationMs: delay, details: { measurement: 'heartbeat', startMs: tickAt, rawDurationMs: now - tickAt, excludedDialogMs: browserDialogWaitMs(tickAt, now) } });
    }
    tickAt = now;
    if (now - flushedAt >= FLUSH_MS) {
      flushedAt = now;
      void flushDiagnostics();
    }
  }, HEARTBEAT_MS);
  const click = event => diagnosticBreadcrumb('click', window.location.pathname, '', event.target?.closest?.('button,a,input,select,textarea')?.tagName || '');
  document.addEventListener('click', click, true);
  const flush = () => { void flushDiagnostics(); };
  window.addEventListener('error', onError, true);
  window.addEventListener('unhandledrejection', onRejection);
  window.addEventListener('online', flush);
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', visibility);
  return () => {
    document.removeEventListener('click', click, true);
    started = false; clearInterval(timer); observer?.disconnect();
    window.removeEventListener('error', onError, true);
    window.removeEventListener('unhandledrejection', onRejection);
    window.removeEventListener('online', flush);
    window.removeEventListener('pagehide', flush);
    document.removeEventListener('visibilitychange', visibility);
  };
}
