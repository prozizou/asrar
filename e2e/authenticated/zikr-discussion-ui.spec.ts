import { test, expect } from './fixtures';
const { app } = require('../../server/grant');

// Discussion v3 (maquette 2026-11) : en-tête compact avec recherche, bulles
// groupées par auteur, pied de bulle (réactions + heure + statut), pas de
// « ⋮ » permanent sur mobile, « + » / micro / Envoyer, recherche, partage.
const GID = 'discussion-ui';
const day = 86400000;
async function seed() {
  const db = app().database(); const now = Date.now();
  await db.ref('zikr_groups/' + GID).set({ name: 'Pour se rapprocher d’Allah', arabic: 'لا إله إلا الله', transliteration: 'Lâ ilâha illa Allâh', presetId: 'libre', target: 100000, total: 500,
    membersCount: 3, ownerUid: 'fixture-free', ownerEmail: 'free@asrar.test', approved: true });
  await db.ref('zikr_members/' + GID).set({
    'fixture-free': { name: 'Zizou Pro', email: 'free@asrar.test', fait: 100 },
    'fixture-premium': { name: 'Amadou Sow', email: 'premium@asrar.test', fait: 300 },
    'fixture-basic': { name: 'Princee Bello', email: 'basic@asrar.test', fait: 100 },
  });
  const m = (i: number) => '-Nui' + String(i).padStart(14, '0');
  await db.ref('zikr_chat/' + GID).set({
    [m(1)]: { uid: 'fixture-basic', name: 'Princee Bello', email: 'basic@asrar.test', text: 'Vérité absolue', at: now - 5 * day, reactions: { 'fixture-free': '👍' } },
    [m(2)]: { uid: 'fixture-free', name: 'Zizou Pro', email: 'free@asrar.test', text: 'Bonsoir chers maîtres', at: now - 3 * day },
    [m(3)]: { uid: 'fixture-free', name: 'Zizou Pro', email: 'free@asrar.test', text: 'On est presque arrivé', at: now - 3 * day + 1000 },
    [m(4)]: { uid: 'fixture-free', name: 'Zizou Pro', email: 'free@asrar.test', text: '', deleted: true, at: now - 3 * day + 2000 },
    [m(5)]: { uid: 'fixture-free', name: 'Zizou Pro', email: 'free@asrar.test', text: 'Donc poussons un peu pour atteindre le but', at: now - 3 * day + 60000 },
    [m(6)]: { uid: 'fixture-premium', name: 'Amadou Sow', email: 'premium@asrar.test', text: 'On y va marathon', at: now - 3 * day + 120000, reactions: { 'fixture-free': '❤️' } },
    [m(7)]: { uid: 'fixture-free', name: 'Zizou Pro', email: 'free@asrar.test', text: '', at: now - 3 * day + 180000, mediaType: 'audio', mediaUrl: 'https://res.cloudinary.com/fixture/video/upload/vocal.webm', mediaDuration: 43, mediaWaveform: Array.from({ length: 40 }, (_, i) => 20 + ((i * 37) % 70)), reactions: { 'fixture-premium': '❤️', 'fixture-basic': '❤️' } },
    [m(8)]: { uid: 'fixture-premium', name: 'Amadou Sow', email: 'premium@asrar.test', text: 'Inchallah si on me détrône seulement l’objectif sera atteint', at: now - 3 * day + 240000, reactions: { 'fixture-free': '👍' } },
    [m(9)]: { uid: 'fixture-basic', name: 'Princee Bello', email: 'basic@asrar.test', text: 'Qu’Allah facilite', at: now - 60000 },
    [m(10)]: { uid: 'fixture-free', name: 'Zizou Pro', email: 'free@asrar.test', text: 'Amine', at: now - 30000, replyTo: m(9) },
  });
  return { m };
}

test('discussion : maquette, groupement, recherche, pas de ⋮ permanent sur mobile', async ({ browser, login }) => {
  test.setTimeout(90_000);
  const { m } = await seed();
  // Téléphone tactile : la mise en page « mobile » et l'absence de survol.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await login('free', page);
  await page.goto('/zikr?item=' + GID);
  await page.getByRole('button', { name: 'Discussion', exact: true }).click();
  const panel = page.locator('.zk-messenger');
  await expect(panel.getByText('Amine', { exact: true })).toBeVisible();
  // En-tête : titre, participants, présence, loupe.
  await expect(page.locator('#zk-chat-presence')).toContainText('3 participants');
  // Une seule fois le nom et l'avatar pour une série du même auteur.
  await expect(page.locator('#zk-message-' + m(2) + ' .zk-chat-author')).toHaveCount(0); // mes messages : pas de nom
  await expect(page.locator('#zk-message-' + m(1) + ' .zk-chat-author')).toHaveText('Princee Bello');
  await expect(page.locator('#zk-message-' + m(3))).toHaveClass(/zk-message-continuation/);
  // Pas de « ⋮ » visible sur mobile.
  await expect(page.locator('#zk-message-' + m(5) + ' .zk-message-menu')).toBeHidden();
  // Statut et réactions dans le pied de bulle.
  await expect(page.locator('#zk-message-' + m(7) + ' .zk-msg-foot')).toContainText('❤️');
  await expect(page.locator('#zk-message-' + m(10) + ' .zk-reply-preview')).toContainText('Princee Bello');
  // Bulle ≤ 85 % de la largeur de la liste.
  const list = (await page.locator('.zk-chat-list').boundingBox())!;
  const bubble = (await page.locator('#zk-message-' + m(8) + ' .zk-chat-msg').boundingBox())!;
  expect(bubble.width).toBeLessThanOrEqual(list.width * 0.86);
  // Micro remplacé par Envoyer à la saisie.
  await expect(page.getByRole('button', { name: 'Enregistrer un vocal' })).toBeVisible();
  await page.getByLabel('Écrire un message').fill('Salam');
  await expect(page.getByRole('button', { name: 'Envoyer', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enregistrer un vocal' })).toBeHidden();
  await page.getByLabel('Écrire un message').fill('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('discussion-390.png') });

  // Recherche dans la discussion.
  await page.getByRole('button', { name: 'Rechercher dans la discussion' }).click();
  await page.getByRole('searchbox', { name: 'Rechercher dans la discussion' }).fill('objectif');
  await expect(page.locator('.zk-chat-search-count')).toHaveText('1/1');
  await expect(page.locator('.zk-search-current')).toContainText('détrône');
  await page.screenshot({ path: test.info().outputPath('discussion-recherche.png') });
  await page.getByRole('button', { name: 'Fermer la recherche' }).click();
  await expect(page.locator('.zk-chat-search')).toHaveCount(0);

  // Appui long : actions (dont Partager).
  const target = page.locator('#zk-message-' + m(6) + ' .zk-chat-text');
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 8); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
  const actions = page.getByRole('dialog', { name: 'Actions du message' });
  await expect(actions).toBeVisible();
  await expect(actions.getByRole('button', { name: 'Partager' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('discussion-actions.png') });
});
