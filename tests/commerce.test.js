import { describe, expect, it } from 'vitest';
import { database, runtime, invoke } from './support/runtime';
import { formatOrderPrice } from '../lib/orderStatus';
const buyer = { uid: 'buyer', email: 'buyer@example.test' }, seller = { uid: 'seller', email: 'seller@example.test' };
const product = { produit: 'Produit réel', Prix: '12 500', devise: 'FCFA', uid: 'seller', email: seller.email, number: '221770000000', vendeur: 'Boutique réelle' };
const requestId = 'request-fixed-2026-00001';
function setup() {
  const db = database({ det_produits: { p: product }, sellers: { seller: { shopActive: true, expiresAt: 'lifetime' } } });
  const stubs = { 'server/grant.js': { app: () => ({ database: () => db, auth: () => ({ getUserByEmail: async () => ({ ...seller, emailVerified: true }), getUser: async () => ({ ...seller, emailVerified: true }) }) }) } };
  return { db, stubs, store: runtime(db, { stubs })('server/orderStore.js') };
}

describe('Demandes et commandes fiables', () => {
  it('affiche exactement les centimes du prix vérifié et distingue un prix absent', () => {
    expect(formatOrderPrice(1250.75, 'EUR')).toBe('1 250,75 EUR');
    expect(formatOrderPrice(0)).toBe('Gratuit');
    expect(formatOrderPrice(null)).toBe('Prix non vérifié');
  });
  it('fige le prix et le vendeur serveur et ignore les montants forgés du navigateur', async () => {
    const { db, stubs } = setup();
    const result = await invoke(runtime(db, { user: buyer, stubs })('pages/api/orders.js').default, {
      action: 'create', productKey: 'p', requestId, prix: 1, vendeur: 'Faux vendeur', sellerUid: 'attacker', status: 'paid',
    });
    expect(result.code).toBe(200);
    expect(result.body.order).toMatchObject({ prix: 12500, vendeur: product.vendeur, sellerUid: seller.uid, status: 'whatsapp_request', quantity: 1 });
    expect(result.body.order._private).toBeUndefined();
    expect(JSON.stringify(result.body.order)).not.toContain(product.number);
    expect(JSON.stringify(result.body.order)).not.toContain(seller.email);
  });
  it('deux créations concurrentes ou une reprise réseau produisent une seule demande', async () => {
    const { db, store } = setup();
    const results = await Promise.all([store.createRequest(db, buyer, 'p', requestId), store.createRequest(db, buyer, 'p', requestId)]);
    expect(results[0].order._key).toBe(results[1].order._key);
    expect(Object.keys(db.read('orders_v2'))).toHaveLength(1);
    await db.ref('det_produits/p').update({ Prix: 50000, vendeur: 'Autre nom' });
    expect((await store.createRequest(db, buyer, 'p', requestId)).order.prix).toBe(12500);
  });
  it('ne crée pas de demande si la persistance échoue et permet la reprise', async () => {
    const { db, store } = setup();
    const crypto = await import('node:crypto');
    const id = crypto.createHash('sha256').update(buyer.uid + ':' + requestId).digest('hex');
    db.failNext('orders_v2/' + id, 'transaction');
    await expect(store.createRequest(db, buyer, 'p', requestId)).rejects.toThrow();
    expect(db.read('orders_v2')).toBeNull();
    expect((await store.createRequest(db, buyer, 'p', requestId)).order.status).toBe('whatsapp_request');
  });
  it('refuse les prix ambigus et les produits supprimés', async () => {
    const { db, store } = setup();
    await db.ref('det_produits/p/Prix').set('12 euros environ');
    await expect(store.createRequest(db, buyer, 'p', requestId)).rejects.toMatchObject({ statusCode: 409 });
    await db.ref('det_produits/p').remove();
    await expect(store.createRequest(db, buyer, 'p', requestId)).rejects.toMatchObject({ statusCode: 404 });
  });
  it('refuse une ancienne fiche quand les droits de la boutique ont expiré ou disparu', async () => {
    const { db, store } = setup();
    await db.ref('sellers/seller').set({ shopActive: true, expiresAt: 1 });
    await expect(store.createRequest(db, buyer, 'p', requestId)).rejects.toMatchObject({ statusCode: 409 });
    await db.ref('sellers/seller').remove();
    await expect(store.createRequest(db, buyer, 'p', requestId)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.read('orders_v2')).toBeNull();
  });
  it('réserve les étapes à la boutique et conserve un historique sans doublon', async () => {
    const { db, store } = setup();
    const id = (await store.createRequest(db, buyer, 'p', requestId)).order._key;
    await expect(store.transitionOrder(db, buyer, id, 'paid', false)).rejects.toMatchObject({ statusCode: 403 });
    await expect(store.transitionOrder(db, { uid: 'other', email: 'other@example.test' }, id, 'confirmed', false)).rejects.toMatchObject({ statusCode: 403 });
    await expect(store.transitionOrder(db, seller, id, 'delivered', false)).rejects.toMatchObject({ statusCode: 409 });
    await Promise.all([store.transitionOrder(db, seller, id, 'confirmed', false), store.transitionOrder(db, seller, id, 'confirmed', false)]);
    expect(Object.keys(db.read('orders_v2/' + id + '/history'))).toHaveLength(2);
    await store.transitionOrder(db, seller, id, 'paid', false, 'Réception du virement vérifiée');
    expect(Object.values(db.read('orders_v2/' + id + '/history')).some((event) => event.paymentMode === 'manual_declaration')).toBe(true);
    expect((await store.transitionOrder(db, seller, id, 'delivered', false)).status).toBe('delivered');
    await expect(store.transitionOrder(db, seller, id, 'confirmed', false)).rejects.toMatchObject({ statusCode: 409 });
  });
  it('isole les historiques et pagine les vraies dates sans exposer les clés privées', async () => {
    const { db, store } = setup();
    for (let i = 0; i < 55; i++) await store.createRequest(db, buyer, 'p', 'request-2026-' + String(i).padStart(6, '0'));
    const first = await store.listOrders(db, buyer);
    expect(first.items).toHaveLength(50); expect(first.nextCursor).not.toBeNull();
    const next = await store.listOrders(db, buyer, { cursor: first.nextCursor });
    expect(next.items).toHaveLength(5);
    expect(new Set([...first.items, ...next.items].map((item) => item._key)).size).toBe(55);
    expect((await store.listOrders(db, seller)).items).toHaveLength(0);
    expect((await store.listOrders(db, seller, { seller: true })).items).toHaveLength(50);
    expect(first.items.every((item) => !item._private)).toBe(true);
  });
  it('un ancien clic ne devient pas une commande confirmée', async () => {
    const db = database({ orders: { buyer: { legacy: { prix: 1, vendeur: 'Non vérifié', at: 1, status: 'paid' } } } });
    const result = await invoke(runtime(db, { user: buyer })('pages/api/orders.js').default);
    expect(result.body.items[0].status).toBe('legacy_request');
    expect((await invoke(runtime(db, { user: buyer })('pages/api/track.js').default, { type: 'order', order: product })).code).toBe(410);
    expect(db.read('orders_v2')).toBeNull();
  });
});
