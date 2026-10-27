// firebase-tools 15 utilise explicitement ProxyAgent, sans tenir compte de
// NO_PROXY. Conserver le proxy pour Internet et ne contourner que les ports
// des émulateurs sur la boucle locale. Ce preload ne sert qu'au CLI de test.
const { createRequire } = require('node:module');
if (process.env.FIREBASE_TEST_MODE !== 'true') throw new Error('Preload réservé aux tests Firebase.');
const cliRequire = createRequire(require.resolve('firebase-tools/package.json'));
const { ProxyAgent, Agent } = cliRequire('undici');
const dispatch = ProxyAgent.prototype.dispatch;
const local = new Agent();
ProxyAgent.prototype.dispatch = function (options, handler) {
  const origin = new URL(String(options.origin));
  if (['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) &&
      ['9000', '9099', '4400', '4500'].includes(origin.port)) {
    return local.dispatch(options, handler);
  }
  return dispatch.call(this, options, handler);
};

// firebase-admin 12 embarque sa propre copie de faye, inaccessible via require.
// Adapter uniquement cette option de transport dans le module de test chargé,
// sans modifier node_modules ni les connexions Internet. À retirer lorsque le
// SDK RTDB respectera NO_PROXY. Aucun jeton ni règle Firebase n'est remplacé.
const Module = require('node:module');
const fs = require('node:fs');
const standalone = require.resolve('@firebase/database-compat/standalone');
const originalLoader = Module._extensions['.js'];
Module._extensions['.js'] = function (module, filename) {
  if (filename !== standalone) return originalLoader(module, filename);
  const source = fs.readFileSync(filename, 'utf8');
  const assignment = "options['proxy'] = { origin: proxy };";
  if (!source.includes(assignment)) throw new Error('Adapter le transport local au nouveau SDK RTDB.');
  module._compile(source.replaceAll(assignment,
    "if (new URL(this.connURL).hostname !== '127.0.0.1' || new URL(this.connURL).port !== '9000') { " + assignment + " }"), filename);
};
