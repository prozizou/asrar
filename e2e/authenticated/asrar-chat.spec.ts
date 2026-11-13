import { test, expect } from './fixtures';
const { app } = require('../../server/grant');

// Parcours complet Asrar-chat entre deux comptes réels (émulateurs) :
// vendeur → chaîne → publication payante ; acheteur → déverrouille → paie
// (Wave du vendeur) → déclare ; vendeur → vérifie et confirme ; acheteur →
// contenu dans sa bibliothèque. Le contenu n'est JAMAIS visible avant.
test.describe.configure({ mode: 'serial' });
const SECRET = 'Contenu secret de la formation : chapitre 1.';

test('vente d’un contenu payant dans une chaîne, paiement direct confirmé par le vendeur', async ({ browser, login }) => {
  test.setTimeout(120_000);
  const nodes = ['ac_profiles', 'ac_handles', 'ac_convs', 'ac_members', 'ac_user_convs', 'ac_messages', 'ac_posts', 'ac_post_content',
    'ac_orders', 'ac_buyer_orders', 'ac_seller_orders', 'ac_entitlements', 'ac_order_refs', 'ac_payment_refs', 'ac_signals', 'ac_inbox_signals'];
  await app().database().ref().update(Object.fromEntries(nodes.map((n) => [n, null])));
  const shot = (page: any, name: string) => page.screenshot({ path: test.info().outputPath(name + '.png') });

  // ── Vendeur : profil, vente, chaîne, publication payante ──
  const seller = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await login('seller', seller);
  // Profil créé automatiquement depuis le compte Google : pas d'écran d'accueil.
  await seller.goto('/asrar-chat');
  await expect(seller.getByText('Bienvenue sur Asrar-chat')).toHaveCount(0);
  await expect(seller.getByRole('button', { name: 'Discussions', exact: true })).toBeVisible();
  await seller.getByRole('button', { name: 'Profil', exact: true }).click();
  await seller.getByRole('button', { name: /Devenir vendeur/ }).click();
  await seller.getByLabel(/Lien Wave Business/).fill('https://pay.wave.com/m/M_sn_E2E123/c/sn/');
  await seller.getByRole('checkbox').check();
  await seller.getByRole('button', { name: 'Activer la vente' }).click();
  await expect(seller.getByRole('button', { name: /Vente et moyens de paiement/ })).toBeVisible();

  await seller.getByRole('button', { name: 'Discussions', exact: true }).click();
  await seller.getByRole('button', { name: 'Nouvelle discussion' }).click();
  await seller.getByRole('button', { name: 'Nouvelle chaîne' }).click();
  await seller.getByLabel('Nom', { exact: true }).fill('Chaîne E2E');
  await seller.getByRole('button', { name: 'Créer' }).click();
  const room = seller.getByRole('dialog', { name: 'Chaîne E2E' });
  await room.getByRole('button', { name: 'Options de la discussion' }).click();
  await room.getByRole('menuitem', { name: 'Publier un contenu' }).click();

  await seller.getByRole('radio', { name: 'Article' }).click();
  await seller.getByLabel('Titre').fill('Formation Python');
  await seller.getByLabel('Prix (FCFA)').fill('2000');
  await seller.getByLabel('Aperçu visible avant paiement').fill('Sommaire : variables, boucles, fonctions.');
  await seller.getByLabel('Texte de l’article').fill(SECRET);
  await seller.getByRole('button', { name: /^Publier à/ }).click();
  await expect(seller.getByRole('dialog', { name: 'Chaîne E2E' }).getByText('Formation Python')).toBeVisible();
  // L'auteur voit son contenu, avec le rappel de ce que voient les autres.
  await seller.getByRole('dialog', { name: 'Chaîne E2E' }).getByRole('button', { name: /Formation Python/ }).click();
  await expect(seller.getByText(/Vous êtes l’auteur/)).toBeVisible();
  await shot(seller, 'asrar-chat-0-vue-auteur');
  await seller.getByRole('button', { name: 'Fermer' }).click();

  // ── Acheteur : découvre la chaîne, voit le contenu verrouillé ──
  const buyer = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await login('basic', buyer);
  // Profil créé automatiquement depuis le compte Google : pas d'écran d'accueil.
  await buyer.goto('/asrar-chat');
  await expect(buyer.getByText('Bienvenue sur Asrar-chat')).toHaveCount(0);
  await expect(buyer.getByRole('button', { name: 'Discussions', exact: true })).toBeVisible();
  await buyer.getByRole('button', { name: 'Explorer', exact: true }).click();
  await buyer.getByRole('button', { name: /Chaîne E2E/ }).click();
  const channel = buyer.getByRole('dialog', { name: 'Chaîne E2E' });
  await expect(channel.getByRole('button', { name: /Formation Python, verrouillé/ })).toBeVisible();
  await expect(channel.getByText(SECRET)).toHaveCount(0);
  await shot(buyer, 'asrar-chat-1-chaine-verrouillee');

  await channel.getByRole('button', { name: /Déverrouiller pour 2\s000 FCFA/ }).click();
  const sheet = buyer.getByRole('dialog', { name: 'Article' });
  await expect(sheet.getByText('Sommaire : variables, boucles, fonctions.')).toBeVisible();
  await expect(sheet.getByText(SECRET)).toHaveCount(0);
  // Lien Wave Business renseigné : le bouton ouvre Wave directement.
  const popup = buyer.waitForEvent('popup');
  await sheet.getByRole('button', { name: /Payer 2\s000 FCFA avec Wave/ }).click();
  await (await popup).close();
  const wave = sheet.getByRole('link', { name: /Payer 2\s000 FCFA avec Wave/ });
  await expect(wave).toHaveAttribute('href', 'https://pay.wave.com/m/M_sn_E2E123/c/sn/?amount=2000');
  await shot(buyer, 'asrar-chat-2-paiement');
  await sheet.getByRole('button', { name: 'J’ai payé' }).click();
  await buyer.getByLabel('Référence de la transaction').fill('TX-E2E-0001');
  await buyer.getByRole('button', { name: 'Envoyer au vendeur' }).click();
  await expect(sheet.getByText('Paiement à vérifier')).toBeVisible();
  await expect(sheet.getByText(SECRET)).toHaveCount(0);

  // ── Vendeur : vérifie la réception puis confirme ──
  await seller.goto('/asrar-chat');
  await seller.getByRole('button', { name: 'Profil', exact: true }).click();
  await seller.getByRole('button', { name: /Ventes et revenus/ }).click();
  await seller.getByRole('button', { name: /Formation Python.*Paiement à vérifier/ }).click();
  await expect(seller.getByText('TX-E2E-0001')).toBeVisible();
  await seller.getByRole('button', { name: 'Paiement reçu' }).click();
  await seller.getByRole('checkbox').check();
  await shot(seller, 'asrar-chat-3-confirmation-vendeur');
  await seller.getByRole('button', { name: 'Valider' }).click();
  await expect(seller.getByText('Payée').first()).toBeVisible();

  // ── Acheteur : contenu déverrouillé dans la bibliothèque ──
  await buyer.goto('/asrar-chat');
  await buyer.getByRole('button', { name: 'Achats', exact: true }).click();
  await buyer.getByRole('button', { name: /Formation Python/ }).click();
  await expect(buyer.getByText('Contenu déverrouillé')).toBeVisible();
  await expect(buyer.getByText(SECRET)).toBeVisible();
  await shot(buyer, 'asrar-chat-4-contenu-deverrouille');

  // Notifications enregistrées (vendeur puis acheteur).
  const jobs = JSON.stringify((await app().database().ref('notification_jobs').once('value')).val() || {});
  expect(jobs).toContain('Paiement à vérifier');
  expect(jobs).toContain('Contenu déverrouillé');
});

test('discussion privée entre deux comptes', async ({ browser, login }) => {
  test.setTimeout(60_000);
  const a = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await login('basic', a);
  await a.goto('/asrar-chat');
  await a.getByRole('button', { name: 'Nouvelle discussion' }).click();
  await a.getByRole('button', { name: 'Discussion privée' }).click();
  await a.getByLabel('Pseudonyme').fill('seller');
  await a.getByRole('button', { name: /@seller/ }).click();
  const dm = a.getByRole('dialog', { name: 'seller' });
  await dm.getByLabel('Message', { exact: true }).fill('Bonjour, avez-vous d’autres formations ?');
  await dm.getByRole('button', { name: 'Envoyer' }).click();
  // Menu d'un message : petit dialogue centré, pas une page entière.
  await dm.getByRole('button', { name: 'Actions sur le message' }).last().click();
  const menu = a.getByRole('dialog', { name: 'Message' });
  const box = (await menu.locator('.ac-sheet').boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(340);
  expect(box.height).toBeLessThan(844 * 0.75);
  await a.screenshot({ path: test.info().outputPath('asrar-chat-6-menu-message.png') });
  await menu.getByRole('button', { name: 'Fermer' }).click();
  await expect(dm.locator('.ac-text', { hasText: 'Bonjour, avez-vous d’autres formations ?' })).toBeVisible();
  await expect(dm.getByLabel('Message', { exact: true })).toHaveValue('');
  await a.screenshot({ path: test.info().outputPath('asrar-chat-5-discussion.png') });
});

test('vendeur sans lien Wave Business : paiement Wave via WhatsApp, PI-SPI avec alias', async ({ browser, login }) => {
  test.setTimeout(60_000);
  const db = app().database();
  const now = Date.now();
  await db.ref('ac_profiles/fixture-seller/seller').set({ enabled: true, wavePhone: '221781234567', pispiAlias: 'vendeur@pispi', waveLink: '', whatsapp: '', termsAt: now });
  await db.ref().update({
    'ac_posts/e2e-doc': { sellerUid: 'fixture-seller', kind: 'text', title: 'Compilation de protections', description: 'Recueil complet', category: 'livres',
      price: 30000, accessDays: 0, conditions: 'Usage personnel', previewText: 'Sommaire du recueil', previewImage: '', media: { count: 0, kinds: {} },
      status: 'published', createdAt: now, updatedAt: now, titleLower: 'compilation de protections' },
    'ac_post_content/e2e-doc': { contentText: 'Texte réservé aux acheteurs', assets: [] },
  });
  const buyer = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await login('basic', buyer);
  await buyer.goto('/asrar-chat?p=e2e-doc');
  const sheet = buyer.getByRole('dialog', { name: 'Article' });
  await expect(sheet.getByText('Texte réservé aux acheteurs')).toHaveCount(0);
  const popup = buyer.waitForEvent('popup');
  await sheet.getByRole('button', { name: 'Payer par Wave via WhatsApp' }).click();
  await (await popup).close();
  const wa = sheet.getByRole('link', { name: 'Payer par Wave via WhatsApp' });
  const href = new URL((await wa.getAttribute('href'))!);
  expect(href.searchParams.get('phone')).toBe('221781234567');
  expect(href.searchParams.get('text')).toMatch(/payer par Wave.*AC-/);
  await expect(sheet.getByText('+221781234567')).toHaveCount(0); // pas de numéro à recopier
  await buyer.screenshot({ path: test.info().outputPath('asrar-chat-7-wave-via-whatsapp.png') });
});
