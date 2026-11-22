import { test, expect } from './fixtures';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';

test('Al-Qalam : calcul de l’ornement sans bloquer la saisie, annulation et export PDF', async ({ page, login }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 900 });
  const session = await page.context().newCDPSession(page);
  await page.addInitScript(() => localStorage.setItem('asrar_support_prompt', JSON.stringify({ lastShownAt: Date.now(), snoozeUntil: Date.now() + 86400000 })));
  await login('premium');
  await page.goto('/alqalam');
  await page.getByRole('button', { name: /Écriture simple/ }).click();
  await page.getByLabel('Zone de saisie du texte arabe').fill('بسم الله الرحمن الرحيم');
  await page.getByRole('button', { name: 'Générer le texte', exact: true }).click();
  await page.getByRole('button', { name: 'Copier, partager ou exporter : onglet Fichier' }).click();
  // Téléphone ralenti : les calculs doivent laisser les interactions disponibles.
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => {
    const stats = { ticks: 0, maxGap: 0, workers: 0, terminated: 0 };
    (window as any).alqPerf = stats;
    let previous = performance.now();
    setInterval(() => { const now = performance.now(); stats.maxGap = Math.max(stats.maxGap, now - previous); stats.ticks++; previous = now; }, 40);
    const Original = window.Worker;
    (window as any).Worker = class extends Original {
      constructor(...args: any[]) { super(args[0], args[1]); stats.workers++; }
      terminate() { stats.terminated++; super.terminate(); }
    };
  });
  const tools = page.getByRole('tab', { name: 'Outils', exact: true });
  await tools.click();
  await expect(page.locator('.orne-svg-holder svg').first()).toBeVisible({ timeout: 45000 });
  const initial = await page.evaluate(() => (window as any).alqPerf);
  expect(initial.workers).toBeGreaterThan(0);
  expect(initial.ticks).toBeGreaterThan(2);
  expect(initial.maxGap).toBeLessThan(1000);
  // Les changements rapides annulent le calcul précédent ; seul le vœu final
  // doit être exporté. Une page calculée ne garde pas l'interface occupée.
  const vow = page.locator('#ornement-voeu');
  await vow.fill('اللهم ارزقني رزقا واسعا '.repeat(20));
  await expect.poll(() => page.evaluate(() => (window as any).alqPerf.workers)).toBeGreaterThan(initial.workers);
  await vow.fill('يا رزاق');
  await expect.poll(() => page.evaluate(() => (window as any).alqPerf.terminated)).toBeGreaterThan(0);
  await expect(page.locator('.orne-svg-holder svg').first()).toBeVisible({ timeout: 45000 });
  const final = await page.evaluate(() => (window as any).alqPerf);
  expect(final.maxGap).toBeLessThan(1000);
  await test.info().attach('fluidite-android-simule.json', { body: JSON.stringify({ cpuRate: 4, ...final }), contentType: 'application/json' });
  await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  // Un résultat court vérifie l'export asynchrone avec ouverture/fermeture.
  await page.getByRole('tab', { name: 'Fichier', exact: true }).click();
  await page.getByLabel('Zone de saisie du texte arabe').fill('بسم الله');
  await page.locator('#alq-repetitions').fill('1');
  await page.getByRole('button', { name: 'Générer le texte', exact: true }).click();
  await tools.click();
  await expect(page.locator('.orne-svg-holder svg').first()).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Télécharger le PDF', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const download = page.waitForEvent('download', { timeout: 45000 });
  await dialog.getByRole('button', { name: 'Avec ouverture et fermeture', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
});

test('Al-Qalam : les grandes répétitions simples ne préparent pas l’ornement en arrière-plan', async ({ page, login }) => {
  await page.addInitScript(() => localStorage.setItem('asrar_support_prompt', JSON.stringify({ lastShownAt: Date.now(), snoozeUntil: Date.now() + 86400000 })));
  await login('premium'); await page.goto('/alqalam');
  await page.getByRole('button', { name: /Écriture simple/ }).click();
  await page.getByLabel('Zone de saisie du texte arabe').fill('الله '.repeat(250));
  // La limite de l’aperçu ne réduit pas le document composé.
  const count = page.locator('#alq-repetitions');
  await count.fill('30000');
  await page.getByRole('button', { name: 'Générer le texte', exact: true }).click();
  await expect(page.locator('.output-area').first()).toBeVisible();
  await page.getByRole('button', { name: 'Copier, partager ou exporter : onglet Fichier' }).click();
  await page.getByRole('tab', { name: 'Outils', exact: true }).click();
  await expect(page.getByText(/trop volumineux pour l’ornement sur téléphone/)).toBeVisible();
  await expect(page.locator('.orne-stage')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Fichier', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Word', exact: true })).toBeEnabled();
});


test('Al-Qalam : Word complet et PDF classique sans traiter la boîte native comme un gel', async ({ page, login }) => {
  test.setTimeout(60000);
  await page.addInitScript(() => {
    localStorage.setItem('asrar_support_prompt', JSON.stringify({ lastShownAt: Date.now(), snoozeUntil: Date.now() + 86400000 }));
    window.print = () => {
      (window as any).printedText = document.getElementById('alqalam-print-root')?.textContent;
      // Simule l’attente synchrone d’une boîte native. La préparation reste
      // surveillée ; cette attente volontaire n’est pas un gel de l’application.
      const until = performance.now() + 1200;
      while (performance.now() < until) { /* boîte d’impression de test */ }
      setTimeout(() => window.dispatchEvent(new Event('afterprint')), 0);
    };
  });
  await login('premium'); await page.goto('/alqalam');
  await page.getByRole('button', { name: /Écriture simple/ }).click();
  await page.getByLabel('Zone de saisie du texte arabe').fill('الله');
  await page.locator('#alq-repetitions').fill('120');
  await page.getByRole('button', { name: 'Générer le texte', exact: true }).click();
  await page.getByRole('button', { name: 'Copier, partager ou exporter : onglet Fichier' }).click();
  await page.getByRole('button', { name: 'Word', exact: true }).click();
  const wordDownload = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: 'Sans ouverture ni fermeture', exact: true }).click();
  const word = await wordDownload;
  expect(word.suggestedFilename()).toMatch(/\.docx$/);
  const file = await JSZip.loadAsync(await readFile((await word.path())!));
  const xml = await file.file('word/document.xml')!.async('string');
  expect(xml.split('الله').length - 1).toBe(120);
  await page.getByRole('button', { name: 'PDF', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sans ouverture ni fermeture', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).printedText)).toBe(Array(120).fill('الله').join(' '));
  await expect(page.locator('#alqalam-print-root')).toHaveCount(0);
});
