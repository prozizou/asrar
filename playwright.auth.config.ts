import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/authenticated',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  globalTimeout: 300000,
  globalSetup: './e2e/authenticated/setup.cjs',
  reporter: process.env.CI ? [['github'], ['html', { outputFolder: 'playwright-report-auth', open: 'never' }]] : 'list',
  outputDir: 'test-results/authenticated',
  use: { baseURL: 'http://127.0.0.1:3102', serviceWorkers: 'block', trace: 'retain-on-failure' },
  projects: [{ name: 'authenticated-chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx next start -p 3102',
    url: 'http://127.0.0.1:3102', reuseExistingServer: false, timeout: 60000,
  },
});
