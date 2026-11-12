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
  expect(url.hostname).toBe('api.whatsapp.com'); expect(url.pathname).toBe('/send'); expect(url.searchParams.get('phone')).toBe('15555550123');
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

test('le cron retire seulement le membre averti sans aucun grain, conserve les grains et accepte un second passage', async ({ request, postAs }) => {
  // Règle « retrait seulement à 0 grain » (0f14a4a) : à l'échéance des 7 jours,
  //  - fixture-premium n'a jamais récité → retiré ;
  //  - fixture-basic a 20 grains mais rien depuis l'avertissement → gardé, avertissement levé ;
  //  - fixture-seller a repris (1 grain depuis l'avertissement) → gardé.
  const db = app().database(), deadline = Date.now() - 10000;
  await db.ref('zikr_groups/warning-cron').set({ name: 'Retrait test', target: 1000, total: 99, membersCount: 4, ownerUid: 'fixture-admin' });
  await db.ref('zikr_members/warning-cron').set({
    'fixture-admin': { fait: 78 },
    'fixture-premium': { fait: 0, avertissement: 'Message', warning: { id: 'expiry-test', at: deadline - 7 * 86400000, deadline, fait: 0 } },
    'fixture-basic': { fait: 20, avertissement: 'Message', warning: { id: 'kept-test', at: deadline - 7 * 86400000, deadline, fait: 20 } },
    'fixture-seller': { fait: 1, warning: { id: 'resumed-test', at: deadline - 7 * 86400000, deadline, fait: 0 } },
  });
  for (const [id, uid] of [['expiry-test', 'fixture-premium'], ['kept-test', 'fixture-basic'], ['resumed-test', 'fixture-seller']]) {
    await db.ref('zikr_inactivity/' + id).set({ gid: 'warning-cron', uid, id, deadline });
  }
  expect((await request.get('/api/cron/reminders')).status()).toBe(401);
  for (let n = 0; n < 2; n++) {
    const response = await request.get('/api/cron/reminders', { headers: { authorization: 'Bearer emulator-cron-only' } });
    expect(response.status()).toBe(200);
    expect((await db.ref('zikr_groups/warning-cron').once('value')).val()).toMatchObject({ membersCount: 3, total: 99 });
  }
  expect((await db.ref('zikr_members/warning-cron/fixture-premium').once('value')).exists()).toBe(false);
  const kept = (await db.ref('zikr_members/warning-cron/fixture-basic').once('value')).val();
  expect(kept).toMatchObject({ fait: 20 });
  expect(kept.warning ?? null).toBeNull();
  expect(kept.avertissement ?? null).toBeNull();
  expect((await db.ref('zikr_members/warning-cron/fixture-seller').once('value')).val()).toMatchObject({ fait: 1 });
  for (const id of ['expiry-test', 'kept-test', 'resumed-test']) expect((await db.ref('zikr_inactivity/' + id).once('value')).exists()).toBe(false);
  expect((await app().auth().getUser('fixture-premium')).uid).toBe('fixture-premium');
  expect((await postAs('premium', 'zikr', { action: 'progress', groupId: 'warning-cron', fait: 1 })).status()).toBe(403);
});
