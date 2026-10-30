import { describe, it, expect, vi, afterEach } from 'vitest';
import { database, runtime, invoke } from './support/runtime';
const uid = 'tester', cat = 'protection', key = 'secret1', productId = 'secret_protection_001', token = 'token-for-secret-001';
function setup(seed = {}, userId = uid) {
  const db = database({ db_sirr_protection: { secret1: { faida: 'Titre', sirr: 'Contenu confidentiel', img: 'https://example.com/private.png' } },
    play_secret_products: { [productId]: { cat, key } }, secret_products: { [cat]: { [key]: { productId, enabled: true } } }, ...seed });
  const actualPlay = runtime(db)('server/playBilling.js');
  const play = { ...actualPlay, getPurchase: vi.fn(async () => ({ purchaseState: 0, acknowledgementState: 0, consumptionState: 0, obfuscatedExternalAccountId: actualPlay.accountId(userId), purchaseTimeMillis: '12345' })), acknowledge: vi.fn(async () => {}) };
  const user = { uid: userId, email: userId + '@example.invalid' };
  const load = runtime(db, { user, allowed: false, stubs: { 'server/playBilling.js': play, 'server/access.js': {
    verifyUser: async () => user, getAccessStatus: async () => ({ allowed: false, admin: false, vip: false }),
    hasActiveAccess: async () => false, isAdmin: async () => false, emailKey: (value) => value.replace(/\./g, ','),
  } } });
  return { db, play, user, service: load('server/secretPurchases.js'), load };
}
afterEach(() => vi.unstubAllEnvs());
describe('Achats individuels de secrets', () => {
  it('valide le reçu Google, acquitte une seule fois chez Google et restaure sans double droit', async () => {
    const { service, db, play, user } = setup();
    await service.verify(db, user, productId, token);
    expect(play.acknowledge).toHaveBeenCalledWith(productId, token);
    play.getPurchase.mockResolvedValue({ purchaseState: 0, acknowledgementState: 1, consumptionState: 0, obfuscatedExternalAccountId: play.accountId(uid) });
    await service.verify(db, user, productId, token);
    expect(play.acknowledge).toHaveBeenCalledTimes(1);
    expect(await service.access(db, user, cat, key, {}, { enabled: true })).toMatchObject({ allowed: true });
    expect(await service.access(db, { uid: 'other', email: 'other@example.invalid' }, cat, key, {}, { enabled: true })).toMatchObject({ allowed: false });
    expect(Object.keys(db.read('play_secret_receipts'))).toHaveLength(1);
  });
  it('refuse les paiements en attente, consommés, multiples ou liés à un autre compte', async () => {
    const { service, db, play, user } = setup();
    for (const change of [{ purchaseState: 2 }, { consumptionState: 1 }, { quantity: 2 }, { obfuscatedExternalAccountId: play.accountId('other') }]) {
      play.getPurchase.mockResolvedValue({ purchaseState: 0, consumptionState: 0, obfuscatedExternalAccountId: play.accountId(uid), ...change });
      await expect(service.verify(db, user, productId, token)).rejects.toThrow();
      expect(db.read('secret_entitlements')).toBeNull();
    }
  });
  it('refuse les produits inconnus et le rejeu concurrent d’un reçu par un autre compte', async () => {
    const { service, db, play, user } = setup();
    await expect(service.verify(db, user, 'forged', token)).rejects.toThrow('Produit non reconnu');
    await service.verify(db, user, productId, token);
    const other = { uid: 'other', email: 'other@example.invalid' };
    play.getPurchase.mockResolvedValue({ purchaseState: 0, consumptionState: 0, obfuscatedExternalAccountId: play.accountId('other') });
    await expect(service.verify(db, other, productId, token)).rejects.toThrow('déjà associé');
  });
  it('ne débloque pas le contenu si l’acquittement échoue, mais permet la reprise', async () => {
    const { service, db, play, user } = setup();
    play.acknowledge.mockRejectedValueOnce(new Error('Panne Google'));
    await expect(service.verify(db, user, productId, token)).rejects.toThrow();
    expect(db.read('secret_entitlements')).toBeNull();
    await service.verify(db, user, productId, token);
    expect(db.read(`secret_entitlements/${uid}/${cat}/${key}`).state).toBe('purchased');
  });
  it('révoque un remboursement et ne ressuscite pas le droit avec un ancien reçu', async () => {
    const { service, db, play, user } = setup();
    await service.verify(db, user, productId, token);
    play.getPurchase.mockResolvedValue({ purchaseState: 1 });
    const ledger = db.read('play_secret_receipts/' + play.tokenId(token));
    await service.synchronize(db, productId, token, ledger);
    expect((await service.access(db, user, cat, key, {}, { enabled: true })).allowed).toBe(false);
    play.getPurchase.mockResolvedValue({ purchaseState: 0, consumptionState: 0, obfuscatedExternalAccountId: play.accountId(uid) });
    await expect(service.verify(db, user, productId, token)).rejects.toThrow('révoqué');
  });
  it('revérifie les droits périmés chez Google avant de livrer le secret', async () => {
    const { service, db, play, user } = setup();
    await service.verify(db, user, productId, token);
    await db.ref('play_secret_receipts/' + play.tokenId(token) + '/checkedAt').set(1);
    play.getPurchase.mockResolvedValue({ purchaseState: 1 });
    expect((await service.access(db, user, cat, key, {}, { enabled: true })).allowed).toBe(false);
  });
  it('fige les échéances existantes et ignore les renouvellements ultérieurs', async () => {
    vi.stubEnv('PLAY_BILLING_SERVICE_ACCOUNT', 'configured'); vi.stubEnv('PLAY_RTDN_AUDIENCE', 'audience'); vi.stubEnv('PLAY_RTDN_SERVICE_ACCOUNT_EMAIL', 'pubsub@example.invalid');
    const expiry = Date.now() + 3600000;
    const { db, service, user } = setup({ purchased_user: { 'tester@example,invalid': { token: 'old', expiresAt: expiry } } });
    await service.activate(db);
    expect(db.read('secret_legacy_access/tester@example,invalid').expiresAt).toBe(expiry);
    await db.ref('purchased_user/tester@example,invalid/expiresAt').set(expiry + 9999999);
    expect((await service.access(db, user, cat, key, {})).allowed).toBe(true);
    await db.ref('secret_legacy_access/tester@example,invalid/expiresAt').set(1);
    expect((await service.access(db, user, cat, key, { allowed: true })).allowed).toBe(false);
    await service.activate(db);
    expect(db.read('secret_legacy_access/tester@example,invalid').expiresAt).toBe(1);
  });
  it('protège la bascule et l’association produit-secret', async () => {
    const { db, service } = setup();
    await expect(service.activate(db)).rejects.toThrow('compte de service');
    await expect(service.configure(db, cat, key, 'different_product')).rejects.toThrow('déjà fixé');
    await db.ref('db_sirr_protection/second').set({ faida: 'Autre' });
    await expect(service.configure(db, cat, 'second', productId)).rejects.toThrow('déjà associé');
  });
  it('garde les contenus verrouillés côté API et masque les images payantes dans le catalogue', async () => {
    const { load } = setup({ secret_billing: { settings: { enabled: true } } });
    const result = await invoke(load('pages/api/get-content.js').default, { kind: 'secret', cat, key });
    expect(result.code).toBe(403); expect(result.body.code).toBe('SECRET_PURCHASE_REQUIRED'); expect(JSON.stringify(result.body)).not.toContain('confidentiel');
    const list = await invoke(load('pages/api/list-content.js').default, { kind: 'secret', cat });
    expect(list.body.individualPurchases).toBe(true); expect(list.body.items[0].img).toBeUndefined(); expect(list.body.items[0].intro).toBeUndefined();
  });
  it('n’expose jamais le jeton ou une erreur Google dans les réponses API', async () => {
    const { load, play } = setup(); play.getPurchase.mockRejectedValue(new Error('https://google/tokens/' + token));
    const result = await invoke(load('pages/api/secret-purchases.js').default, { action: 'verify', productId, purchaseToken: token });
    expect(result.code).toBe(503); expect(JSON.stringify(result.body)).not.toContain(token);
    const admin = await invoke(load('pages/api/secret-purchases.js').default, { action: 'activate' }); expect(admin.code).toBe(403);
  });
});

it('les notifications exigent une identité authentifiée et revérifient les remboursements', async () => {
  const { db, play, service, user } = setup();
  await service.verify(db, user, productId, token);
  play.getPurchase.mockResolvedValue({ purchaseState: 1 });
  const verifyNotification = vi.fn(async () => {});
  const load = runtime(db, { stubs: { 'server/playBilling.js': { ...play, verifyNotification } } });
  const data = Buffer.from(JSON.stringify({ packageName: 'com.Asrar', voidedPurchaseNotification: { purchaseToken: token } })).toString('base64');
  const handler = load('pages/api/play-notifications.js').default;
  const result = await invoke(handler, { message: { data } });
  expect(result.code).toBe(204); expect(verifyNotification).toHaveBeenCalled();
  expect(db.read(`secret_entitlements/${uid}/${cat}/${key}`).state).toBe('revoked');
  verifyNotification.mockRejectedValue(Object.assign(new Error('Unauthorized'), { statusCode: 401 }));
  expect((await invoke(handler, { message: { data } })).code).toBe(401);
});

it('un remboursement ancien ne retire pas un autre achat valide du même secret', async () => {
  const { db, service, play, user } = setup();
  await service.verify(db, user, productId, token);
  await service.verify(db, user, productId, 'second-valid-purchase-token');
  const latestId = play.tokenId('second-valid-purchase-token');
  play.getPurchase.mockResolvedValue({ purchaseState: 1 });
  await service.synchronize(db, productId, token, db.read('play_secret_receipts/' + play.tokenId(token)));
  expect(db.read(`secret_entitlements/${uid}/${cat}/${key}`).tokenId).toBe(latestId);
  expect((await service.access(db, user, cat, key, {}, { enabled: true })).allowed).toBe(true);
});

it('la reprise de migration réutilise l’échéance figée avant une coupure', async () => {
  vi.stubEnv('PLAY_BILLING_SERVICE_ACCOUNT', 'configured'); vi.stubEnv('PLAY_RTDN_AUDIENCE', 'audience'); vi.stubEnv('PLAY_RTDN_SERVICE_ACCOUNT_EMAIL', 'push@example.invalid');
  const expiry = Date.now() + 3600000;
  const { db, service } = setup({ purchased_user: { 'tester@example,invalid': { token: 'old', expiresAt: expiry } } });
  db.failNext('', 'update');
  await expect(service.activate(db)).rejects.toThrow('Panne simulée');
  await db.ref('purchased_user/tester@example,invalid/expiresAt').set(expiry + 86400000);
  await service.activate(db);
  expect(db.read('secret_legacy_access/tester@example,invalid').expiresAt).toBe(expiry);
});

it('un achat confirmé après fermeture de l’application est rattaché par la notification Google', async () => {
  const { db, service, play, user } = setup({ secret_billing: { settings: { enabled: true } } });
  await service.offer(db, user, cat, key, {});
  const load = runtime(db, { stubs: { 'server/playBilling.js': { ...play, verifyNotification: async () => {} } } });
  const data = Buffer.from(JSON.stringify({ packageName: 'com.Asrar', oneTimeProductNotification: { sku: productId, purchaseToken: token } })).toString('base64');
  expect(db.read('play_secret_receipts')).toBeNull();
  expect((await invoke(load('pages/api/play-notifications.js').default, { message: { data } })).code).toBe(204);
  expect(db.read(`secret_entitlements/${uid}/${cat}/${key}`).state).toBe('purchased');
  expect(play.acknowledge).toHaveBeenCalled();
});

it('une notification sans compte préalablement lié ou un paiement en attente ne crée aucun droit', async () => {
  const { db, service, play, user } = setup({ secret_billing: { settings: { enabled: true } } });
  await service.completeNotification(db, productId, token);
  expect(db.read('secret_entitlements')).toBeNull();
  await service.offer(db, user, cat, key, {});
  play.getPurchase.mockResolvedValue({ purchaseState: 2, obfuscatedExternalAccountId: play.accountId(uid) });
  await service.completeNotification(db, productId, token);
  expect(db.read('secret_entitlements')).toBeNull(); expect(play.acknowledge).not.toHaveBeenCalled();
});

it('un droit sans date de vérification est revérifié avant de livrer le contenu', async () => {
  const { db, service, play, user } = setup();
  await service.verify(db, user, productId, token);
  await db.ref('play_secret_receipts/' + play.tokenId(token) + '/checkedAt').remove();
  play.getPurchase.mockResolvedValue({ purchaseState: 1 });
  expect((await service.access(db, user, cat, key, {}, { enabled: true })).allowed).toBe(false);
});
