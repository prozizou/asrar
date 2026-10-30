import { it, expect, vi } from 'vitest';
import { database, runtime, invoke } from './support/runtime';
const cat = 'protection', key = '-P2PntsHubOw5y3jXbI_', productId = 'secret_protection_001';
const user = { uid: 'pilot-buyer', email: 'pilot@example.invalid' };
function setup(seed = {}) {
  const db = database({ db_sirr_protection: { [key]: { faida: 'RETOUR À L’ENVOYEUR', sirr: 'Recette privée pilote' }, other: { faida: 'Autre secret', sirr: 'Autre recette privée' } },
    secret_billing: { settings: { enabled: true } }, ...seed });
  const actual = runtime(db)('server/playBilling.js');
  const play = { ...actual, getPurchase: vi.fn(async () => ({ purchaseState: 0, consumptionState: 0, acknowledgementState: 1, obfuscatedExternalAccountId: actual.accountId(user.uid) })), acknowledge: vi.fn() };
  const load = runtime(db, { user, stubs: { 'server/playBilling.js': play, 'server/access.js': {
    verifyUser: async () => user, getAccessStatus: async () => ({}), isAdmin: async () => true, emailKey: (v) => v.replace(/\./g, ','),
  } } });
  return { db, play, bindings: load('server/playSecretBindings.js'), service: load('server/secretPurchases.js'), load };
}
it('associe le produit au seul identifiant transmis par le lien de partage', async () => {
  const { db, service, bindings } = setup();
  expect(await bindings.byProduct(db, productId)).toEqual({ cat, key });
  expect(await service.offer(db, user, cat, key, {})).toMatchObject({ productId, allowed: false });
  expect((await service.offer(db, user, cat, 'other', {})).productId).toBeNull();
  expect(db.read('secret_billing/settings')).toEqual({ enabled: true });
  expect(db.read('secret_entitlements')).toBeNull();
});
it('un achat vérifié débloque uniquement RETOUR À L’ENVOYEUR, jamais un titre similaire', async () => {
  const { db, service, load } = setup();
  await db.ref('db_sirr_protection/lookalike').set({ faida: 'RETOUR À L’ENVOYEUR', sirr: 'Autre contenu' });
  await service.verify(db, user, productId, 'verified-pilot-receipt');
  expect((await service.access(db, user, cat, key, {})).allowed).toBe(true);
  expect((await service.access(db, user, cat, 'lookalike', {})).allowed).toBe(false);
  const detail = await invoke(load('pages/api/get-content.js').default, { kind: 'secret', cat, key });
  expect(detail.code).toBe(200); expect(detail.body.item.sirr).toBe('Recette privée pilote');
});
it('refuse de réattribuer le produit ou le secret pilote depuis l’administration', async () => {
  const { db, service, play } = setup();
  await expect(service.configure(db, cat, 'other', productId)).rejects.toThrow('réservé');
  await expect(service.configure(db, cat, key, 'different_product')).rejects.toThrow('réservé');
  expect(db.read('play_secret_products')).toBeNull(); expect(play.getPurchase).not.toHaveBeenCalled();
});
it('refuse un conflit Firebase existant au lieu de remplacer des achats antérieurs', async () => {
  const { db, service, play } = setup({ play_secret_products: { [productId]: { cat, key: 'other' } } });
  await expect(service.offer(db, user, cat, key, {})).rejects.toThrow('déjà associé');
  await expect(service.verify(db, user, productId, 'verified-pilot-receipt')).rejects.toThrow('déjà associé');
  expect(play.getPurchase).not.toHaveBeenCalled(); expect(db.read('play_secret_products/' + productId).key).toBe('other');
});
it('une désactivation explicite masque le prix sans retirer les droits acquis', async () => {
  const { db, service } = setup({ secret_products: { [cat]: { [key]: { productId, enabled: false } } } });
  expect((await service.offer(db, user, cat, key, {})).productId).toBeNull();
  await service.verify(db, user, productId, 'old-pilot-purchase-token');
  expect((await service.access(db, user, cat, key, {})).allowed).toBe(true);
});
it('conserve le modèle d’abonnement quand la vente individuelle est désactivée', async () => {
  const { db, service } = setup({ secret_billing: { settings: { enabled: false } } });
  const offer = await service.offer(db, user, cat, key, { allowed: true });
  expect(offer).toMatchObject({ mode: 'subscription', allowed: true, productId });
  expect(db.read('secret_billing/settings/enabled')).toBe(false);
});
it('refuse également les anciens liens inversés qui viseraient le mauvais secret', async () => {
  const badSecret = setup({ secret_products: { protection: { other: { productId, enabled: true } } } });
  await expect(badSecret.service.offer(badSecret.db, user, cat, 'other', {})).rejects.toThrow('réservé');
  const badProduct = setup({ play_secret_products: { different_product: { cat, key } } });
  await expect(badProduct.service.verify(badProduct.db, user, 'different_product', 'purchase-token-example')).rejects.toThrow('réservé');
  expect(badProduct.play.getPurchase).not.toHaveBeenCalled();
});
it('affiche la configuration administrateur sans révéler le texte du secret', async () => {
  const { load } = setup();
  const response = await invoke(load('pages/api/secret-purchases.js').default, { action: 'configuration', cat, key });
  expect(response.code).toBe(200); expect(response.body).toMatchObject({ productId, fixed: true });
  expect(JSON.stringify(response.body)).not.toContain('Recette privée');
});
