import { test, expect } from './fixtures';

test('accueil : un échec réseau bref est repris sans erreur persistante', async ({ page, login }) => {
  await login('free');
  await page.goto('/notifications');
  await expect(page.getByText('Notification personnelle', { exact: true })).toBeVisible();
  let products = 0;
  await page.route('**/api/list-content', async route => {
    if (route.request().postDataJSON()?.kind === 'product' && ++products === 1) return route.abort('connectionreset');
    return route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /^Produit de test$/i }).first()).toBeVisible();
  expect(products).toBe(2);
  await expect(page.getByRole('button', { name: 'Réessayer le chargement' })).toHaveCount(0);
});

test('accueil : échec persistant borné puis reprise manuelle', async ({ page, login }) => {
  await login('free');
  await page.goto('/notifications');
  await expect(page.getByText('Notification personnelle', { exact: true })).toBeVisible();
  let failed = true, products = 0;
  await page.route('**/api/list-content', route => {
    if (route.request().postDataJSON()?.kind === 'product') { products++; if (failed) return route.abort('connectionreset'); }
    return route.continue();
  });
  await page.goto('/');
  const retry = page.getByRole('button', { name: 'Réessayer le chargement' });
  await expect(retry).toBeVisible(); expect(products).toBe(2);
  failed = false;
  await retry.click();
  await expect(page.getByRole('heading', { name: /^Produit de test$/i }).first()).toBeVisible();
  expect(products).toBe(3);
});

test('accueil : le retour du réseau recharge sans rechargement de la page', async ({ page, context, login }) => {
  await login('free');
  await page.goto('/notifications');
  await expect(page.getByText('Notification personnelle', { exact: true })).toBeVisible();
  let failed = true;
  await page.route('**/api/list-content', route => {
    if (route.request().postDataJSON()?.kind === 'product' && failed) return route.abort('connectionreset');
    return route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Réessayer le chargement' })).toBeVisible();
  await page.evaluate(() => { (window as any).catalogPageIdentity = 'same-document'; });
  await context.setOffline(true); failed = false; await context.setOffline(false);
  await expect(page.getByRole('heading', { name: /^Produit de test$/i }).first()).toBeVisible();
  expect(await page.evaluate(() => (window as any).catalogPageIdentity)).toBe('same-document');
});

test('accueil : une indisponibilité des boutiques conserve les produits et reprend à la reconnexion', async ({ page, context, login }) => {
  await login('free');
  await page.goto('/notifications');
  await expect(page.getByText('Notification personnelle', { exact: true })).toBeVisible();
  let failed = true, shops = 0;
  await page.route('**/api/list-content', route => {
    if (route.request().postDataJSON()?.kind === 'shop') { shops++; if (failed) return route.abort('connectionreset'); }
    return route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /^Produit de test$/i }).first()).toBeVisible();
  expect(shops).toBe(2);
  await context.setOffline(true); failed = false; await context.setOffline(false);
  await expect.poll(() => shops).toBe(3);
  await expect(page.getByRole('heading', { name: /^Produit de test$/i }).first()).toBeVisible();
});

test('accueil : un lien de boutique est conservé pendant la coupure puis ouvert après reprise', async ({ page, context, login }) => {
  await login('free'); await page.goto('/notifications');
  await expect(page.getByText('Notification personnelle', { exact: true })).toBeVisible();
  let failed = true;
  await page.route('**/api/list-content', route => {
    if (route.request().postDataJSON()?.kind === 'shop') {
      if (failed) return route.abort('connectionreset');
      return route.fulfill({ json: { items: [{ vendorKey: 'recovery-shop', profile_name: 'Boutique de récupération' }] } });
    }
    return route.continue();
  });
  await page.goto('/?shop=recovery-shop');
  await expect(page.getByRole('heading', { name: /^Produit de test$/i }).first()).toBeVisible();
  await expect(page).toHaveURL(/shop=recovery-shop/);
  await context.setOffline(true); failed = false; await context.setOffline(false);
  await expect(page.getByRole('heading', { name: 'Boutique de récupération', exact: true })).toBeVisible();
  await expect(page).not.toHaveURL(/shop=recovery-shop/);
});
