const { spawnSync } = require('node:child_process');
const result = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build'], {
  env: require('./auth-test-env.cjs'), stdio: 'inherit',
});
process.exitCode = result.status || (result.error ? 1 : 0);
