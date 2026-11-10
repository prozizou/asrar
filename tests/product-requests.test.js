import { describe, expect, it } from 'vitest';
import { database, runtime, invoke } from './support/runtime';
import { emailVendorKey } from '../lib/market';

const owner = { uid: 'owner', email: 'owner@example.test', name: 'Vendeur' };
const client = { uid: 'client', email: 'client@example.test', name: 'Client' };
const other = { uid: 'other', email: 'other@example.test', name: 'Autre' };
const vendorId = emailVendorKey(owner.email);

function setup() {
  return database({
    det_produits: { p: { produit: 'Bague', uid: owner.uid, email: owner.email, vendeur: 'Boutique' } },
    profile_clients: { b: { profile_name: 'Boutique réelle', email: owner.email, uid: owner.uid } },
  });
}
const call = (db, user, body) => invoke(runtime(db, { user })('pages/api/product-requests.js').default, { vendorId, ...body });
const jobs = (db) => Object.values(db.read('notification_jobs') || {});

describe('Demandes de produit dans une boutique', () => {
  it('seul le propriétaire voit toutes les demandes ; un client ne voit que les siennes', async () => {
    const db = setup();
    const created = await call(db, client, { action: 'create', text: 'Je cherche un encens rare' });
    expect(created.code).toBe(200);
    await call(db, other, { action: 'create', text: 'Un livre de secrets' });

    const ownerList = await call(db, owner, { action: 'list' });
    expect(ownerList.body.owner).toBe(true);
    expect(ownerList.body.items).toHaveLength(2);
    expect(ownerList.body.items.map((i) => i.email).sort()).toEqual([client.email, other.email]);

    const clientList = await call(db, client, { action: 'list' });
    expect(clientList.body.owner).toBe(false);
    expect(clientList.body.items).toHaveLength(1);
    expect(JSON.stringify(clientList.body)).not.toContain(other.email);
    expect(JSON.stringify(clientList.body)).not.toContain('Un livre');
  });

  it('notifie le propriétaire puis l’auteur quand la boutique répond', async () => {
    const db = setup();
    const { body } = await call(db, client, { action: 'create', text: 'Bague en argent' });
    expect(jobs(db).some((j) => JSON.stringify(j).includes(owner.uid))).toBe(true);

    expect((await call(db, other, { action: 'reply', id: body.item.id, text: 'Pirate' })).code).toBe(403);
    const reply = await call(db, owner, { action: 'reply', id: body.item.id, text: 'Disponible demain' });
    expect(reply.code).toBe(200);
    const mine = await call(db, client, { action: 'list' });
    expect(mine.body.items[0].reply.text).toBe('Disponible demain');
    expect(jobs(db).some((j) => JSON.stringify(j).includes('a répondu à votre demande'))).toBe(true);
  });

  it('le propriétaire supprime une demande, un tiers ne le peut pas', async () => {
    const db = setup();
    const { body } = await call(db, client, { action: 'create', text: 'Chaîne de protection' });
    expect((await call(db, other, { action: 'delete', id: body.item.id })).code).toBe(403);
    expect((await call(db, owner, { action: 'delete', id: body.item.id })).code).toBe(200);
    expect(db.read('product_requests/' + vendorId + '/' + body.item.id)).toBeNull();
  });

  it('l’auteur peut retirer sa propre demande', async () => {
    const db = setup();
    const { body } = await call(db, client, { action: 'create', text: 'Encens du soir' });
    expect((await call(db, client, { action: 'delete', id: body.item.id })).code).toBe(200);
  });

  it('refuse une demande du propriétaire, vide, ou vers une boutique inconnue', async () => {
    const db = setup();
    expect((await call(db, owner, { action: 'create', text: 'Pour moi' })).code).toBe(400);
    expect((await call(db, client, { action: 'create', text: ' ' })).code).toBe(400);
    const unknown = await invoke(runtime(db, { user: client })('pages/api/product-requests.js').default,
      { vendorId: emailVendorKey('nobody@example.test'), action: 'create', text: 'Bonjour boutique' });
    expect(unknown.code).toBe(404);
    expect((await call(db, client, { vendorId: 'a/b', action: 'list' })).code).toBe(400);
  });

  it('borne le nombre de demandes en attente par client', async () => {
    const db = setup();
    for (let i = 0; i < 5; i++) expect((await call(db, client, { action: 'create', text: 'Demande ' + i })).code).toBe(200);
    expect((await call(db, client, { action: 'create', text: 'Demande 6' })).code).toBe(429);
  });
});
