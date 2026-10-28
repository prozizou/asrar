import { test, expect } from './fixtures';
const { app } = require('../../server/grant');

test('le modérateur prépare un WhatsApp personnalisé, enregistre le badge privé et une récitation annule le délai', async ({ page, login, postAs }) => {
  const db = app().database();
  await db.ref('zikr_groups/warning-ui').set({ name: 'Zikr de test', arabic: 'لا إله إلا الله', transliteration: 'La ilaha illa Allah',
    presetId: 'libre', target: 1000, total: 100, membersCount: 2, ownerUid: 'fixture-free', ownerEmail: 'free@asrar.test', approved: true });
  await db.ref('zikr_members/warning-ui').set({
    'fixture-free': { name: 'Créateur', email: 'free@asrar.test', fait: 100 },
    'fixture-premium': { name: 'Participant test', email: 'premium@asrar.test', fait: 0, phone: '+15555550123', joinedAt: Date.now() },
  });
  expect((await postAs('premium', 'zikr', { action: 'warn', groupId: 'warning-ui', uid: 'fixture-free' })).status()).toBe(403);
  await page.setViewportSize({ width: 390, height: 850 });
  await login('admin'); await page.goto('/zikr?item=warning-ui');
  await page.getByRole('button', { name: 'Participants', exact: true }).click();
  await page.getByRole('button', { name: 'Préparer un message WhatsApp pour Participant test', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Message et avertissement', exact: true });
  await expect(dialog).toBeVisible();
  const message = dialog.getByLabel('Message personnalisé', { exact: true });
  const original = await message.inputValue();
  for (const expected of ['Participant test', 'Méthode', 'لا إله إلا الله', '100 / 1', '900', '7 jours']) expect(original).toContain(expected);
  await message.fill(original + '\nMessage personnel de l’administration.');
  await dialog.getByRole('button', { name: 'Enregistrer l’avertissement', exact: true }).click();
  const whatsapp = dialog.getByRole('link', { name: 'Ouvrir WhatsApp', exact: true });
  await expect(whatsapp).toBeVisible();
  const url = new URL((await whatsapp.getAttribute('href'))!);
  expect(url.hostname).toBe('wa.me'); expect(url.pathname).toBe('/15555550123');
  expect(url.searchParams.get('text')).toContain('Message personnel de l’administration.');
  // Aucun lien WhatsApp n’est suivi et aucun message externe n’est envoyé.
  await page.screenshot({ path: test.info().outputPath('zikr-warning-message.png') });
  await dialog.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(page.getByText('Averti', { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('zikr-warning-badge.png') });
  const stored = (await db.ref('zikr_members/warning-ui/fixture-premium').once('value')).val();
  expect(stored.warning.deadline - stored.warning.at).toBe(7 * 86400000);
  const memberView = await (await postAs('premium', 'zikr', { action: 'get', groupId: 'warning-ui' })).json();
  expect(memberView.members.every((member: any) => !('warning' in member) && !('phone' in member))).toBe(true);
  expect(memberView.myWarning).toContain('Message personnel');
  await postAs('premium', 'zikr', { action: 'dismissWarning', groupId: 'warning-ui' });
  expect((await db.ref('zikr_members/warning-ui/fixture-premium/warning').once('value')).exists()).toBe(true);
  await postAs('premium', 'zikr', { action: 'progress', groupId: 'warning-ui', fait: 1, rythme: 1 });
  await page.goto('/zikr?item=warning-ui'); await page.getByRole('button', { name: 'Participants', exact: true }).click();
  await expect(page.getByText('Averti', { exact: true })).toHaveCount(0);
  expect((await db.ref('zikr_members/warning-ui/fixture-premium/warning').once('value')).exists()).toBe(false);
});

test('le cron retire le membre averti expiré, conserve les grains et accepte un second passage', async ({ request, postAs }) => {
  const db = app().database(), deadline = Date.now() - 10000;
  await db.ref('zikr_groups/warning-cron').set({ name: 'Retrait test', target: 1000, total: 99, membersCount: 3, ownerUid: 'fixture-admin' });
  await db.ref('zikr_members/warning-cron').set({
    'fixture-admin': { fait: 78 },
    'fixture-premium': { fait: 20, warning: { id: 'expiry-test', at: deadline - 7 * 86400000, deadline, fait: 20 } },
    'fixture-basic': { fait: 1, warning: { id: 'resumed-test', at: deadline - 7 * 86400000, deadline, fait: 0 } },
  });
  await db.ref('zikr_inactivity/expiry-test').set({ gid: 'warning-cron', uid: 'fixture-premium', id: 'expiry-test', deadline });
  await db.ref('zikr_inactivity/resumed-test').set({ gid: 'warning-cron', uid: 'fixture-basic', id: 'resumed-test', deadline });
  expect((await request.get('/api/cron/reminders')).status()).toBe(401);
  for (let n = 0; n < 2; n++) {
    const response = await request.get('/api/cron/reminders', { headers: { authorization: 'Bearer emulator-cron-only' } });
    expect(response.status()).toBe(200);
    expect((await db.ref('zikr_groups/warning-cron').once('value')).val()).toMatchObject({ membersCount: 2, total: 99 });
  }
  expect((await db.ref('zikr_members/warning-cron/fixture-premium').once('value')).exists()).toBe(false);
  expect((await db.ref('zikr_members/warning-cron/fixture-basic').once('value')).exists()).toBe(true);
  expect((await app().auth().getUser('fixture-premium')).uid).toBe('fixture-premium');
  expect((await postAs('premium', 'zikr', { action: 'progress', groupId: 'warning-cron', fait: 21 })).status()).toBe(403);
});
