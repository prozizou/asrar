// Durcissement de sécurité (audit 2026-11) : chaque correction a son test,
// pour qu'aucune ne disparaisse lors d'une évolution ultérieure.
import { afterEach, describe, it, expect, vi } from 'vitest';
import { database, runtime, invoke } from './support/runtime';
import { emailVendorKey } from '../lib/market';

afterEach(() => vi.unstubAllEnvs());

// Requête GET (routes publiques) : invoke() n'envoie que des POST JSON.
async function get(handler, query = {}, headers = {}) {
  const res = {
    statusCode: 200, code: 200, headers: {}, body: undefined,
    setHeader(k, v) { this.headers[k] = v; },
    status(n) { this.code = n; this.statusCode = n; return this; },
    json(v) { this.body = v; return this; },
    send(v) { this.body = v; return this; },
    end(v) { if (v !== undefined) this.body = v; this.code = this.statusCode; return this; },
  };
  await handler({ method: 'GET', headers, query }, res);
  return res;
}

describe('Tâches planifiées : secret uniquement dans l’en-tête', () => {
  it('refuse le secret passé dans l’URL, accepte l’en-tête Authorization', () => {
    vi.stubEnv('CRON_SECRET', 'secret-de-test');
    const { authorized } = runtime(database())('server/cronAuth.js');
    expect(authorized({ headers: {}, query: { secret: 'secret-de-test' } })).toBe(false);
    expect(authorized({ headers: { authorization: 'Bearer mauvais' }, query: {} })).toBe(false);
    expect(authorized({ headers: { authorization: 'Bearer secret-de-test' }, query: {} })).toBe(true);
  });
});

describe('Contact WhatsApp : plus de numéro de vendeur sans commande', () => {
  it('?product= ne révèle plus le numéro, même en JSON', async () => {
    vi.stubEnv('WHATSAPP_NUMBER', '221700000000');
    const db = database({ det_produits: { p1: { produit: 'Bague', number: '221771234567' } } });
    const handler = runtime(db)('pages/api/wa.js').default;
    const leaked = await get(handler, { product: 'p1', format: 'json' });
    expect(leaked.code).toBe(410);
    expect(JSON.stringify(leaked.body || '')).not.toContain('221771234567');
    expect(leaked.headers.Location).toBeUndefined();
    // Le contact de la plateforme fonctionne toujours.
    const platform = await get(handler, { text: 'Bonjour', format: 'json' });
    expect(platform.body.url).toContain('phone=221700000000');
  });
});

describe('Likes et commentaires : catégories autorisées seulement', () => {
  it.each(['admins', 'sellers', 'notification_jobs', 'n_importe_quoi'])('refuse la catégorie %s', async (cat) => {
    const db = database({});
    const handler = runtime(db, { user: { uid: 'u1', email: 'u1@example.test' } })('pages/api/social.js').default;
    expect((await invoke(handler, { cat, key: 'k1', action: 'toggle-like' })).code).toBe(400);
    expect((await invoke(handler, { cat, key: 'k1', action: 'comment', text: 'spam' })).code).toBe(400);
    expect(db.read('ratings')).toBeNull();
    expect(db.read('comments')).toBeNull();
  });
  it('accepte les catégories de l’application', async () => {
    const db = database({});
    const handler = runtime(db, { user: { uid: 'u1', email: 'u1@example.test' } })('pages/api/social.js').default;
    for (const cat of ['product', 'vendor', 'formation', 'protection']) {
      expect((await invoke(handler, { cat, key: 'k1', action: 'get' })).code).toBe(200);
    }
  });
});

describe('Discussion Zikr : pièces jointes du seul compte Cloudinary d’ASRAR PRO', () => {
  const setup = () => {
    const db = database({ zikr_groups: { g: { name: 'G', target: 100, total: 0, membersCount: 1, ownerUid: 'tester' } }, zikr_members: { g: { tester: { fait: 0 } } } });
    return { db, handler: runtime(db)('pages/api/zikr.js').default };
  };
  it('refuse un fichier hébergé sur le compte Cloudinary d’un tiers', async () => {
    vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'asrarpro');
    const { db, handler } = setup();
    const foreign = await invoke(handler, { action: 'sendMessage', groupId: 'g', text: '', mediaType: 'image', mediaUrl: 'https://res.cloudinary.com/pirate/image/upload/piege.jpg' });
    expect(foreign.code).toBe(400);
    expect(db.read('zikr_chat')).toBeNull();
    const own = await invoke(handler, { action: 'sendMessage', groupId: 'g', text: '', mediaType: 'image', mediaUrl: 'https://res.cloudinary.com/asrarpro/image/upload/v1/zikr_chat/g/tester/photo.jpg' });
    expect(own.code).toBe(200);
  });
});

describe('Boutique : annonce « nouveau produit » limitée', () => {
  it('n’annonce à tous qu’un produit par vendeur sur 30 minutes', async () => {
    const seller = { uid: 'seller', email: 'seller@example.test' };
    const db = database({ sellers: { seller: { shopActive: true, expiresAt: 'lifetime', shop: { name: 'Boutique', phone: '221700000000' } } } });
    const handler = runtime(db, { user: seller })('pages/api/shop.js').default;
    const product = (n) => ({ produit: 'Produit ' + n, Prix: 1000, images: ['https://res.cloudinary.com/a/1.jpg', 'https://res.cloudinary.com/a/2.jpg'], description: 'Desc', chain: 'bague' });
    const first = await invoke(handler, { action: 'save-product', product: product(1) });
    const second = await invoke(handler, { action: 'save-product', product: product(2) });
    expect(first.body).toMatchObject({ ok: true, announced: true });
    expect(second.body).toMatchObject({ ok: true, announced: false });
    expect(Object.keys(db.read('det_produits'))).toHaveLength(2); // le second est bien publié
    expect(Object.keys(db.read('notification_jobs') || {})).toHaveLength(1); // une seule diffusion
    expect(emailVendorKey(seller.email)).toMatch(/^v_/);
  });
});
