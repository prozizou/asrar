import { test as base, expect, type Page, type APIRequestContext } from '@playwright/test';
import { build } from 'esbuild';
const { accounts } = require('./accounts.cjs');

let loginScript: string;
async function login(page: Page, role: string) {
  if (!loginScript) {
    const result = await build({ entryPoints: ['e2e/authenticated/browser-login.js'], bundle: true, write: false,
      platform: 'browser', format: 'iife', minify: true });
    loginScript = result.outputFiles[0].text;
  }
  // Toute tentative de joindre un service réel pendant ces scénarios échoue.
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' && ['3102', '9099', '9000'].includes(url.port)) return route.continue();
    return route.abort();
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /continuer avec google/i })).toBeVisible();
  await page.addScriptTag({ content: loginScript });
  await page.evaluate(async (account) => {
    await (window as any).asrarEmulatorSignIn(account.email, account.password);
  }, accounts[role]);
  await page.reload();
  await expect(page.getByRole('button', { name: /continuer avec google/i })).toHaveCount(0);
}

export async function tokenAs(request: APIRequestContext, role: string): Promise<string> {
  const account = accounts[role];
  const auth = await request.post('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-only', {
    data: { email: account.email, password: account.password, returnSecureToken: true },
  });
  expect(auth.ok()).toBe(true);
  const { idToken } = await auth.json();
  return idToken;
}

async function postAs(request: APIRequestContext, role: string, path: string, body = {}) {
  const idToken = await tokenAs(request, role);
  return request.post('/api/' + path, { data: { ...body, idToken } });
}

export const test = base.extend<{ login: (role: string) => Promise<void>; postAs: (role: string, path: string, body?: object) => Promise<any> }>({
  login: async ({ page }, provide) => provide((role) => login(page, role)),
  postAs: async ({ request }, provide) => provide((role, path, body) => postAs(request, role, path, body)),
});
export { expect };
