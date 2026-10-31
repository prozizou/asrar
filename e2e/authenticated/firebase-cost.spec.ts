import { test, expect } from './fixtures';
const { app } = require('../../server/grant');

test('le badge indexé conserve les notifications anciennes non lues sans renvoyer l’historique', async ({ postAs }) => {
  await app().database().ref('notifications/fixture-seller').set({
    legacy: { title: 'Ancienne', createdAt: 1 },
    read: { title: 'Lue', read: true, createdAt: 2 },
    unread: { title: 'Nouvelle', read: false, createdAt: 3 },
  });
  const badge = await postAs('seller', 'notifications', { action: 'badge' });
  expect(badge.status()).toBe(200);
  expect(await badge.json()).toEqual({ unread: 2 });
  expect((await (await postAs('seller', 'notifications', { action: 'list' })).json()).unread).toBe(2);
});

test('la discussion incrémentale ne renvoie que les nouveaux messages et revérifie l’adhésion', async ({ postAs }) => {
  const db = app().database();
  await db.ref('zikr_members/cost-chat').set({ 'fixture-free': { joinedAt: 1 }, 'fixture-premium': { joinedAt: 1 } });
  await db.ref('zikr_chat/cost-chat').set(Object.fromEntries(Array.from({ length: 200 }, (_, i) =>
    ['m' + String(i).padStart(3, '0'), { uid: 'fixture-free', text: 'Message ' + i, at: i }])));
  expect((await (await postAs('free', 'zikr', { action: 'messages', groupId: 'cost-chat' })).json()).messages).toHaveLength(200);
  expect(await (await postAs('free', 'zikr', { action: 'messages', groupId: 'cost-chat', after: 'm199' })).json())
    .toEqual({ messages: [], incremental: true });
  await db.ref('zikr_chat/cost-chat/m200').set({ uid: 'fixture-free', text: 'Nouveau message', at: 200 });
  const delta = await (await postAs('premium', 'zikr', { action: 'messages', groupId: 'cost-chat', after: 'm199' })).json();
  expect(delta.messages.map((m: any) => m.text)).toEqual(['Nouveau message']);
  await db.ref('zikr_members/cost-chat/fixture-premium').remove();
  expect((await postAs('premium', 'zikr', { action: 'messages', groupId: 'cost-chat', after: 'm200' })).status()).toBe(403);
});

test('le catalogue est invalidé après édition et le cache ne contourne pas l’identité', async ({ postAs }) => {
  await postAs('admin', 'admin', { action: 'save-book', key: 'cost-book', titre: 'Ancien titre', pdf: 'https://example.invalid/private.pdf' });
  const first = await (await postAs('free', 'list-content', { kind: 'book' })).json();
  expect(first.items.find((item: any) => item._key === 'cost-book').titre).toBe('Ancien titre');
  await postAs('admin', 'admin', { action: 'save-book', key: 'cost-book', titre: 'Nouveau titre', pdf: 'https://example.invalid/private.pdf' });
  const second = await (await postAs('free', 'list-content', { kind: 'book' })).json();
  expect(second.items.find((item: any) => item._key === 'cost-book').titre).toBe('Nouveau titre');
  expect(second.items.find((item: any) => item._key === 'cost-book').pdf).toBeUndefined();
  expect((await postAs('unverified', 'list-content', { kind: 'book' })).status()).toBe(403);
  // App gratuite (FREE_FOR_ALL) : le détail est ouvert à tout compte vérifié.
  expect((await postAs('free', 'get-content', { kind: 'book', key: 'cost-book' })).status()).toBe(200);
});

test('le centre de notifications cesse de sonder quand la page est masquée', async ({ page, login }) => {
  await login('free');
  await page.clock.install();
  let reads = 0;
  page.on('request', (request) => { if (request.url().endsWith('/api/notifications') && request.postDataJSON()?.action === 'list') reads++; });
  await page.goto('/notifications');
  await expect(page.getByText('Notification personnelle', { exact: true })).toBeVisible();
  expect(reads).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(90000);
  expect(reads).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => reads).toBe(2);
});
