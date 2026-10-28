import { test, expect } from './fixtures';
import { VIEW_ROUTES } from './view-routes';
const { app } = require('../../server/grant');

for (const width of [320, 1440]) for (const theme of ['dark', 'light']) {
  test(`les 32 vues conservent leurs repères à ${width}px en thème ${theme}`, async ({ page, login }) => {
    test.setTimeout(70000);
    await page.setViewportSize({ width, height: 900 }); await login('premium');
    await page.evaluate((value) => {
      localStorage.setItem('asrar_theme', value);
      localStorage.setItem('asrar_expiry_banner_dismissed_until', String(Date.now() + 86400000));
    }, theme);
    const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
    for (const path of VIEW_ROUTES) {
      await test.step(path, async () => {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
        if (path !== '/' && path !== '/menu') {
          await expect(page.getByRole('link', { name: /Retour|Tableau de bord/ }).first()).toBeVisible();
        }
        expect(await page.locator('html').getAttribute('data-theme')).toBe(theme);
        const clipped = await page.locator('h1, input:not([type=checkbox]):not([type=range]):not([type=file]):not([type=hidden]), select, textarea').evaluateAll((nodes) => nodes.filter((node) => {
          const rect = node.getBoundingClientRect();
          return rect.width > 2 && rect.height > 2 && (rect.left < -1 || rect.right > innerWidth + 1);
        }).map((node) => node.outerHTML.slice(0, 160)));
        expect(clipped, path).toEqual([]);
      });
    }
    expect(errors).toEqual([]);
  });
}

test('les styles du marché restent isolés après navigation', async ({ page, login }) => {
  await login('premium'); await page.goto('/wafq/carre/4');
  const panel = page.locator('.glass-panel');
  const appearance = () => panel.evaluate((node) => { const s = getComputedStyle(node); return { padding: s.padding, border: s.border, background: s.backgroundColor }; });
  const initial = await appearance();
  await page.getByRole('link', { name: /Retour/ }).click();
  await page.getByRole('link', { name: /Retour/ }).click();
  await page.getByRole('link', { name: /Retour/ }).click();
  await expect(page.locator('.market-page')).toBeVisible();
  await page.getByRole('link', { name: 'Ouvrir le menu', exact: true }).click();
  await page.getByRole('link', { name: /Ressources/ }).click();
  await page.getByRole('link', { name: /Biblioth/ }).click();
  await page.getByRole('link', { name: /Retour/ }).click();
  await page.getByRole('link', { name: 'Ouvrir le menu', exact: true }).click();
  await page.getByRole('link', { name: /Sciences traditionnelles/ }).click();
  await page.getByRole('link', { name: /Hatims/ }).click();
  await page.getByRole('link', { name: 'Carré 4 × 4, 16 cases', exact: true }).click();
  expect(await appearance()).toEqual(initial);
});

test('la bibliothèque garde ses titres masqués et conserve un commentaire après échec', async ({ page, login, postAs }) => {
  const title = 'Traité de référence — Méditation et textes arabes '.repeat(4).trim();
  // L’API administrateur invalide le catalogue, comme en production.
  expect((await postAs('admin', 'admin', { action: 'save-book', key: 'ui-book', titre: title, auteur: 'Auteur de recette', pdf: 'https://example.invalid/test.pdf' })).status()).toBe(200);
  await page.setViewportSize({ width: 320, height: 800 }); await login('premium'); await page.goto('/bibliotheque');
  const hiddenTitle = page.getByRole('heading', { name: title, exact: true });
  await expect(hiddenTitle).toHaveClass('sr-only');
  await expect(hiddenTitle).toHaveCSS('clip-path', 'inset(50%)');
  await expect(hiddenTitle).toHaveCSS('width', '1px');
  await expect(hiddenTitle).toHaveCSS('height', '1px');
  const open = page.getByRole('button', { name: `Ouvrir « ${title} »`, exact: true });
  await open.focus(); await expect(open).toBeFocused();
  await page.getByRole('button', { name: `Commentaires de « ${title} »`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Commentaires — ' + title });
  await expect(dialog).toBeVisible();
  await page.route('**/api/book-social', (route) => route.request().postDataJSON()?.action === 'comment'
    ? route.fulfill({ status: 503, json: { error: 'Panne simulée' } }) : route.fallback());
  const input = dialog.getByRole('textbox', { name: 'Écrire un commentaire' }); await input.fill('Mon commentaire à conserver.');
  await dialog.getByRole('button', { name: 'Envoyer', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Votre texte est conservé');
  await expect(input).toHaveValue('Mon commentaire à conserver.');
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  expect((await postAs('admin', 'admin', { action: 'delete-book', key: 'ui-book' })).status()).toBe(200);
});

test('bibliothèque, boutique et secrets proposent une reprise après une panne initiale', async ({ page, login }) => {
  await login('premium'); let failing = true;
  await page.route('**/api/list-content', (route) => failing
    ? route.fulfill({ status: 503, json: { error: 'Panne simulée' } }) : route.fallback());
  await page.route('**/api/shop', (route) => failing
    ? route.fulfill({ status: 503, json: { error: 'Panne simulée' } }) : route.fallback());
  for (const [path, title] of [['/bibliotheque', 'Bibliothèque indisponible'], ['/boutique', 'Boutique indisponible'], ['/asrar', 'Secrets indisponibles']]) {
    failing = true; await page.goto(path); await expect(page.getByRole('heading', { name: title })).toBeVisible();
    failing = false; await page.getByRole('button', { name: 'Réessayer', exact: true }).click();
    await expect(page.getByRole('heading', { name: title })).toHaveCount(0);
  }
});

test('les filtres et les sous-pages restent utilisables au clavier avec des cibles tactiles de 44px', async ({ page, login }) => {
  await page.setViewportSize({ width: 320, height: 800 }); await login('premium');
  for (const [path, selector] of [['/tafsir', '.tf-cat-btn'], ['/wafq', '.wq-intent-btn']]) {
    await page.goto(path); const controls = page.locator(selector);
    for (const button of await controls.all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await controls.last().focus(); await page.keyboard.press('Enter');
    await expect(controls.last()).toHaveClass(/active/);
  }

});

test('les neuf tailles de carrés affichent des valeurs lisibles sans déborder de la page', async ({ page, login }) => {
  await page.setViewportSize({ width: 320, height: 850 }); await login('premium');
  for (let size = 3; size <= 11; size++) {
    await page.goto('/wafq/carre/' + size);
    await expect(page.locator('.kz-field input').first()).toBeVisible();
    for (const field of await page.locator('.kz-field input').all()) await field.fill('10000');
    await page.getByRole('button', { name: 'Calculer', exact: true }).click();
    const grid = page.getByRole('region', { name: `Carré numérique ${size} × ${size}`, exact: true });
    await expect(grid).toBeVisible(); await expect(grid.locator('.kz-cell')).toHaveCount(size * size);
    expect(await grid.evaluate((node) => node.getBoundingClientRect().right <= innerWidth)).toBe(true);
    const hiddenNumbers = await grid.locator('.kz-cell-txt').evaluateAll((nodes) => nodes.filter((node) => {
      const parent = node.parentElement!; return node.getBoundingClientRect().width > parent.clientWidth;
    }).length);
    expect(hiddenNumbers).toBe(0);
    if (size === 11) {
      await page.getByRole('slider', { name: 'Taille du texte des cases' }).fill('2');
      await grid.focus(); await page.keyboard.press('End');
      expect(await grid.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
    }
  }
});

test('la suppression vendeur exige une confirmation et conserve le produit si le serveur échoue', async ({ page, login }) => {
  await page.setViewportSize({ width: 320, height: 800 }); await login('seller'); await page.goto('/boutique');
  const remove = page.getByRole('button', { name: 'Supprimer « Produit de test »', exact: true });
  await remove.click(); const dialog = page.getByRole('dialog', { name: 'Supprimer le produit', exact: true });
  await page.route('**/api/shop', (route) => route.request().postDataJSON()?.action === 'delete-product'
    ? route.fulfill({ status: 503, json: { error: 'Panne simulée' } }) : route.fallback());
  await dialog.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Le produit est conservé');
  expect((await app().database().ref('det_produits/product1').once('value')).exists()).toBe(true);
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(remove).toBeFocused();
});

test('un changement rapide de catégorie ne remplace pas les secrets récents par une ancienne réponse', async ({ page, login }) => {
  await login('premium'); let delayed: any;
  await page.route('**/api/list-content', (route) => {
    const data = route.request().postDataJSON();
    if (data?.kind !== 'secret') return route.fallback();
    if (data.cat === 'protection') { delayed = route; return; }
    return route.fulfill({ json: { items: [{ _key: 'new', faida: 'Ouverture actuelle', intro: 'Catégorie choisie' }] } });
  });
  await page.goto('/asrar'); await expect.poll(() => !!delayed).toBe(true);
  await page.getByRole('button', { name: 'Ouvertures', exact: true }).click();
  await expect(page.getByRole('button', { name: /Ouverture actuelle/ })).toBeVisible();
  await delayed.fulfill({ json: { items: [{ _key: 'old', faida: 'Ancienne protection' }] } });
  await expect(page.getByRole('button', { name: /Ancienne protection/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Ouverture actuelle/ })).toBeVisible();
});

for (const kind of ['product', 'secret']) {
  test(`le brouillon ${kind} est conservé après échec et vidé après confirmation serveur`, async ({ page, login }) => {
    await login('premium'); let failing = true;
    await page.route('**/api/social', (route) => failing && route.request().postDataJSON()?.action === 'comment'
      ? route.fulfill({ status: 503, json: { error: 'Panne simulée' } }) : route.fallback());
    let input;
    if (kind === 'product') {
      await page.goto('/'); await page.getByRole('button', { name: 'Produit De Test', exact: true }).click();
      const dialog = page.getByRole('dialog'); await dialog.getByRole('button', { name: 'Commentaires', exact: true }).click();
      input = dialog.getByRole('textbox', { name: 'Écrire un commentaire', exact: true });
    } else if (kind === 'secret') {
      await page.goto('/asrar'); await page.getByRole('button', { name: /Secret de test/i }).click();
      await page.getByRole('button', { name: 'Commentaires', exact: true }).click();
      input = page.getByRole('textbox', { name: 'Votre commentaire', exact: true });
    }
    const text = 'Texte de recette à conserver ' + kind;
    await input.fill(text);
    const send = page.getByRole('button', { name: 'Envoyer', exact: true });
    await send.click(); await expect(page.getByRole('alert').filter({ hasText: /conservé/ })).toBeVisible();
    await expect(input).toHaveValue(text);
    failing = false; await send.click(); await expect(input).toHaveValue('');
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  });
}


test('les modules retirés ne réapparaissent pas dans les favoris, les récents ou la recherche', async ({ page, login }) => {
  await login('free');
  await page.evaluate(() => {
    for (const key of ['asrar_favorite_modules', 'asrar_recent_modules']) localStorage.setItem(key, JSON.stringify(['/abajad', '/thalsams', '/formation']));
  });
  await page.goto('/menu');
  await expect(page.locator('a[href="/abajad"], a[href="/thalsams"], a[href="/formation"]')).toHaveCount(0);
  const search = page.getByRole('searchbox', { name: 'Rechercher un module' });
  for (const term of ['Abajad', 'Thalsams', 'Formation']) {
    await search.fill(term);
    await expect(page.locator('a[href="/abajad"], a[href="/thalsams"], a[href="/formation"]')).toHaveCount(0);
  }
});
