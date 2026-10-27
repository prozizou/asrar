import { describe, it, expect } from 'vitest';
import { database, runtime, invoke } from './support/runtime';

describe('Progression et adhésion Zikr', () => {
  function fixture() {
    return database({ zikr_groups: { g1: { total: 100, membersCount: 1, ownerUid: 'tester' } },
      zikr_members: { g1: { tester: { fait: 100, lastSeenAt: Date.now() } } } });
  }
  it('ne compte qu’une fois les mêmes récitations envoyées simultanément', async () => {
    const db = fixture();
    const { recordProgress } = runtime(db)('server/zikrProgress.js');
    await Promise.all(Array.from({ length: 5 }, () => recordProgress(db, 'g1', 'tester', 110, 1)));
    expect(db.read('zikr_members/g1/tester/fait')).toBe(110);
    expect(db.read('zikr_groups/g1/total')).toBe(110);
    expect(db.read('zikr_members/g1/tester/daily/total')).toBe(10);
  });
  it('préserve le maximum si un ancien appareil répond après un nouveau', async () => {
    const db = fixture();
    const { recordProgress } = runtime(db)('server/zikrProgress.js');
    await Promise.all([recordProgress(db, 'g1', 'tester', 130, 1), recordProgress(db, 'g1', 'tester', 110, 1)]);
    expect(db.read('zikr_members/g1/tester/fait')).toBe(130);
    expect(db.read('zikr_groups/g1/total')).toBe(130);
  });
  it('rattrape une panne entre l’enregistrement du membre et le total', async () => {
    const db = fixture();
    const { recordProgress } = runtime(db)('server/zikrProgress.js');
    db.failNext('zikr_groups/g1', 'transaction');
    await expect(recordProgress(db, 'g1', 'tester', 110, 1)).rejects.toThrow();
    expect(db.read('zikr_groups/g1/total')).toBe(100);
    await recordProgress(db, 'g1', 'tester', 110, 1);
    expect(db.read('zikr_groups/g1/total')).toBe(110);
  });
  it('ne ressuscite pas un participant supprimé', async () => {
    const db = fixture();
    await db.ref('zikr_members/g1/tester').remove();
    const { recordProgress } = runtime(db)('server/zikrProgress.js');
    await expect(recordProgress(db, 'g1', 'tester', 110, 1)).rejects.toMatchObject({ statusCode: 403 });
    expect(db.read('zikr_groups/g1/total')).toBe(100);
  });
  it('compte une nouvelle adhésion sans effacer la contribution historique', async () => {
    const db = fixture();
    const { recordProgress } = runtime(db)('server/zikrProgress.js');
    await recordProgress(db, 'g1', 'tester', 110, 1);
    await db.ref('zikr_members/g1/tester').set({ fait: 0, joinedAt: Date.now() });
    await recordProgress(db, 'g1', 'tester', 10, 1);
    expect(db.read('zikr_groups/g1/total')).toBe(120);
  });
  it('une double approbation ne crée qu’un membre et qu’une unité de compteur', async () => {
    const db = fixture();
    await db.ref('zikr_requests/g1/guest').set({ email: 'guest@example.invalid' });
    const { approveMember } = runtime(db)('server/zikrMembership.js');
    await Promise.all([approveMember(db, 'g1', 'guest'), approveMember(db, 'g1', 'guest')]);
    expect(Object.keys(db.read('zikr_members/g1'))).toHaveLength(2);
    expect(db.read('zikr_groups/g1/membersCount')).toBe(2);
    await approveMember(db, 'g1', 'guest');
    expect(db.read('zikr_groups/g1/membersCount')).toBe(2);
  });
});

describe('Parrainage : octroi et reprise', () => {
  const user = { uid: 'tester', email: 'tester@example.invalid' };
  const id = 'conversion-fixture-0001';
  it('ne ressuscite pas le forfait premium expiré', async () => {
    const db = database({ referrals: { tester: { points: 1000 } }, purchased_user: {
      'tester@example,invalid': { token: 'legacy', level: 45000, expiresAt: Date.now() - 1000 },
    } });
    const load = runtime(db);
    await load('server/referralRedemption.js').redeemReferral(db, user, id);
    const { effectiveAccess } = load('lib/accessStatus.js');
    expect(effectiveAccess(db.read('purchased_user/tester@example,invalid'), null).level).toBe(15000);
  });
  it('une double requête utilise un seul débit, un seul octroi et un seul historique', async () => {
    const db = database({ referrals: { tester: { points: 2000 } } });
    const { redeemReferral } = runtime(db)('server/referralRedemption.js');
    const results = await Promise.all([redeemReferral(db, user, id), redeemReferral(db, user, id)]);
    expect(results[0].expiresAt).toBe(results[1].expiresAt);
    expect(db.read('referrals/tester/points')).toBe(1000);
    expect(db.read('referrals/tester/rewards')).toBe(1);
    expect(Object.keys(db.read('purchases/tester'))).toHaveLength(1);
    await redeemReferral(db, user, id); // réponse perdue puis réessai
    expect(db.read('referrals/tester/points')).toBe(1000);
  });
  it('une panne après octroi laisse les points réservés et le même octroi est repris', async () => {
    const db = database({ referrals: { tester: { points: 1000 } } });
    const { redeemReferral } = runtime(db)('server/referralRedemption.js');
    db.failNext(`purchases/tester/REF-${id}`, 'set');
    await expect(redeemReferral(db, user, id)).rejects.toThrow();
    const first = db.read('purchased_user/tester@example,invalid/referralAccess/expiresAt');
    expect(db.read('referrals/tester/points')).toBe(0);
    expect(db.read('referrals/tester/pendingRedemption/id')).toBe(id);
    await redeemReferral(db, user, id);
    expect(db.read('purchased_user/tester@example,invalid/referralAccess/expiresAt')).toBe(first);
    expect(db.read('referrals/tester/rewards')).toBe(1);
    expect(db.read('referrals/tester/pendingRedemption')).toBeNull();
  });
  it('mémorise les deux identifiants si deux appareils rejoignent la même conversion', async () => {
    const db = database({ referrals: { tester: { points: 2000 } } });
    const { redeemReferral } = runtime(db)('server/referralRedemption.js');
    await Promise.all([redeemReferral(db, user, id), redeemReferral(db, user, 'conversion-other-0002')]);
    await redeemReferral(db, user, 'conversion-other-0002');
    expect(db.read('referrals/tester/points')).toBe(1000);
    expect(db.read('referrals/tester/rewards')).toBe(1);
  });
  it('restitue une seule fois une réservation refusée pour accès à vie', async () => {
    const db = database({ referrals: { tester: { points: 1000 } },
      purchased_user: { 'tester@example,invalid': { token: 'lifetime', expiresAt: 'lifetime' } } });
    const { redeemReferral } = runtime(db)('server/referralRedemption.js');
    const results = await Promise.allSettled([redeemReferral(db, user, id), redeemReferral(db, user, id)]);
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(db.read('referrals/tester/points')).toBe(1000);
  });
});

describe('Crédit de filleul : déduplication et reprise', () => {
  it('crédite une seule fois le parrain malgré des demandes concurrentes', async () => {
    const db = database();
    const { claimReferral } = runtime(db)('server/referralClaim.js');
    await Promise.all([claimReferral(db, 'guest', 'tester', async () => true), claimReferral(db, 'guest', 'tester', async () => true)]);
    expect(db.read('referrals/tester/points')).toBe(10);
    expect(db.read('referrals/tester/invited')).toBe(1);
  });
  it('reprend après une panne de marquage sans créditer à nouveau les points', async () => {
    const db = database();
    const { claimReferral } = runtime(db)('server/referralClaim.js');
    db.failNext('referred/guest', 'update');
    await expect(claimReferral(db, 'guest', 'tester', async () => true)).rejects.toThrow();
    await claimReferral(db, 'guest', 'tester', async () => { throw new Error('L’éligibilité a déjà été vérifiée.'); });
    expect(db.read('referrals/tester/points')).toBe(10);
    expect(db.read('referred/guest/credited')).toBe(true);
  });
  it('une panne Auth ne bloque pas définitivement la demande', async () => {
    const db = database();
    const { claimReferral } = runtime(db)('server/referralClaim.js');
    await expect(claimReferral(db, 'guest', 'tester', async () => { throw new Error('Auth indisponible'); })).rejects.toThrow();
    expect(db.read('referred/guest')).toBeNull();
    await claimReferral(db, 'guest', 'tester', async () => true);
    expect(db.read('referrals/tester/points')).toBe(10);
  });
});

describe('Notifications : lecture, arrivée et purge', () => {
  it('le badge reste cohérent après deux lectures concurrentes', async () => {
    const db = database({ notifications: { tester: { n1: { read: false }, n2: { read: false } } },
      notifications_meta: { tester: { unread: 99 } } });
    const handler = runtime(db)('pages/api/notifications.js').default;
    await Promise.all([invoke(handler, { action: 'markRead', notifId: 'n1' }), invoke(handler, { action: 'markRead', notifId: 'n1' })]);
    expect((await invoke(handler, { action: 'list' })).body.unread).toBe(1);
  });
  it('la purge conserve exactement 200 notifications avec un badge de 200', async () => {
    const db = database({ notifications: { tester: Object.fromEntries(Array.from({ length: 201 }, (_, i) =>
      ['n' + i, { read: false, createdAt: i }])) } });
    const load = runtime(db);
    await load('server/notificationStore.js').storeNotification(db, 'tester', { read: false, createdAt: 500 });
    expect(Object.keys(db.read('notifications/tester'))).toHaveLength(200);
    const result = await invoke(load('pages/api/notifications.js').default, { action: 'list' });
    expect(result.body.unread).toBe(200);
    expect(result.body.items).toHaveLength(50);
  });
});
