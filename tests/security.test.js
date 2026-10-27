import { describe, it, expect } from 'vitest';
import { database, runtime, invoke } from './support/runtime';

describe('API de contenu : frontières d’autorisation', () => {
  it.each(['/', 'p1/number', '.', '../p1', [], {}, 1, 'bad\u0000key'])('refuse une clé non documentaire : %j', async (key) => {
    const db = database({ det_produits: { p1: { produit: 'Fixture', number: '000', email: 'private@example.invalid', contact: { email: 'private@example.invalid' } } } });
    const handler = runtime(db)('pages/api/get-content.js').default;
    const result = await invoke(handler, { kind: 'product', key });
    expect(result.code).toBe(400);
    expect(result.body.item).toBeUndefined();
  });

  it('laisse consulter un produit valide sans exposer ses coordonnées', async () => {
    const db = database({ det_produits: { p1: { produit: 'Fixture', number: '000', email: 'private@example.invalid', contact: { email: 'private@example.invalid' } } } });
    const handler = runtime(db, { allowed: false })('pages/api/get-content.js').default;
    const result = await invoke(handler, { kind: 'product', key: 'p1' });
    expect(result.code).toBe(200);
    expect(result.body.item).toEqual({ _key: 'p1', produit: 'Fixture' });
    expect(result.headers['Cache-Control']).toContain('no-store');
  });

  it('refuse le lien de formation même à un abonné', async () => {
    const db = database({ formations: { f1: { titre: 'Fixture', meetLink: 'https://meet.google.com/fixture' } } });
    const handler = runtime(db)('pages/api/get-content.js').default;
    expect((await invoke(handler, { kind: 'formation', key: 'f1' })).code).toBe(400);
  });

  it.each(['__proto__', 'constructor', 'toString'])('refuse un type hérité : %s', async (kind) => {
    const handler = runtime(database())('pages/api/get-content.js').default;
    expect((await invoke(handler, { kind, key: 'p1' })).code).toBe(400);
  });

  it('ne consomme pas un passe publicitaire pour un document absent', async () => {
    let consumed = 0;
    const handler = runtime(database(), { allowed: false, stubs: {
      'server/adReward.js': { consumeAdPass: async () => { consumed++; return true; } },
    } })('pages/api/get-content.js').default;
    expect((await invoke(handler, { kind: 'book', key: 'missing' })).code).toBe(404);
    expect(consumed).toBe(0);
  });
});

describe('Web Push : destinations serveur', () => {
  const load = runtime(database());
  const { isValidPushEndpoint } = load('server/webPush.js');
  it.each([
    'https://fcm.googleapis.com/fcm/send/token',
    'https://updates.push.services.mozilla.com/wpush/v2/token',
    'https://web.push.apple.com/token',
  ])('accepte le fournisseur %s', (url) => expect(isValidPushEndpoint(url)).toBe(true));

  it.each([
    'https://127.0.0.1:8443/internal', 'https://[::1]/', 'http://fcm.googleapis.com/token',
    'https://fcm.googleapis.com.evil.invalid/', 'https://evil.invalid/fcm.googleapis.com',
    'https://user:password@fcm.googleapis.com/', 'https://fcm.googleapis.com:8443/',
    'https://fcm.googleapis.com/#fragment', 'https://169.254.169.254/',
  ])('refuse la destination %s', (url) => expect(isValidPushEndpoint(url)).toBe(false));

  it('refuse aussi un ancien abonnement dangereux au moment de l’envoi', async () => {
    let calls = 0;
    const { sendWebPush } = runtime(database(), { stubs: {
      'web-push': { sendNotification: async () => { calls++; } },
    } })('server/webPush.js');
    await expect(sendWebPush({ endpoint: 'https://127.0.0.1/' }, 'fixture')).rejects.toMatchObject({ statusCode: 410 });
    expect(calls).toBe(0);
  });
});

describe('Identité et propriété par e-mail', () => {
  function verifier(decoded) {
    return runtime(database(), { stubs: {
      'server/access.js': undefined,
      'server/grant.js': { app: () => ({ auth: () => ({ verifyIdToken: async () => decoded }) }) },
    } })('server/access.js').verifyUser;
  }
  it('refuse un e-mail non vérifié avant d’évaluer les droits', async () => {
    const verify = verifier({ uid: 'tester', email: 'fixture@example.invalid', email_verified: false });
    await expect(verify('fixture')).rejects.toMatchObject({ statusCode: 403 });
  });
  it('accepte l’identité vérifiée normale de Google', async () => {
    const verify = verifier({ uid: 'tester', email: 'fixture@example.invalid', email_verified: true });
    expect(await verify('fixture')).toMatchObject({ uid: 'tester', email: 'fixture@example.invalid' });
  });
});
