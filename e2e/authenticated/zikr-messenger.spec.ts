import { test, expect, tokenAs } from './fixtures';
const { app } = require('../../server/grant');
const mid = (index: number) => '-Nfixture' + String(index).padStart(11, '0');

async function seed(id: string, count = 3) {
  const db = app().database(); const now = Date.now();
  for (const group of [id, id + '-target']) {
    await db.ref('zikr_groups/' + group).set({ name: group.endsWith('-target') ? 'Destination de test' : 'Discussion moderne', arabic: 'سبحان الله', transliteration: 'Soubhanallah', presetId: 'soubhanallah', target: 1000, total: 0, membersCount: 2, ownerUid: 'fixture-free', ownerEmail: 'free@asrar.test', approved: true });
    await db.ref('zikr_members/' + group).set({ 'fixture-free': { name: 'Moi', email: 'free@asrar.test', fait: 0 }, ...(group === id ? { 'fixture-premium': { name: 'Participant', email: 'premium@asrar.test', fait: 0 } } : {}) });
  }
  await db.ref('zikr_chat/' + id).set(Object.fromEntries(Array.from({ length: count }, (_, index) => [mid(index), { uid: index === count - 2 ? 'fixture-free' : 'fixture-premium', name: index === count - 2 ? 'Moi' : 'Participant', text: 'Message ' + index, at: now - (count - index) * 1000 }])));
}
async function open(page: any, login: any, id: string) {
  await page.setViewportSize({ width: 390, height: 850 }); await login('free'); await page.goto('/zikr?item=' + id);
  await page.getByRole('button', { name: 'Discussion', exact: true }).click();
  await expect(page.locator('.zk-messenger')).toBeVisible();
}

test('historique, défilement intelligent, lectures visibles et autorisation du signal temps réel', async ({ page, login, postAs, request }) => {
  const gid = 'messenger-scroll'; await seed(gid, 75); await open(page, login, gid);
  const db = app().database();
  await expect(page.locator('#zk-message-' + mid(74))).toBeVisible();
  const header = await page.locator('.zk-detail-topbar').boundingBox(); expect(header!.height).toBeGreaterThanOrEqual(56); expect(header!.height).toBeLessThanOrEqual(64);
  await expect(page.getByRole('button', { name: /Afficher l’invocation/ })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.zk-detail-head')).toBeHidden();
  await page.getByRole('button', { name: /Afficher l’invocation/ }).click();
  await expect(page.locator('.zk-phrase-big')).toBeVisible();
  await page.getByRole('button', { name: /Masquer l’invocation/ }).click();
  await expect(page.locator('.zk-detail-head')).toBeHidden();
  await expect.poll(async () => (await db.ref(`zikr_chat_reads/${gid}/${mid(74)}/fixture-free`).once('value')).exists()).toBe(true);
  expect((await db.ref(`zikr_chat_reads/${gid}/${mid(25)}/fixture-free`).once('value')).exists()).toBe(false);
  const ownInfo = await postAs('premium', 'zikr', { action: 'messageReaders', groupId: gid, messageId: mid(74) });
  expect((await ownInfo.json()).readers.some((reader: any) => reader.uid === 'fixture-free')).toBe(true);
  await page.locator('.zk-chat-list').evaluate((node) => { node.scrollTop = 0; });
  await page.getByRole('button', { name: 'Charger les messages précédents' }).click();
  await expect(page.locator('#zk-message-' + mid(0))).toHaveCount(1);
  expect(await page.locator('.zk-chat-list').evaluate((node) => node.scrollTop)).toBeGreaterThan(100);
  await page.locator('.zk-chat-list').evaluate((node) => { node.scrollTop = 0; });
  await postAs('premium', 'zikr', { action: 'sendMessage', groupId: gid, text: 'Arrivée temps réel' });
  await expect(page.getByText('Arrivée temps réel', { exact: true })).toHaveCount(1);
  expect(await page.locator('.zk-chat-list').evaluate((node) => node.scrollTop)).toBeLessThan(80);
  await expect(page.getByRole('button', { name: /nouveau message/ })).toBeVisible();
  await page.getByRole('button', { name: /nouveau message/ }).click();
  await page.getByRole('button', { name: 'Participants', exact: true }).click();
  const sent = await (await postAs('premium', 'zikr', { action: 'sendMessage', groupId: gid, text: 'Ne pas marquer lu dans Participants' })).json();
  await expect(page.locator('#zk-message-' + sent.id)).toHaveCount(1);
  expect((await db.ref(`zikr_chat_reads/${gid}/${sent.id}/fixture-free`).once('value')).exists()).toBe(false);
  await page.getByRole('button', { name: 'Discussion', exact: true }).click();
  await expect.poll(async () => (await db.ref(`zikr_chat_reads/${gid}/${sent.id}/fixture-free`).once('value')).exists()).toBe(true);
  const premiumToken = await tokenAs(request, 'premium');
  const memberToken = await tokenAs(request, 'free'), outsider = await tokenAs(request, 'basic'), unverified = await tokenAs(request, 'unverified');
  const url = `http://127.0.0.1:9000/zikr_chat_signals/${gid}.json?ns=demo-asrar-test-default-rtdb`;
  expect((await request.get(url + '&auth=' + memberToken)).status()).toBe(200);
  expect((await request.get(url + '&auth=' + outsider)).status()).toBe(401);
  await db.ref('zikr_members/' + gid + '/fixture-unverified').set({ fait: 0 });
  expect((await request.get(url + '&auth=' + unverified)).status()).toBe(401);
  await db.ref('zikr_members/' + gid + '/fixture-basic').set({ fait: 0, removalId: 'retiré' });
  expect((await request.get(url + '&auth=' + outsider)).status()).toBe(401);
  expect((await request.put(url + '&auth=' + memberToken, { data: { at: 0 } })).status()).toBe(401);
  const countsUrl = `http://127.0.0.1:9000/zikr_chat_read_counts/${gid}/fixture-premium.json?ns=demo-asrar-test-default-rtdb`;
  expect((await request.get(countsUrl + '&auth=' + premiumToken)).status()).toBe(200);
  expect((await request.get(countsUrl + '&auth=' + memberToken)).status()).toBe(401);
  await postAs('premium', 'zikr', { action: 'readMessages', groupId: gid, messageIds: [mid(73)] });
  await expect(page.locator('#zk-message-' + mid(73)).getByRole('button', { name: 'Informations de lecture' })).toContainText('Vu par 1');
  await page.screenshot({ path: test.info().outputPath('messenger-dark.png') });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await page.screenshot({ path: test.info().outputPath('messenger-light.png') });
});

test('réponse, appui long, réaction, édition, transfert et suppression synchronisée', async ({ page, login, postAs }) => {
  const gid = 'messenger-actions'; await seed(gid); await open(page, login, gid);
  const source = page.locator('#zk-message-' + mid(0));
  const swipe = await source.locator('.zk-chat-text').boundingBox();
  await page.mouse.move(swipe!.x + 4, swipe!.y + 8); await page.mouse.down(); await page.mouse.move(swipe!.x + 76, swipe!.y + 8, { steps: 5 }); await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Annuler la réponse' })).toBeVisible();
  await page.getByRole('button', { name: 'Annuler la réponse' }).click();
  await source.getByRole('button', { name: /Actions du message/ }).click();
  await page.getByRole('dialog', { name: 'Actions du message' }).getByRole('button', { name: 'Répondre', exact: true }).click();
  await page.getByPlaceholder('Écrire un message…').fill('Ma réponse');
  await page.getByRole('button', { name: 'Envoyer', exact: true }).click();
  await expect(page.locator('.zk-chat-text').getByText('Ma réponse', { exact: true })).toBeVisible();
  const db = app().database();
  const response = Object.values((await db.ref('zikr_chat/' + gid).once('value')).val()).find((message: any) => message.text === 'Ma réponse') as any;
  expect(response.replyTo).toBe(mid(0));
  const box = await source.locator('.zk-chat-text').boundingBox();
  await page.mouse.move(box!.x + 8, box!.y + 8); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
  const actions = page.getByRole('dialog', { name: 'Actions du message' }); await expect(actions).toBeVisible();
  await actions.getByRole('button', { name: 'Réagir avec 👍', exact: true }).click();
  await expect(source.getByRole('button', { name: 'Réaction 👍 : 1' })).toBeVisible();
  const own = page.locator('#zk-message-' + mid(1));
  await own.getByRole('button', { name: /Actions du message/ }).click();
  await page.getByRole('button', { name: 'Modifier le texte', exact: true }).click();
  await page.getByLabel('Texte du message modifié').fill('Texte corrigé');
  await page.getByRole('dialog', { name: 'Modifier le message' }).getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(own.getByText('Texte corrigé', { exact: true })).toBeVisible();
  await source.getByRole('button', { name: /Actions du message/ }).click(); await page.getByRole('button', { name: 'Transférer', exact: true }).click();
  await page.getByLabel('Discussion de destination').selectOption(gid + '-target');
  await page.getByRole('dialog', { name: 'Transférer le message' }).getByRole('button', { name: 'Transférer', exact: true }).click();
  await expect.poll(async () => Object.values((await db.ref('zikr_chat/' + gid + '-target').once('value')).val() || {}).some((message: any) => message.text === 'Message 0' && message.forwarded)).toBe(true);
  expect((await postAs('free', 'zikr', { action: 'deleteMessage', groupId: gid, messageId: mid(0) })).status()).toBe(403);
  await postAs('premium', 'zikr', { action: 'deleteMessage', groupId: gid, messageId: mid(0) });
  await expect(source.getByText('Message supprimé', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Message supprimé', exact: true })).toBeVisible();
  await own.getByRole('button', { name: /Actions du message/ }).click(); await page.getByRole('button', { name: 'Supprimer pour le groupe', exact: true }).click();
  await page.getByRole('dialog', { name: 'Supprimer le message' }).getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(own.getByText('Message supprimé', { exact: true })).toBeVisible();
});

test('éditeur d’image local, aperçu zoomable et vitesse du vocal', async ({ page, login }) => {
  const gid = 'messenger-media'; await seed(gid); await open(page, login, gid);
  const data = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 320; const context = canvas.getContext('2d')!; context.fillStyle = '#7754ae'; context.fillRect(0, 0, 640, 320); context.fillStyle = '#fff'; context.fillRect(20, 20, 100, 100); return canvas.toDataURL('image/png').split(',')[1]; });
  const png = Buffer.from(data, 'base64');
  await page.route('**/api/cloudinary-sign', (route) => route.fulfill({ json: { cloudName: 'fixture', apiKey: 'fixture-only', timestamp: 1, signature: 'fixture-only', folder: 'zikr_chat/' + gid, uploadPreset: 'fixture-only' } }));
  await page.route('https://api.cloudinary.com/**', (route) => route.fulfill({ json: { secure_url: 'https://res.cloudinary.com/fixture/image/upload/test.jpg' } }));
  await page.route('https://res.cloudinary.com/fixture/image/upload/test.jpg', (route) => route.fulfill({ contentType: 'image/png', body: png }));
  await page.locator('.zk-messenger input[type=file]').first().setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
  const editor = page.getByRole('dialog', { name: 'Modifier l’image', exact: true }); await expect(editor).toBeVisible();
  await expect.poll(async () => editor.locator('canvas').getAttribute('width')).toBe('640');
  await editor.getByRole('button', { name: 'Pivoter ↻', exact: true }).click();
  await expect.poll(async () => editor.locator('canvas').getAttribute('width')).toBe('320');
  await editor.getByLabel('Légende', { exact: true }).fill('Ma photo');
  await editor.getByRole('button', { name: 'Envoyer l’image', exact: true }).click();
  await expect(page.getByText('Ma photo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Agrandir la photo', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'Photo agrandie', exact: true });
  await viewer.getByRole('slider').focus(); await viewer.getByRole('slider').press('Home'); for (let i = 0; i < 4; i++) await viewer.getByRole('slider').press('ArrowRight');
  expect(await viewer.locator('img').evaluate((image: HTMLImageElement) => image.style.width)).toBe('200%');
  await page.keyboard.press('Escape'); await expect(viewer).toHaveCount(0);
  const db = app().database();
  await db.ref('zikr_chat/' + gid + '/vocal').set({ uid: 'fixture-premium', name: 'Participant', text: '', at: Date.now(), mediaType: 'audio', mediaUrl: 'https://res.cloudinary.com/fixture/video/upload/vocal.wav', mediaDuration: 3, mediaWaveform: Array(40).fill(50) });
  await db.ref('zikr_chat_signals/' + gid).set({ at: Date.now(), nonce: 'vocal' });
  await expect(page.getByRole('button', { name: 'Vitesse du vocal : 1 fois' })).toBeVisible();
  await page.getByRole('button', { name: 'Vitesse du vocal : 1 fois' }).click();
  expect(await page.locator('.zk-audio-player audio').evaluate((audio: HTMLAudioElement) => audio.playbackRate)).toBe(1.5);
  await page.getByRole('button', { name: 'Vitesse du vocal : 1.5 fois' }).click();
  expect(await page.locator('.zk-audio-player audio').evaluate((audio: HTMLAudioElement) => audio.playbackRate)).toBe(2);
});

test('le vocal tenu peut être verrouillé, puis conservé sans envoi en quittant la discussion', async ({ page, login }) => {
  const gid = 'messenger-voice-lock'; await seed(gid); await open(page, login, gid);
  await page.route('**/api/cloudinary-sign', (route) => route.fulfill({ json: { available: true } }));
  await page.evaluate(() => {
    (window as any).tracksStopped = false;
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => ({ getTracks: () => [{ stop() { (window as any).tracksStopped = true; } }] }) });
    (window as any).MediaRecorder = class {
      state = 'inactive'; mimeType = 'audio/webm'; ondataavailable: any; onstop: any;
      start() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['vocal de test'], { type: this.mimeType }) }); this.onstop?.(); }
    };
  });
  const microphone = await page.getByRole('button', { name: 'Enregistrer un vocal' }).boundingBox();
  await page.mouse.move(microphone!.x + 20, microphone!.y + 20); await page.mouse.down();
  await expect(page.getByRole('button', { name: 'Envoyer le vocal' })).toBeVisible();
  await page.mouse.move(microphone!.x + 20, microphone!.y - 65); await page.mouse.up();
  await expect(page.getByText('Verrouillé', { exact: true })).toBeVisible();
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'Participants', exact: true }).click();
  await expect.poll(async () => page.evaluate(() => (window as any).tracksStopped)).toBe(true);
  await page.getByRole('button', { name: 'Discussion', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Enregistrer mon vocal', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Réessayer l’envoi du vocal', exact: true })).toBeVisible();
});

test('reste compact de 320 px au bureau et dégage la saisie avec le clavier', async ({ page, login, postAs }) => {
  const gid = 'messenger-responsive'; await seed(gid); await open(page, login, gid);
  expect((await postAs('premium', 'zikr', { action: 'editMessage', groupId: gid, messageId: mid(2), text: 'Une longue recette pour tester les retours à la ligne. '.repeat(8) })).status()).toBe(200);
  await expect(page.locator('#zk-message-' + mid(2))).toContainText('longue recette');
  for (const width of [320, 390, 768, 1200]) {
    await page.setViewportSize({ width, height: 850 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const list = await page.locator('.zk-chat-list').boundingBox();
    for (const bubble of await page.locator('.zk-chat-bubbles').all()) expect((await bubble.boundingBox())!.width).toBeLessThanOrEqual(list!.width * .8 + 2);
  }
  await page.setViewportSize({ width: 390, height: 850 });
  await page.getByPlaceholder('Écrire un message…').fill('Brouillon avec clavier');
  await page.setViewportSize({ width: 390, height: 520 });
  await expect(page.locator('html')).toHaveClass(/kb-open/);
  const field = await page.getByPlaceholder('Écrire un message…').boundingBox(); expect(field!.y + field!.height).toBeLessThanOrEqual(520);
  await expect(page.getByRole('navigation', { name: 'Navigation du zikr collectif' })).toBeHidden();
});

test('conserve le brouillon suivant lorsqu’un envoi est lent', async ({ page, login }) => {
  const gid = 'messenger-draft'; await seed(gid); await open(page, login, gid);
  await page.route('**/api/zikr', async (route) => {
    if (route.request().postDataJSON()?.action === 'sendMessage') await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  const field = page.getByPlaceholder('Écrire un message…');
  await field.fill('Premier message'); await page.getByRole('button', { name: 'Envoyer', exact: true }).click();
  await field.fill('Brouillon suivant à conserver');
  await expect(page.locator('.zk-chat-text').getByText('Premier message', { exact: true })).toBeVisible();
  await expect(field).toHaveValue('Brouillon suivant à conserver');
});
