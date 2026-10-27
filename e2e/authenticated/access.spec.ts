import { test, expect } from './fixtures';

test.describe('Droits vérifiés avec Auth et RTDB réels en émulation', () => {
  for (const [role, allowed, level] of [['free', false, 0], ['basic', true, 15000], ['premium', true, 45000], ['expired', false, 0]] as const) {
    test(`${role} reçoit son vrai statut`, async ({ postAs }) => {
      const response = await postAs(role, 'check-access');
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({ allowed, level });
    });
  }
  test('le compte gratuit peut lire le catalogue, pas le contenu payant', async ({ postAs }) => {
    const list = await postAs('free', 'list-content', { kind: 'secret', cat: 'protection' });
    expect(list.status()).toBe(200);
    expect((await list.json()).items[0].sirr).toBeUndefined();
    expect((await postAs('free', 'get-content', { kind: 'secret', cat: 'protection', key: 'secret1' })).status()).toBe(403);
    const detail = await postAs('basic', 'get-content', { kind: 'secret', cat: 'protection', key: 'secret1' });
    expect((await detail.json()).item.sirr).toBe('Contenu réservé aux abonnés');
  });
  test('le thème premium refuse un abonné de base', async ({ postAs }) => {
    expect((await postAs('basic', 'get-theme')).status()).toBe(403);
    expect((await postAs('premium', 'get-theme')).status()).toBe(200);
  });
  test('l’administration reste interdite au compte premium', async ({ postAs }) => {
    expect((await postAs('premium', 'admin', { action: 'list-books' })).status()).toBe(403);
    expect((await postAs('admin', 'admin', { action: 'list-books' })).status()).toBe(200);
  });
  test('la gestion boutique ne dépend pas d’un simple abonnement', async ({ postAs }) => {
    expect((await postAs('seller', 'shop', { action: 'me' })).status()).toBe(200);
    expect((await postAs('premium', 'shop', { action: 'save-shop', shop: { name: 'Interdit' } })).status()).toBe(403);
  });
  test('un e-mail non vérifié est rejeté par le serveur', async ({ postAs }) => {
    expect((await postAs('unverified', 'check-access')).status()).toBe(403);
  });
  test('un abonnement ne donne pas le lien de formation', async ({ postAs }) => {
    expect((await postAs('premium', 'get-content', { kind: 'formation', key: 'formation1' })).status()).toBe(400);
    expect((await postAs('premium', 'formation-access', { action: 'join', key: 'formation1' })).status()).toBe(403);
    const join = await postAs('basic', 'formation-access', { action: 'join', key: 'formation1' });
    expect(join.status()).toBe(200);
    expect((await join.json()).minutes).toBe(10);
    expect((await postAs('basic', 'formation-access', { action: 'join', key: 'formation1' })).status()).toBe(403);
  });
  test('les notifications sont isolées par compte', async ({ postAs }) => {
    const own = await postAs('free', 'notifications', { action: 'list' });
    const data = await own.json();
    expect(data.items.map((item: any) => item.title)).toContain('Notification personnelle');
    expect(data.items.map((item: any) => item.title)).not.toContain('Message premium privé');
    expect((await postAs('free', 'notifications', { action: 'markRead', notifId: 'private' })).status()).toBe(404);
  });
  test('le navigateur retrouve une session Firebase réelle et ses notifications', async ({ page, login }) => {
    await login('free');
    await page.goto('/notifications');
    await expect(page.getByText('Notification personnelle', { exact: true })).toBeVisible();
    await expect(page.getByText('Message premium privé', { exact: true })).toHaveCount(0);
  });
});
