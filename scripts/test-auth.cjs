const { spawnSync } = require('node:child_process');
const env = require('./auth-test-env.cjs');

function run(args) {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
run(['node_modules/next/dist/bin/next', 'build']);
run(['--require', './scripts/emulator-proxy.cjs', 'node_modules/firebase-tools/lib/bin/firebase.js', 'emulators:exec', '--only', 'auth,database',
  '--project', 'demo-asrar-test', '--config', 'firebase.emulators.json',
  'node node_modules/@playwright/test/cli.js test --config=playwright.auth.config.ts']);
