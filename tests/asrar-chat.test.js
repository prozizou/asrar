// Asrar-chat : messagerie, publications payantes, paiement direct au vendeur,
// droits d'accès et modération (pages/api/asrar-chat.js, server/asrarChat/*).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { database, runtime, invoke } from './support/runtime';
import {
  normalizeHandle, normalizeWaveLink, normalizeSellerInput, normalizePostInput, normalizeAsset, canTransition,
  commissionOf, orderRef, entitlementActive, dmId,
} from '../lib/asrarChat/logic';

// Scénarios complets (nombreux appels) : délai plus large que les 5 s par défaut.
vi.setConfig({ testTimeout: 30000 });
afterEach(() => vi.unstubAllEnvs());

const U = {
  seller: { uid: 'seller1', email: 'seller@example.test', name: 'Vendeur' },
  buyer: { uid: 'buyer1', email: 'buyer@example.test', name: 'Acheteur' },
  other: { uid: 'other1', email: 'other@example.test', name: 'Autre' },
  admin: { uid: 'admin1', email: 'admin@example.test', name: 'Admin' },
};

// Un gestionnaire chargé par base et par compte (le chargement est coûteux).
const handlers = new WeakMap();
function api(db, user) {
  if (!handlers.has(db)) handlers.set(db, new Map());
  const cache = handlers.get(db);
  if (!cache.has(user.uid)) cache.set(user.uid, load(db, user));
  return cache.get(user.uid);
}
function load(db, user) {
  return runtime(db, { user, stubs: { 'server/access.js': {
    verifyUser: async () => ({ ...user, email_verified: true }),
    isAdmin: async (u) => u.uid === U.admin.uid,
  } } })('pages/api/asrar-chat.js').default;
}
const call = async (db, user, action, body = {}) => invoke(api(db, user), { action, ...body });
const ok = async (db, user, action, body) => {
  const r = await call(db, user, action, body);
  if (r.code !== 200) throw new Error(`${action} → ${r.code} ${JSON.stringify(r.body)}`);
  return r.body;
};

const video = (uid, n = 1) => ({ id: `ac/${uid}/private/video_${n}`, rt: 'video', fmt: 'mp4', bytes: 1000, duration: 90 });
const blurred = (uid) => ({ id: `ac/${uid}/public/apercu_flou`, rt: 'image', fmt: 'jpg' });

async function setup() {
  vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'asrarpro');
  vi.stubEnv('CLOUDINARY_API_KEY', 'key');
  vi.stubEnv('CLOUDINARY_API_SECRET', 'secret');
  const db = database({});
  for (const [handle, u] of [['vendeur', U.seller], ['acheteur', U.buyer], ['autre', U.other], ['moderation_team', U.admin]]) {
    await ok(db, u, 'profile.save', { handle, displayName: u.name, bio: '' });
  }
  await ok(db, U.seller, 'seller.save', { waveLink: 'https://pay.wave.com/m/M_sn_TEST123/c/sn/', pispiAlias: 'vendeur@pispi', whatsapp: '221770000000', acceptTerms: true });
  return db;
}

async function publishVideo(db, price = 1500) {
  return (await ok(db, U.seller, 'post.save', {
    kind: 'video', title: 'Vidéo exclusive', description: 'Cours complet', previewText: 'Les 30 premières secondes', price,
    accessDays: 0, category: 'formations', assets: [video(U.seller.uid)], previewImage: blurred(U.seller.uid), contentText: 'Notes privées du cours',
  })).pid;
}

describe('Règles pures', () => {
  it('pseudonymes', () => {
    expect(normalizeHandle('@Mon_Nom')).toBe('mon_nom');
    expect(normalizeHandle('ab')).toBe('');
    expect(normalizeHandle('admin')).toBe('');
    expect(normalizeHandle('a b c')).toBe('');
  });
  it('lien Wave marchand uniquement', () => {
    expect(normalizeWaveLink('pay.wave.com/m/M_sn_ABC1/c/sn')).toBe('https://pay.wave.com/m/M_sn_ABC1/c/sn/');
    expect(normalizeWaveLink('https://pay.wave.com.evil.example/m/M_sn_ABC1/')).toBe('');
    expect(normalizeWaveLink('https://evil.example/m/x')).toBe('');
    expect(normalizeSellerInput({ acceptTerms: true }).error).toBe('noMethod');
    expect(normalizeSellerInput({ pispiAlias: 'x@y', acceptTerms: false }).error).toBe('terms');
  });
  it('pièces jointes limitées au dossier du compte', () => {
    expect(normalizeAsset(video('u1'), 'u1', 'private')).toBeTruthy();
    expect(normalizeAsset(video('u2'), 'u1', 'private')).toBeNull();
    expect(normalizeAsset({ ...video('u1'), id: 'ac/u1/private/../u2/x' }, 'u1', 'private')).toBeNull();
    expect(normalizeAsset({ ...video('u1'), fmt: 'exe' }, 'u1', 'private')).toBeNull();
    expect(normalizeAsset(video('u1'), 'u1', 'public')).toBeNull();
  });
  it('publication payante : prix borné, média exigé, aperçu exigé', () => {
    const base = { kind: 'video', title: 'Titre', price: 1500, previewText: 'x', assets: [video('u1')] };
    expect(normalizePostInput(base, 'u1').value.price).toBe(1500);
    expect(normalizePostInput({ ...base, price: 50 }, 'u1').error).toBe('price');
    expect(normalizePostInput({ ...base, assets: [] }, 'u1').error).toBe('media');
    expect(normalizePostInput({ ...base, previewText: '', description: '' }, 'u1').error).toBe('preview');
  });
  it('transitions de commande : l’acheteur ne confirme jamais lui-même', () => {
    expect(canTransition('buyer', 'declared', 'paid')).toBe(false);
    expect(canTransition('buyer', 'pending', 'paid')).toBe(false);
    expect(canTransition('seller', 'declared', 'paid')).toBe(true);
    expect(canTransition('admin', 'disputed', 'refunded')).toBe(true);
  });
  it('commission, référence, accès', () => {
    expect(commissionOf(1500, 10)).toBe(150);
    expect(commissionOf(1500, 99)).toBe(750); // plafonnée à 50 %
    expect(orderRef(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toMatch(/^AC-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(entitlementActive({ expiresAt: 0 }, 5)).toBe(true);
    expect(entitlementActive({ expiresAt: 4 }, 5)).toBe(false);
    expect(entitlementActive({ expiresAt: 0, revoked: true }, 5)).toBe(false);
    expect(dmId('b', 'a')).toBe(dmId('a', 'b'));
  });
});

describe('Scénario : vidéo exclusive à 1 500 FCFA', () => {
  it('reste verrouillée jusqu’à la confirmation du vendeur, puis s’ouvre pour le seul acheteur', async () => {
    const db = await setup();
    await ok(db, U.admin, 'admin.commission', { rate: 10 });
    const ch = (await ok(db, U.seller, 'conv.create', { type: 'channel', title: 'Chaîne du vendeur', visibility: 'public' })).id;
    const pid = await publishVideo(db);
    await ok(db, U.seller, 'msg.send', { cid: ch, postId: pid });
    await ok(db, U.buyer, 'conv.join', { cid: ch });

    // 2. L'abonné voit l'aperçu flouté, la description et le prix — pas le contenu.
    const feed = await ok(db, U.buyer, 'msg.list', { cid: ch });
    const card = feed.messages[0].post;
    expect(card).toMatchObject({ title: 'Vidéo exclusive', price: 1500, unlocked: false });
    expect(card.previewImage).toContain('/ac/seller1/public/');
    const locked = await ok(db, U.buyer, 'post.open', { pid });
    expect(locked.content).toBeUndefined();
    expect(JSON.stringify(locked)).not.toContain('video_1');
    expect(JSON.stringify(locked)).not.toContain('Notes privées');
    expect(locked.paymentMethods).toEqual(['wave', 'pispi', 'whatsapp']);

    // 3-4. Déverrouiller → Wave : lien du vendeur avec le montant prérempli.
    const created = await ok(db, U.buyer, 'order.create', { pid, method: 'wave' });
    expect(created.order).toMatchObject({ status: 'pending', amount: 1500 });
    expect(created.pay.waveUrl).toBe('https://pay.wave.com/m/M_sn_TEST123/c/sn/?amount=1500');
    expect(created.pay.ref).toMatch(/^AC-/);
    // Pas de doublon : la même commande est reprise.
    expect((await ok(db, U.buyer, 'order.create', { pid, method: 'wave' })).order.id).toBe(created.order.id);
    const oid = created.order.id;

    // L'acheteur ne peut pas se confirmer lui-même, même après déclaration.
    expect((await call(db, U.buyer, 'order.confirm', { oid, checked: true })).code).toBe(409);
    await ok(db, U.buyer, 'order.declare', { oid, paymentRef: 'TX-123456' });
    expect((await call(db, U.buyer, 'order.confirm', { oid, checked: true })).code).toBe(409);
    expect((await ok(db, U.buyer, 'post.open', { pid })).content).toBeUndefined();
    // Un tiers ne peut ni voir ni confirmer la commande.
    expect((await call(db, U.other, 'order.confirm', { oid, checked: true })).code).toBe(403);
    expect((await call(db, U.other, 'order.get', { oid })).code).toBe(403);

    // 5. Le vendeur vérifie son relevé puis confirme.
    expect((await call(db, U.seller, 'order.confirm', { oid })).code).toBe(400); // case « vérifié » obligatoire
    await ok(db, U.seller, 'order.confirm', { oid, checked: true });
    // Double confirmation : refusée, une seule vente comptée.
    expect((await call(db, U.seller, 'order.confirm', { oid, checked: true })).code).toBe(409);

    // 6. Accessible uniquement à cet acheteur, par lien signé temporaire.
    const opened = await ok(db, U.buyer, 'post.open', { pid });
    expect(opened.content.text).toBe('Notes privées du cours');
    const url = new URL(opened.content.assets[0].url);
    expect(url.hostname).toBe('api.cloudinary.com');
    expect(url.searchParams.get('type')).toBe('private');
    expect(Number(url.searchParams.get('expires_at'))).toBeGreaterThan(Date.now() / 1000);
    expect(url.searchParams.get('signature')).toMatch(/^[0-9a-f]{40}$/);
    expect((await ok(db, U.other, 'post.open', { pid })).content).toBeUndefined();
    expect((await ok(db, U.buyer, 'library')).items.map((x) => x.id)).toEqual([pid]);

    // 7. Vente enregistrée, revenus du vendeur actualisés (commission 10 %).
    const sales = await ok(db, U.seller, 'order.sales');
    expect(sales.summary).toMatchObject({ gross: 1500, salesCount: 1, commissionDue: 150, net: 1350 });
    expect(db.read(`ac_posts/${pid}/stats/sales`)).toBe(1);
    const overview = await ok(db, U.admin, 'admin.overview');
    expect(overview.stats).toMatchObject({ sales: 1, volume: 1500, commission: 150 });

    // Notifications : vendeur (paiement à vérifier) puis acheteur (déverrouillé).
    const jobs = JSON.stringify(db.read('notification_jobs'));
    expect(jobs).toContain('Paiement à vérifier');
    expect(jobs).toContain('Contenu déverrouillé');

    // Remboursement : l'accès est retiré.
    await ok(db, U.seller, 'order.refund', { oid, note: 'Remboursé par Wave' });
    expect((await ok(db, U.buyer, 'post.open', { pid })).content).toBeUndefined();
    expect((await ok(db, U.buyer, 'library')).items).toHaveLength(0);
  });

  it('sans lien Wave Business : redirection WhatsApp par le numéro Wave du vendeur', async () => {
    const db = await setup();
    await ok(db, U.seller, 'seller.save', { wavePhone: '221781234567', acceptTerms: true });
    const pid = await publishVideo(db);
    const opened = await ok(db, U.buyer, 'post.open', { pid });
    expect(opened.paymentMethods).toEqual(['wave', 'whatsapp']);
    expect(opened.paymentInfo).toEqual({ waveDirect: false, whatsapp: true });
    const { pay } = await ok(db, U.buyer, 'order.create', { pid, method: 'wave' });
    expect(pay.waveUrl).toBe('');
    const wa = new URL(pay.whatsappUrl);
    expect(wa.searchParams.get('phone')).toBe('221781234567');
    expect(wa.searchParams.get('text')).toContain('payer par Wave');
    expect(wa.searchParams.get('text')).toContain(pay.ref);
    // Toujours verrouillé tant que le vendeur n'a pas confirmé.
    expect((await ok(db, U.buyer, 'post.open', { pid })).content).toBeUndefined();
  });

  it('avec lien Wave Business : paiement direct et contact WhatsApp proposés', async () => {
    const db = await setup();
    const pid = await publishVideo(db);
    expect((await ok(db, U.buyer, 'post.open', { pid })).paymentInfo).toEqual({ waveDirect: true, whatsapp: true });
    const { pay } = await ok(db, U.buyer, 'order.create', { pid, method: 'pispi' });
    expect(pay.pispiAlias).toBe('vendeur@pispi');
    expect(new URL(pay.whatsappUrl).searchParams.get('text')).toContain('PI-SPI');
  });

  it('signale une référence de transaction déjà utilisée chez ce vendeur', async () => {
    const db = await setup();
    const p1 = await publishVideo(db);
    const p2 = await publishVideo(db, 2000);
    const o1 = (await ok(db, U.buyer, 'order.create', { pid: p1, method: 'pispi' })).order.id;
    await ok(db, U.buyer, 'order.declare', { oid: o1, paymentRef: 'TX-SAME' });
    const o2 = (await ok(db, U.other, 'order.create', { pid: p2, method: 'pispi' })).order.id;
    await ok(db, U.other, 'order.declare', { oid: o2, paymentRef: 'tx-same' });
    const sales = await ok(db, U.seller, 'order.sales');
    expect(sales.orders.find((o) => o.id === o2).refReused).toBe(true);
    expect(sales.orders.find((o) => o.id === o1).refReused).toBe(false);
  });

  it('litige tranché par l’administration', async () => {
    const db = await setup();
    const pid = await publishVideo(db);
    const oid = (await ok(db, U.buyer, 'order.create', { pid, method: 'wave' })).order.id;
    await ok(db, U.buyer, 'order.declare', { oid, paymentRef: 'TX-999999' });
    await ok(db, U.seller, 'order.reject', { oid, note: 'Rien reçu' });
    await ok(db, U.buyer, 'order.dispute', { oid, note: 'J’ai payé, voici le reçu Wave du 12/11.' });
    expect((await ok(db, U.admin, 'admin.orders', { status: 'disputed' })).orders).toHaveLength(1);
    expect((await call(db, U.seller, 'order.resolve', { oid, decision: 'paid' })).code).toBe(403);
    await ok(db, U.admin, 'order.resolve', { oid, decision: 'paid' });
    expect((await ok(db, U.buyer, 'post.open', { pid })).content).toBeTruthy();
    expect(JSON.stringify(db.read('ac_audit'))).toContain('order.paid');
  });

  it('vente réservée aux vendeurs configurés ; publication gratuite ouverte à tous', async () => {
    const db = await setup();
    const paid = await call(db, U.buyer, 'post.save', { kind: 'text', title: 'Article', price: 500, previewText: 'x', contentText: 'y' });
    expect(paid.code).toBe(409);
    const free = await ok(db, U.buyer, 'post.save', { kind: 'text', title: 'Article libre', price: 0, contentText: 'Contenu gratuit' });
    expect((await ok(db, U.other, 'post.open', { pid: free.pid })).content.text).toBe('Contenu gratuit');
    // Fichier d'un autre compte refusé.
    const stolen = await call(db, U.seller, 'post.save', { kind: 'video', title: 'Volé', price: 1000, previewText: 'x', assets: [video(U.buyer.uid)] });
    expect(stolen.code).toBe(400);
  });
});

describe('Messagerie', () => {
  it('discussion privée : lecture réservée aux participants, blocage respecté', async () => {
    const db = await setup();
    const cid = (await ok(db, U.buyer, 'conv.dm', { handle: 'vendeur' })).id;
    await ok(db, U.buyer, 'msg.send', { cid, text: 'Bonjour, une question sur la vidéo' });
    const seen = await ok(db, U.seller, 'msg.list', { cid });
    expect(seen.messages[0].text).toBe('Bonjour, une question sur la vidéo');
    expect((await call(db, U.other, 'msg.list', { cid })).code).toBe(403);
    expect((await call(db, U.other, 'msg.send', { cid, text: 'intrus' })).code).toBe(403);
    const list = await ok(db, U.seller, 'conv.list');
    expect(list.convs[0]).toMatchObject({ id: cid, type: 'dm', unread: 1, title: 'Acheteur' });
    // Notification push au destinataire.
    expect(JSON.stringify(db.read('notification_jobs'))).toContain('Bonjour, une question');
    await ok(db, U.seller, 'block.set', { uid: U.buyer.uid, blocked: true });
    expect((await call(db, U.buyer, 'msg.send', { cid, text: 'encore' })).code).toBe(403);
  });

  it('chaîne : seuls les administrateurs publient ; les abonnés réagissent', async () => {
    const db = await setup();
    const cid = (await ok(db, U.seller, 'conv.create', { type: 'channel', title: 'Annonces', visibility: 'public' })).id;
    await ok(db, U.buyer, 'conv.join', { cid });
    expect((await call(db, U.buyer, 'msg.send', { cid, text: 'spam' })).code).toBe(403);
    const mid = (await ok(db, U.seller, 'msg.send', { cid, text: 'Nouvelle formation' })).id;
    await ok(db, U.buyer, 'msg.react', { cid, mid, emoji: '❤️' });
    expect((await call(db, U.buyer, 'msg.react', { cid, mid, emoji: '<script>' })).code).toBe(400);
    expect((await call(db, U.buyer, 'msg.edit', { cid, mid, text: 'piraté' })).code).toBe(403);
    expect((await call(db, U.buyer, 'conv.members', { cid })).code).toBe(403);
    // Un non-membre peut lire une chaîne publique sans y publier.
    expect((await ok(db, U.other, 'msg.list', { cid })).messages).toHaveLength(1);
  });

  it('groupe privé : accès par lien d’invitation seulement', async () => {
    const db = await setup();
    const cid = (await ok(db, U.seller, 'conv.create', { type: 'group', title: 'Élèves', visibility: 'private' })).id;
    expect((await call(db, U.buyer, 'conv.join', { cid })).code).toBe(403);
    expect((await call(db, U.buyer, 'msg.list', { cid })).code).toBe(403);
    const { conv } = await ok(db, U.seller, 'conv.get', { cid });
    await ok(db, U.buyer, 'conv.join', { inviteCode: conv.inviteCode });
    const mid = (await ok(db, U.buyer, 'msg.send', { cid, text: 'Merci' })).id;
    // Modération : l'admin du groupe supprime, puis retire le membre.
    await ok(db, U.seller, 'msg.delete', { cid, mid });
    expect((await ok(db, U.seller, 'msg.list', { cid })).messages[0].deleted).toBe(true);
    await ok(db, U.seller, 'conv.remove', { cid, uid: U.buyer.uid, ban: true });
    expect((await call(db, U.buyer, 'conv.join', { inviteCode: conv.inviteCode })).code).toBe(403);
  });

  it('pièce jointe privée servie par lien signé aux seuls membres', async () => {
    const db = await setup();
    const cid = (await ok(db, U.buyer, 'conv.dm', { uid: U.seller.uid })).id;
    const photo = { id: `ac/${U.buyer.uid}/private/photo1`, rt: 'image', fmt: 'jpg' };
    await ok(db, U.buyer, 'msg.send', { cid, asset: photo });
    const msg = (await ok(db, U.seller, 'msg.list', { cid })).messages[0];
    expect(msg.media.kind).toBe('image');
    expect(msg.media.url).toContain('api.cloudinary.com/v1_1/asrarpro/image/download');
    expect((await call(db, U.buyer, 'msg.send', { cid, asset: { ...photo, id: `ac/${U.seller.uid}/private/x` } })).code).toBe(400);
  });

  it('signature d’envoi : dossier et type imposés', async () => {
    const db = await setup();
    const s = await ok(db, U.buyer, 'upload.sign', { visibility: 'private', rt: 'raw' });
    expect(s).toMatchObject({ folder: 'ac/buyer1/private', type: 'private', resourceType: 'raw' });
    expect(s.allowed_formats).toContain('pdf');
    expect(JSON.stringify(s)).not.toContain('secret');
    expect((await call(db, U.buyer, 'upload.sign', { visibility: 'public', rt: 'video' })).code).toBe(400);
  });
});

describe('Modération', () => {
  it('signalement d’un message privé : copie du seul message, retrait et suspension', async () => {
    const db = await setup();
    const cid = (await ok(db, U.other, 'conv.dm', { uid: U.buyer.uid })).id;
    const mid = (await ok(db, U.other, 'msg.send', { cid, text: 'Envoie-moi ton code Wave' })).id;
    await ok(db, U.buyer, 'report', { target: 'message', cid, mid, reason: 'fraud' });
    expect((await ok(db, U.buyer, 'report', { target: 'message', cid, mid, reason: 'fraud' })).duplicate).toBe(true);
    expect((await call(db, U.buyer, 'admin.reports')).code).toBe(403);
    const { reports } = await ok(db, U.admin, 'admin.reports');
    expect(reports).toHaveLength(1);
    expect(reports[0].snapshot.text).toBe('Envoie-moi ton code Wave');
    await ok(db, U.admin, 'admin.resolveReport', { rid: reports[0].id, decision: 'removeAndSuspend' });
    expect((await ok(db, U.buyer, 'msg.list', { cid })).messages[0].deleted).toBe(true);
    expect((await call(db, U.other, 'msg.send', { cid, text: 'retour' })).code).toBe(403);
    expect((await ok(db, U.other, 'me')).suspended).toBe(true);
  });

  it('profil créé automatiquement depuis le compte Google', async () => {
    const db = database({});
    const google = { uid: 'g1', email: 'Moussa.Diop@gmail.com', name: 'Moussa Diop', picture: 'https://lh3.googleusercontent.com/a/photo=s96' };
    const first = await ok(db, google, 'me');
    expect(first.profile).toMatchObject({ handle: 'moussa_diop', displayName: 'Moussa Diop', photo: google.picture });
    expect(db.read('ac_handles/moussa_diop')).toBe('g1');
    // Même début d'e-mail : pseudonyme rendu unique.
    const twin = await ok(db, { uid: 'g2', email: 'moussa.diop@yahoo.fr', name: 'Autre', picture: 'https://evil.example/x.png' }, 'me');
    expect(twin.profile.handle).toMatch(/^moussa_diop_\d+$/);
    expect(twin.profile.photo).toBe('');
    expect((await ok(db, google, 'me')).profile.handle).toBe('moussa_diop');
  });

  it('l’administration ne voit un contenu payant qu’en vue modération', async () => {
    const db = await setup();
    const pid = await publishVideo(db);
    expect((await ok(db, U.admin, 'post.open', { pid })).content).toBeUndefined();
    const moderated = await ok(db, U.admin, 'post.open', { pid, moderation: true });
    expect(moderated.content.text).toBe('Notes privées du cours');
    expect(moderated.post.moderation).toBe(true);
    // Un compte ordinaire ne peut pas s'attribuer la vue modération.
    expect((await ok(db, U.other, 'post.open', { pid, moderation: true })).content).toBeUndefined();
    // Dans une discussion, la carte reste verrouillée pour l'administration.
    const ch = (await ok(db, U.seller, 'conv.create', { type: 'channel', title: 'Chaîne', visibility: 'public' })).id;
    await ok(db, U.seller, 'msg.send', { cid: ch, postId: pid });
    expect((await ok(db, U.admin, 'msg.list', { cid: ch })).messages[0].post.unlocked).toBe(false);
  });

  it('pseudonyme unique', async () => {
    const db = await setup();
    expect((await call(db, U.other, 'profile.save', { handle: 'vendeur', displayName: 'Copie' })).code).toBe(409);
  });
});
