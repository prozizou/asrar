// Contacts WhatsApp dans l'application Android, qui ne peut pas ouvrir de
// nouvelle fenêtre (lib/externalWindow.js) : le lien wa.me doit partir en
// navigation principale, que Capacitor confie à Android.
import { test, expect } from './fixtures';

// Ce que voit le site dans l'application : le pont natif Android, d'où
// @capacitor/core déduit la plateforme (getPlatformId → 'android').
const inApp = () => {
  (window as any).androidBridge = { postMessage: () => {} };
  (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', isPluginAvailable: () => false };
};

test('application : « Demander via WhatsApp » au Marché ouvre WhatsApp, sans fenêtre', async ({ page, login }) => {
  await page.addInitScript(inApp);
  const popups: string[] = [];
  page.on('popup', (p) => popups.push(p.url()));
  await login('free');
  // Après la connexion : la règle du fixture (tout service extérieur bloqué)
  // passerait sinon devant celle-ci (Playwright applique la plus récente).
  await page.route('https://wa.me/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>WhatsApp</title>' }));
  await page.goto('/marche');
  await page.getByText('Produit de test').first().click();
  await page.getByRole('button', { name: 'Demander via WhatsApp' }).click();
  await page.waitForURL(/^https:\/\/wa\.me\/00000000\?text=/);
  expect(decodeURIComponent(page.url())).toContain('Produit de test');
  expect(popups).toEqual([]);
});

test('application : « Contacter l’assistance pour mon abonnement » ouvre WhatsApp', async ({ page, login }) => {
  await page.addInitScript(inApp);
  await login('basic');
  await page.route('https://wa.me/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>WhatsApp</title>' }));
  await page.goto('/compte');
  await page.getByRole('link', { name: 'Contacter l’assistance pour mon abonnement' }).click();
  await page.waitForURL(/^https:\/\/wa\.me\/22100000000\?text=/);
});

test('site : le Marché ouvre toujours la demande WhatsApp dans un nouvel onglet', async ({ page, login }) => {
  // L'onglet charge /api/wa (lien de la demande) ; une redirection ne passe pas
  // par les interceptions de Playwright, d'où la réponse simulée sur /api/wa.
  await login('free');
  await page.context().route('**/api/wa?order=**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>WhatsApp</title>' }));
  await page.goto('/marche');
  await page.getByText('Produit de test').first().click();
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Demander via WhatsApp' }).click();
  const tab = await popup;
  await tab.waitForURL(/\/api\/wa\?order=[a-f0-9]{64}&token=[a-f0-9]{64}$/);
  expect(page.url()).not.toContain('wa.me'); // la page du site reste en place
});

test('API : format=json renvoie l’adresse WhatsApp au lieu de rediriger', async ({ request }) => {
  const json = await request.get('/api/wa?text=Bonjour&format=json');
  expect(json.status()).toBe(200);
  expect((await json.json()).url).toBe('https://wa.me/22100000000?text=Bonjour');
  const redirect = await request.get('/api/wa?text=Bonjour', { maxRedirects: 0 });
  expect(redirect.status()).toBe(302);
});
