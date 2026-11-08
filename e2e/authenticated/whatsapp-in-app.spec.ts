// Contacts WhatsApp dans l'application Android, qui ne peut pas ouvrir de
// nouvelle fenêtre (lib/externalWindow.js) : le lien part en navigation
// principale, que Capacitor confie à Android — whatsapp://send (ouvre
// directement la discussion préremplie). Le lien web wa.me n'est JAMAIS ouvert
// d'office : un bandeau le propose si WhatsApp ne semble pas s'être ouvert.
import { test, expect } from './fixtures';

// Ce que voit le site dans l'application : le pont natif Android, d'où
// @capacitor/core déduit la plateforme (getPlatformId → 'android').
const inApp = () => {
  (window as any).androidBridge = { postMessage: () => {} };
  (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', isPluginAvailable: () => false };
};

// Navigations demandées par la page, y compris vers whatsapp:// (protocole
// externe, que Chromium ne charge pas).
function recordNavigations(page: any) {
  const urls: string[] = [];
  page.on('request', (request: any) => { if (request.isNavigationRequest()) urls.push(request.url()); });
  page.on('framenavigated', (frame: any) => { if (frame === page.mainFrame()) urls.push(frame.url()); });
  return urls;
}

const fallback = (page: any) => page.getByRole('alert').filter({ hasText: 'WhatsApp ne s’est pas ouvert ?' });
// Après la navigation vers whatsapp:// (protocole inconnu du Chromium de test),
// Chromium ne transmet plus les clics souris à la page : les boutons du bandeau
// sont donc activés par un événement click DOM (dispatchEvent), ce qui exerce
// le même gestionnaire que le toucher sur le téléphone.
const press = (locator: any) => locator.dispatchEvent('click');

test('application : « Demander via WhatsApp » au Marché ouvre WhatsApp, sans fenêtre ni page web d’office', async ({ page, login }) => {
  await page.addInitScript(inApp);
  const popups: string[] = [];
  page.on('popup', (p) => popups.push(p.url()));
  await login('free');
  // Après la connexion : la règle du fixture (tout service extérieur bloqué)
  // passerait sinon devant celle-ci (Playwright applique la plus récente).
  await page.route('https://wa.me/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>WhatsApp</title>' }));
  await page.goto('/marche');
  await page.getByText('Produit de test').first().click();
  const urls = recordNavigations(page);
  await page.getByRole('button', { name: 'Demander via WhatsApp' }).click();
  await expect.poll(() => urls.some((url) => url.startsWith('whatsapp://send?phone=00000000&text='))).toBe(true);
  const message = decodeURIComponent(urls.find((url) => url.startsWith('whatsapp://'))!.split('&text=')[1]);
  expect(message).toContain('Assalamou aleykoum 🌙');
  expect(message).toContain('*DEMANDE DE DISPONIBILITÉ*');
  expect(message).toContain('Produit de test');
  // WhatsApp absent du navigateur de test : le bandeau propose le lien web,
  // qui ne s'ouvre qu'au clic.
  await expect(fallback(page)).toBeVisible({ timeout: 6000 });
  expect(urls.some((url) => url.startsWith('https://wa.me/'))).toBe(false);
  await page.screenshot({ path: test.info().outputPath('whatsapp-fallback.png') });
  await press(fallback(page).getByRole('button', { name: 'Ouvrir dans le navigateur', exact: true }));
  await expect.poll(() => page.url(), { timeout: 10000 }).toMatch(/^https:\/\/wa\.me\/00000000\?text=/);
  expect(decodeURIComponent(page.url())).toContain('Produit de test');
  expect(popups).toEqual([]);
});

test('application : « Contacter l’assistance pour mon abonnement » ouvre WhatsApp', async ({ page, login }) => {
  await page.addInitScript(inApp);
  await login('basic');
  await page.route('https://wa.me/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>WhatsApp</title>' }));
  await page.goto('/compte');
  const urls = recordNavigations(page);
  await page.getByRole('link', { name: 'Contacter l’assistance pour mon abonnement' }).click();
  await expect.poll(() => urls.some((url) => url.startsWith('whatsapp://send?phone=22100000000&text='))).toBe(true);
  await expect(fallback(page)).toBeVisible({ timeout: 6000 });
  await press(fallback(page).getByRole('button', { name: 'Fermer', exact: true }));
  await expect(fallback(page)).toHaveCount(0);
  expect(urls.some((url) => url.startsWith('https://wa.me/'))).toBe(false);
  await expect(page).toHaveURL(/\/compte$/);
});

test('application : WhatsApp ouvert (l’application passe en arrière-plan), ni page web ni bandeau', async ({ page, login }) => {
  await page.addInitScript(inApp);
  await login('basic');
  await page.route('https://wa.me/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>WhatsApp</title>' }));
  await page.goto('/compte');
  const urls = recordNavigations(page);
  await page.getByRole('link', { name: 'Contacter l’assistance pour mon abonnement' }).click();
  await expect.poll(() => urls.some((url) => url.startsWith('whatsapp://send?phone=22100000000'))).toBe(true);
  // Ce que provoque l'ouverture de WhatsApp sur le téléphone : la WebView perd le focus.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(3500);
  expect(urls.some((url) => url.startsWith('https://wa.me/'))).toBe(false);
  await expect(fallback(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/compte$/);
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
