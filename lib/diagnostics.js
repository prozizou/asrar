'use client';
const { sanitizeDiagnostic } = require('./diagnosticPrivacy');

let queue = [], seen = new Map(), started = false, sending = false;
let tokenGetter = async () => null;
let version = process.env.NEXT_PUBLIC_APP_VERSION || 'inconnue';
let minuteAt = 0, minuteCount = 0;

// Jamais d'exception ni de blocage de l'action qui produit le diagnostic.
export function reportDiagnostic(input) {
  if (typeof window === 'undefined') return;
  try {
    const event = sanitizeDiagnostic({ ...input, page: window.location.pathname, version, online: navigator.onLine });
    const key = JSON.stringify([event.kind, event.name, event.page, event.endpoint, event.stack, event.statusCode]);
    const now = Date.now();
    if (seen.has(key) && now - seen.get(key) < 60000) return;
    if (now - minuteAt >= 60000) { minuteAt = now; minuteCount = 0; seen.clear(); }
    if (minuteCount >= 12 || queue.length >= 20) return;
    seen.set(key, now); minuteCount++;
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
  let tickAt = performance.now(), visibleAt = tickAt;
  const visibility = () => {
    tickAt = performance.now(); visibleAt = tickAt;
    if (document.visibilityState === 'hidden') void flushDiagnostics();
  };
  const timer = setInterval(() => {
    const now = performance.now();
    const gap = now - tickAt;
    if (document.visibilityState === 'visible' && now - visibleAt > 5000 && gap >= 3500 && gap < 30000) {
      reportDiagnostic({ kind: 'freeze', durationMs: gap - 1000 });
    }
    tickAt = now;
    void flushDiagnostics();
  }, 1000);
  const flush = () => { void flushDiagnostics(); };
  window.addEventListener('error', onError, true);
  window.addEventListener('unhandledrejection', onRejection);
  window.addEventListener('online', flush);
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', visibility);
  return () => {
    started = false; clearInterval(timer);
    window.removeEventListener('error', onError, true);
    window.removeEventListener('unhandledrejection', onRejection);
    window.removeEventListener('online', flush);
    window.removeEventListener('pagehide', flush);
    document.removeEventListener('visibilitychange', visibility);
  };
}
