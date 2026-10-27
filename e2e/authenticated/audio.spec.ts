import { test, expect } from './fixtures';

async function openDiscussion(page: any, login: any, postAs: any) {
  const response = await postAs('free', 'zikr', { action: 'create', name: 'Recette vocaux', presetId: 'soubhanallah', target: 100 });
  expect(response.status()).toBe(200);
  const { id } = await response.json();
  await login('free'); await page.goto('/zikr?item=' + id);
  await page.getByRole('button', { name: 'Discussion', exact: true }).click();
}

test('un canal audio non configuré ne demande pas la permission du micro', async ({ page, login, postAs }) => {
  await openDiscussion(page, login, postAs);
  await page.evaluate(() => {
    (window as any).microphoneRequested = false;
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
      (window as any).microphoneRequested = true; throw new Error('Le micro ne doit pas être demandé');
    } });
  });
  await page.getByRole('button', { name: 'Enregistrer un vocal' }).click();
  await expect(page.locator('.zk-chat-panel').getByRole('alert')).toContainText('L’envoi de vocaux n’est pas activé');
  expect(await page.evaluate(() => (window as any).microphoneRequested)).toBe(false);
  await expect(page.getByPlaceholder('Écrire un message…')).toBeEnabled();
});

test('un vocal dont l’envoi échoue peut être sauvegardé avant de quitter la page', async ({ page, login, postAs }) => {
  await openDiscussion(page, login, postAs);
  await page.route('**/api/cloudinary-sign', async (route) => {
    const body = route.request().postDataJSON();
    await route.fulfill(body.action === 'check'
      ? { status: 200, json: { available: true } }
      : { status: 503, json: { error: 'Configuration retirée', code: 'UPLOAD_NOT_CONFIGURED' } });
  });
  await page.evaluate(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => ({ getTracks: () => [{ stop() {} }] }) });
    (window as any).MediaRecorder = class {
      state = 'inactive'; mimeType = 'audio/webm'; ondataavailable: any; onstop: any;
      start() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['vocal de recette'], { type: this.mimeType }) }); this.onstop?.(); }
    };
  });
  await page.getByRole('button', { name: 'Enregistrer un vocal' }).click();
  const send = page.getByRole('button', { name: 'Envoyer le vocal', exact: true });
  await expect(send).toBeVisible();
  await page.waitForTimeout(1100);
  await send.click();
  await expect(page.locator('.zk-chat-panel').getByRole('alert')).toContainText('L’envoi de vocaux n’est pas activé');
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Enregistrer mon vocal' }).click();
  expect((await download).suggestedFilename()).toBe('asrar-vocal.webm');
  await page.getByRole('button', { name: 'Supprimer le vocal non envoyé' }).click();
  await expect(page.getByRole('link', { name: 'Enregistrer mon vocal' })).toHaveCount(0);
});
