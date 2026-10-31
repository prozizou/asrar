import { test, expect } from './fixtures';

test.describe('Droits vérifiés avec Auth et RTDB réels en émulation', () => {
  // App gratuite (lib/plans.js FREE_FOR_ALL) : accès total pour tous ;
  // adFree porte le VRAI statut d'abonnement (un abonnement valide retire
  // les publicités).
  for (const [role, adFree] of [['free', false], ['basic', true], ['premium', true], ['expired', false]] as const) {
    test(`${role} reçoit son vrai statut`, async ({ postAs }) => {
      const response = await postAs(role, 'check-access');
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({ allowed: true, level: 999999, adFree });
    });
  }
  test('le catalogue ne livre pas le contenu ; le détail est ouvert à tout compte (app gratuite)', async ({ postAs }) => {
    const list = await postAs('free', 'list-content', { kind: 'secret', cat: 'protection' });
    expect(list.status()).toBe(200);
    expect((await list.json()).items[0].sirr).toBeUndefined();
    for (const role of ['free', 'basic']) {
      const detail = await postAs(role, 'get-content', { kind: 'secret', cat: 'protection', key: 'secret1' });
      expect((await detail.json()).item.sirr).toBe('Contenu réservé aux abonnés');
    }
  });
  test('le thème premium est ouvert à tout compte (app gratuite)', async ({ postAs }) => {
    expect((await postAs('basic', 'get-theme')).status()).toBe(200);
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
  test('la visioconférence retirée ne consomme aucun crédit', async ({ postAs }) => {
    expect((await postAs('basic', 'list-content', { kind: 'formation' })).status()).toBe(410);
    for (const role of ['premium', 'basic']) {
      const response = await postAs(role, 'formation-access', { action: 'join', key: 'formation1' });
      expect(response.status()).toBe(410);
      expect((await response.json()).code).toBe('FEATURE_RETIRED');
    }
    const { app } = require('../../server/grant');
    expect((await app().database().ref('formation_access/formation1/basic@asrar,test/minutes').once('value')).val()).toBe(10);
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
