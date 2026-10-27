import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(import.meta.url);
const clone = (value) => value == null ? null : structuredClone(value);

// Simulateur déterministe : instantanés indépendants, transactions avec
// cache initial vide puis réessais compare-and-swap en cas de concurrence.
// Il ne remplace pas la recette Firebase Emulator / préproduction.
export function database(initial = {}) {
  const data = clone(initial);
  let revision = 0, nextId = 0;
  const failures = [];
  const split = (p) => p.split('/').filter(Boolean);
  const read = (p) => {
    let value = data;
    for (const key of split(p)) value = value?.[key];
    return clone(value);
  };
  function check(p, operation) {
    const i = failures.findIndex((f) => f.path === p && f.operation === operation);
    if (i >= 0) { failures.splice(i, 1); throw new Error('Panne simulée : ' + p); }
  }
  function write(p, value) {
    const keys = split(p);
    let node = data;
    for (const key of keys.slice(0, -1)) node = node[key] ??= {};
    if (value == null) delete node[keys.at(-1)];
    else node[keys.at(-1)] = clone(value);
    revision++;
  }
  function snapshot(value, key = '') {
    const stored = clone(value);
    return {
      key, val: () => clone(stored), exists: () => stored != null,
      numChildren: () => Object.keys(stored || {}).length,
      forEach(fn) { for (const [k, v] of Object.entries(stored || {})) if (fn(snapshot(v, k))) return true; return false; },
    };
  }
  function ref(p = '', query = {}) {
    return {
      key: split(p).at(-1), child: (k) => ref(p + '/' + k),
      once: async () => {
        check(p, 'read');
        let value = read(p);
        if (query.order || query.last || query.first) {
          const field = (entry) => query.order === '.key' ? entry[0] : entry[1]?.[query.order] ?? null;
          let entries = Object.entries(value || {}).sort((a, b) => {
            const left = field(a), right = field(b);
            return (typeof left === 'string' ? left.localeCompare(right) : (left || 0) - (right || 0)) || a[0].localeCompare(b[0]);
          });
          if ('equal' in query) entries = entries.filter(([, v]) => v?.[query.order] === query.equal);
          if ('start' in query) entries = entries.filter((entry) => field(entry) >= query.start);
          if ('after' in query) entries = entries.filter((entry) => field(entry) > query.after);
          if ('end' in query) entries = entries.filter((entry) => field(entry) <= query.end);
          if (query.last) entries = entries.slice(-query.last);
          if (query.first) entries = entries.slice(0, query.first);
          value = Object.fromEntries(entries);
        }
        return snapshot(value, split(p).at(-1));
      },
      set: async (v) => { check(p, 'set'); write(p, v); },
      remove: async () => { check(p, 'remove'); write(p, null); },
      update: async (values) => { check(p, 'update'); for (const [k, v] of Object.entries(values)) write(p + '/' + k, v); },
      transaction: async (fn) => {
        check(p, 'transaction');
        if (fn(null) === undefined) return { committed: false, snapshot: snapshot(null) };
        for (let i = 0; i < 100; i++) {
          const before = revision;
          const value = fn(read(p));
          if (value === undefined) return { committed: false, snapshot: snapshot(read(p)) };
          await Promise.resolve();
          if (revision !== before) continue;
          write(p, value);
          return { committed: true, snapshot: snapshot(read(p)) };
        }
        throw new Error('Trop de conflits de transaction simulés.');
      },
      push(value) {
        const child = ref(p + '/generated' + String(++nextId).padStart(8, '0'));
        return value === undefined ? child : child.set(value).then(() => child);
      },
      orderByChild: (key) => ref(p, { ...query, order: key }),
      orderByKey: () => ref(p, { ...query, order: '.key' }),
      limitToLast: (n) => ref(p, { ...query, last: n }),
      limitToFirst: (n) => ref(p, { ...query, first: n }),
      equalTo: (v) => ref(p, { ...query, equal: v }),
      startAt: (v) => ref(p, { ...query, start: v }),
      startAfter: (v) => ref(p, { ...query, after: v }),
      endAt: (v) => ref(p, { ...query, end: v }),
    };
  }
  return { ref, read, failNext: (p, operation) => failures.push({ path: p, operation }) };
}

// Les handlers utilisent require() (hors du mocking ESM de Vitest). Charger
// le vrai code en isolant uniquement les frontières externes et l'identité.
export function runtime(db, options = {}) {
  const user = options.user || { uid: 'tester', email: 'tester@example.invalid' };
  const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });
  const stubs = {
    'server/grant.js': { app: () => ({ database: () => db, messaging: () => ({ send: async () => {} }) }) },
    'server/access.js': {
      verifyUser: async () => user, hasActiveAccess: async () => options.allowed ?? true,
      isAdmin: async () => false, httpError, emailKey: (email) => email.replace(/\./g, ','),
    },
    'server/log.js': { reportError: async () => {} },
    'server/adReward.js': { consumeAdPass: async () => false },
    'lib/rateLimit.js': { rateLimit: () => true },
    ...options.stubs,
  };
  const modules = new Map();
  function load(file) {
    if (Object.hasOwn(stubs, file) && stubs[file] !== undefined) return stubs[file];
    if (modules.has(file)) return modules.get(file).exports;
    const filename = path.join(root, file);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const cjsModule = { exports: {} };
    modules.set(file, cjsModule);
    const localRequire = (name) => {
      if (Object.hasOwn(stubs, name)) return stubs[name];
      if (!name.startsWith('.')) return require(name);
      let relative = path.relative(root, path.resolve(path.dirname(filename), name));
      if (!path.extname(relative)) relative += '.js';
      return load(relative);
    };
    vm.runInNewContext(code, {
      module: cjsModule, exports: cjsModule.exports, require: localRequire, console, process,
      Buffer, URL, Date, AbortController, setTimeout, clearTimeout, ...options.globals,
    }, { filename });
    return cjsModule.exports;
  }
  return load;
}

export async function invoke(handler, body = {}) {
  const res = {
    code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; },
    status(n) { this.code = n; return this; },
    json(value) { this.body = clone(value); return this; }, end() { return this; },
  };
  await handler({ method: 'POST', headers: {}, body: { idToken: 'fixture', ...body } }, res);
  return res;
}
