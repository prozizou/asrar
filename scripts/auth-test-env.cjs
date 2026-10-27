const env = {
  ...process.env,
  FIREBASE_TEST_MODE: 'true', NEXT_PUBLIC_FIREBASE_EMULATORS: 'true',
  FIREBASE_PROJECT_ID: 'demo-asrar-test',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:9000',
  SITE_URL: 'http://127.0.0.1:3102', SUPER_ADMIN_EMAIL: 'root@asrar.test',
  CRON_SECRET: 'emulator-cron-only',
  FIREBASE_CLI_DISABLE_TELEMETRY: '1', NEXT_TELEMETRY_DISABLED: '1',
  // Les services locaux ne doivent pas passer par le proxy Internet du CI.
  NO_PROXY: [process.env.NO_PROXY, '127.0.0.1', 'localhost', '::1'].filter(Boolean).join(','),
  no_proxy: [process.env.no_proxy, '127.0.0.1', 'localhost', '::1'].filter(Boolean).join(','),
};
env.NODE_OPTIONS = [process.env.NODE_OPTIONS,
  '--require=' + JSON.stringify(require('node:path').join(__dirname, 'emulator-proxy.cjs'))].filter(Boolean).join(' ');
for (const name of ['FIREBASE_SERVICE_ACCOUNT', 'FIREBASE_DB_URL', 'ERROR_WEBHOOK_URL', 'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN']) delete env[name];
module.exports = env;
