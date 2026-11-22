// Contrat navigateur/serveur : aucun message libre, formulaire, corps HTTP,
// URL complète ou première ligne d'Error.stack n'est conservé.
const TITLES = {
  javascript: 'Erreur JavaScript', render: 'Erreur d’affichage',
  resource: 'Ressource indisponible', api: 'Erreur de communication API',
  slow_task: 'Tâche longue', slow_api: 'Réponse API lente', freeze: 'Blocage de l’interface', server: 'Erreur serveur',
};
const NAMES = ['Error', 'TypeError', 'ReferenceError', 'RangeError', 'SyntaxError', 'ChunkLoadError', 'NetworkError', 'AbortError'];
function diagnosticPath(value) {
  try {
    const path = new URL(String(value || '/').slice(0, 2048), 'https://local.invalid').pathname;
    return path.split('/').map(part => {
      if (/^[a-zA-Z0-9_.-]{1,160}\.(?:m?js|jsx|tsx?|css|woff2?)$/.test(part)) return part;
      if (part.length > 48 || /@|%40|%2f|%3f/i.test(part) || /\d{6,}|[a-f0-9]{16,}/i.test(part) || /^[a-f0-9]{8}-/i.test(part)) return ':id';
      return part.replace(/[^a-zA-Z0-9_.:-]/g, '_');
    }).join('/').slice(0, 200);
  } catch { return '/'; }
}
function diagnosticStack(value) {
  // Positions de fichiers uniquement, sans nom ni arguments des fonctions.
  const lines = String(value || '').slice(0, 12000).split('\n');
  // Une trace déjà nettoyée commence directement par /fichier.js:ligne.
  return lines.slice(/^\/[^\s]*\.(?:m?js|jsx|tsx?):\d+(?::\d+)?$/.test(lines[0]) ? 0 : 1, 16).flatMap(line => {
    const match = line.match(/(?:https?:\/\/[^\s)]+|(?:webpack-internal:)?\/[^\s)]+):\d+(?::\d+)?/);
    if (!match) return [];
    const frame = match[0];
    const position = frame.match(/:(\d+)(?::(\d+))?$/);
    const path = diagnosticPath(frame.replace(/:\d+(?::\d+)?$/, ''));
    return /\.(?:m?js|jsx|tsx?)$/.test(path) ? [path + ':' + position[1] + (position[2] ? ':' + position[2] : '')] : [];
  }).join('\n').slice(0, 1800);
}
const TASKS = ['api', 'export-word', 'export-pdf'];
const PHASES = ['auth', 'token', 'headers', 'json', 'complete', 'prepare'];
/** @param {any} input */
function diagnosticDetails(input = {}) {
  const ms = value => Math.min(3600000, Math.max(0, Math.round(Number(value) || 0)));
  const d = input && typeof input === 'object' ? input : {};
  const timings = {};
  for (const key of ['auth', 'token', 'headers', 'json', 'total', 'dialog']) if (Number.isFinite(d.timings?.[key])) timings[key] = ms(d.timings[key]);
  return {
    measurement: ['longtask', 'heartbeat', 'task', 'api', 'resource'].includes(d.measurement) ? d.measurement : '',
    resourceType: ['script', 'stylesheet', 'link'].includes(d.resourceType) ? d.resourceType : '',
    sourceFile: d.sourceFile ? diagnosticPath(d.sourceFile) : '',
    startMs: ms(d.startMs), rawDurationMs: ms(d.rawDurationMs), excludedDialogMs: ms(d.excludedDialogMs),
    task: TASKS.includes(d.task) ? d.task : '', phase: PHASES.includes(d.phase) ? d.phase : '',
    outcome: ['success', 'error', 'pending'].includes(d.outcome) ? d.outcome : '',
    method: d.method === 'POST' ? 'POST' : '', timings,
    observedAt: Number.isFinite(d.observedAt) ? Math.max(0, Math.min(9999999999999, Math.round(d.observedAt))) : 0,
    visibility: ['visible', 'hidden'].includes(d.visibility) ? d.visibility : '',
    connection: ['slow-2g', '2g', '3g', '4g'].includes(d.connection) ? d.connection : '',
    rtt: ms(d.rtt), downlink: Math.min(10000, Math.max(0, Number(d.downlink) || 0)),
    viewport: Array.isArray(d.viewport) ? d.viewport.slice(0, 2).map(ms) : [],
    cores: Math.min(256, ms(d.cores)), memoryGB: Math.min(128, ms(d.memoryGB)),
    breadcrumbs: Array.isArray(d.breadcrumbs) ? d.breadcrumbs.slice(-12).map(b => ({
      type: ['click', 'api-start', 'api-end', 'task-start', 'task-end'].includes(b?.type) ? b.type : 'click',
      at: ms(b?.at), path: diagnosticPath(b?.path),
      target: ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(b?.target) ? b.target : '',
      task: TASKS.includes(b?.task) ? b.task : '',
    })) : [],
  };
}
function sanitizeDiagnostic(input = {}) {
  const kind = typeof input.kind === 'string' && Object.prototype.hasOwnProperty.call(TITLES, input.kind) ? input.kind : 'javascript';
  const durationMs = Math.ceil(Number(input.durationMs));
  const statusCode = Math.round(Number(input.statusCode));
  return {
    details: diagnosticDetails(input.details),
    kind, title: TITLES[kind], name: NAMES.includes(input.name) ? input.name : 'Error',
    page: diagnosticPath(input.page || input.url),
    endpoint: input.endpoint ? diagnosticPath('/api/' + String(input.endpoint).replace(/^\/api\//, '')) : '',
    stack: diagnosticStack(input.stack),
    version: typeof input.version === 'string' && /^v?\d{1,3}(?:\.\d{1,3}){1,3}$/.test(input.version) ? input.version : 'inconnue',
    occurrences: Number.isSafeInteger(input.occurrences) ? Math.min(100, Math.max(1, input.occurrences)) : 1,
    durationMs: Number.isFinite(durationMs) ? Math.min(300000, Math.max(0, durationMs)) : 0,
    statusCode: statusCode >= 100 && statusCode <= 599 ? statusCode : 0,
    online: typeof input.online === 'boolean' ? input.online : null,
  };
}
module.exports = { sanitizeDiagnostic, diagnosticPath, diagnosticStack, diagnosticDetails, TITLES };
