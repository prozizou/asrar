// Pages publiques (app/decouvrir) : lisibles SANS connexion et présentes dans
// le HTML du serveur (ce que lisent les robots de Google, dont AdSense).
import { test, expect } from '@playwright/test';
import { MODULES } from '../lib/publicPages';

const GOOGLEBOT_MOBILE = 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

test('le HTML serveur de chaque page publique contient son texte', async ({ request }) => {
  for (const path of ['/decouvrir', '/decouvrir/a-propos', '/decouvrir/contact', ...MODULES.map((m) => `/decouvrir/${m.slug}`)]) {
    const response = await request.get(path, { headers: { 'user-agent': GOOGLEBOT_MOBILE } });
    expect(response.status(), path).toBe(200);
    const html = await response.text();
    expect(html, path).toContain('<h1');
    expect(html, path).not.toContain('Se connecter</h1>');
  }
  const zikr = await (await request.get('/decouvrir/zikr-collectif')).text();
  expect(zikr).toContain('Réciter ensemble');
});

test('un visiteur non connecté lit la page sans écran de connexion ni publicité', async ({ page }) => {
  const ads: string[] = [];
  page.on('request', (r) => { if (/bicea\.org|googlesyndication|doubleclick/.test(r.url())) ads.push(r.url()); });
  await page.goto('/decouvrir');
  await expect(page.getByRole('heading', { level: 1, name: 'ASRAR PRO' })).toBeVisible();
  await page.getByRole('link', { name: /Secrets mystiques/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Secrets mystiques' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Se connecter' })).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  expect(ads).toEqual([]);
});

test('robots.txt et sitemap.xml listent les pages publiques', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Sitemap:');
  expect(robots).toContain('Disallow: /api/');
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('/decouvrir/bibliotheque');
  expect(sitemap).not.toContain('/menu');
});
