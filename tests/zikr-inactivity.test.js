import { describe, it, expect } from 'vitest';
import { database, runtime, invoke } from './support/runtime';
import { ZIKR_WARNING_GRACE_MS, zikrWarningMessage } from '../lib/zikrWarning';

const start = 1700000000000, end = start + ZIKR_WARNING_GRACE_MS + 1;
function fixture() {
  const db = database({ zikr_groups: { g: { ownerUid: 'tester', name: 'Récitation', arabic: 'لا إله إلا الله', target: 1000, total: 120, membersCount: 2 } },
    zikr_members: { g: { tester: { fait: 100 }, guest: { fait: 20, email: 'guest@example.invalid', phone: '+221770000000' } } } });
  const load = runtime(db);
  return { db, load, ...load('server/zikrInactivity.js') };
}

describe('Avertissement et retrait du Zikr', () => {
  it('prépare un message avec la méthode, le total atteint et le reste collectif', () => {
    const text = zikrWarningMessage({ name: 'Groupe', arabic: 'الله', target: 1000, total: 120 }, { name: 'Membre', fait: 20 });
    for (const part of ['Membre', 'الله', 'Méthode', '20 grains', '120 / 1', '880', '7 jours']) expect(text).toContain(part);
  });
  it('conserve la première échéance en cas de répétition', async () => {
    const { db, warnParticipant } = fixture();
    const a = await warnParticipant(db, 'g', 'guest', 'tester', 'Premier', start);
    const b = await warnParticipant(db, 'g', 'guest', 'tester', 'Deuxième', start + 1000);
    expect(b.id).toBe(a.id); expect(b.deadline).toBe(start + ZIKR_WARNING_GRACE_MS);
    expect(Object.keys(db.read('zikr_inactivity'))).toHaveLength(1);
  });
  it('ne retire pas avant sept jours et ne change pas le total déjà récité', async () => {
    const { db, warnParticipant, processZikrInactivity } = fixture();
    await warnParticipant(db, 'g', 'guest', 'tester', 'Avis', start);
    await processZikrInactivity(db, end - 1);
    expect(db.read('zikr_members/g/guest')).not.toBeNull();
    await Promise.all([processZikrInactivity(db, end), processZikrInactivity(db, end)]);
    expect(db.read('zikr_members/g/guest')).toBeNull();
    expect(db.read('zikr_members/g/tester')).not.toBeNull();
    expect(db.read('zikr_groups/g')).toMatchObject({ total: 120, membersCount: 1 });
  });
  it('une présence, un compteur inchangé ou un avertissement masqué ne suspend pas le délai', async () => {
    const { db, load, warnParticipant, processZikrInactivity } = fixture();
    await warnParticipant(db, 'g', 'guest', 'tester', 'Avis', start);
    await db.ref('zikr_members/g/guest/avertissement').remove();
    await load('server/zikrProgress.js').recordProgress(db, 'g', 'guest', 20, 0, end - 1);
    expect(db.read('zikr_members/g/guest/warning')).not.toBeNull();
    await processZikrInactivity(db, end);
    expect(db.read('zikr_members/g/guest')).toBeNull();
  });
  it('une vraie récitation annule le retrait et permet un nouvel avertissement indépendant', async () => {
    const { db, load, warnParticipant, processZikrInactivity } = fixture();
    const first = await warnParticipant(db, 'g', 'guest', 'tester', 'Avis', start);
    await load('server/zikrProgress.js').recordProgress(db, 'g', 'guest', 21, 1, end - 1);
    expect(db.read('zikr_members/g/guest/warning')).toBeNull();
    const second = await warnParticipant(db, 'g', 'guest', 'tester', 'Nouvel avis', end);
    expect(second.id).not.toBe(first.id);
    await processZikrInactivity(db, end + 1);
    expect(db.read('zikr_members/g/guest/warning/id')).toBe(second.id);
    expect(db.read('zikr_groups/g/total')).toBe(121);
  });
  it('reprend un retrait après panne sans recréer le membre ni décrémenter deux fois', async () => {
    const { db, load, warnParticipant, processZikrInactivity } = fixture();
    await warnParticipant(db, 'g', 'guest', 'tester', 'Avis', start);
    db.failNext('zikr_groups/g', 'transaction');
    await expect(processZikrInactivity(db, end)).rejects.toThrow();
    expect(db.read('zikr_members/g/guest/removalId')).toBeTruthy();
    await expect(load('server/zikrProgress.js').recordProgress(db, 'g', 'guest', 100, 1, end)).rejects.toMatchObject({ statusCode: 403 });
    await db.ref('zikr_requests/g/guest').set({ email: 'guest@example.invalid' });
    await expect(load('server/zikrMembership.js').approveMember(db, 'g', 'guest')).rejects.toMatchObject({ statusCode: 409 });
    await processZikrInactivity(db, end);
    await processZikrInactivity(db, end);
    expect(db.read('zikr_groups/g/membersCount')).toBe(1);
    expect(db.read('zikr_members/g/guest')).toBeNull();
  });
  it('reprend après une panne survenue après le décompte, même si le groupe vient de se terminer', async () => {
    const { db, warnParticipant, processZikrInactivity } = fixture();
    await warnParticipant(db, 'g', 'guest', 'tester', 'Avis', start);
    const ref = db.ref;
    let injected = false;
    db.ref = (path, ...args) => {
      const value = ref(path, ...args);
      if (path !== 'zikr_groups/g') return value;
      return { ...value, transaction: async (fn) => {
        const result = await value.transaction(fn);
        if (!injected && result.snapshot.val()?.membershipRemovals) {
          injected = true; db.failNext('zikr_members/g/guest', 'transaction');
        }
        return result;
      } };
    };
    await expect(processZikrInactivity(db, end)).rejects.toThrow();
    expect(db.read('zikr_groups/g/membersCount')).toBe(1);
    await db.ref('zikr_groups/g/total').set(1000);
    await processZikrInactivity(db, end);
    expect(db.read('zikr_groups/g/membersCount')).toBe(1);
    expect(db.read('zikr_members/g/guest')).toBeNull();
    expect(db.read('zikr_groups/g/total')).toBe(1000);
  });
  it('ne retire jamais le créateur ni un membre d’un groupe terminé', async () => {
    const { db, warnParticipant, processZikrInactivity } = fixture();
    await warnParticipant(db, 'g', 'guest', 'tester', 'Avis', start);
    await db.ref('zikr_groups/g/ownerUid').set('guest');
    await processZikrInactivity(db, end);
    expect(db.read('zikr_members/g/guest')).not.toBeNull();
    await db.ref('zikr_groups/g/ownerUid').set('tester');
    await warnParticipant(db, 'g', 'guest', 'tester', 'Avis', start);
    await db.ref('zikr_groups/g/total').set(1000);
    await processZikrInactivity(db, end);
    expect(db.read('zikr_members/g/guest')).not.toBeNull();
  });
  it('réserve les avertissements au créateur et protège le créateur lui-même', async () => {
    const { db, load } = fixture();
    const handler = load('pages/api/zikr.js').default;
    expect((await invoke(handler, { action: 'warn', groupId: 'g', uid: 'tester' })).code).toBe(400);
    expect((await invoke(runtime(db, { user: { uid: 'guest' } })('pages/api/zikr.js').default,
      { action: 'warn', groupId: 'g', uid: 'tester' })).code).toBe(403);
    expect((await invoke(handler, { action: 'warn', groupId: 'g', uid: 'guest', message: '  ' })).code).toBe(400);
    expect((await invoke(handler, { action: 'warn', groupId: 'g', uid: 'guest', message: 'Mon message' })).code).toBe(200);
  });
  it('la file est lue par échéance avec une taille bornée', async () => {
    const { db, processZikrInactivity } = fixture();
    await processZikrInactivity(db, end);
    expect(db.metrics.reads.find((read) => read.path === 'zikr_inactivity').query).toMatchObject({ order: 'deadline', first: 50 });
    expect(db.metrics.reads.some((read) => read.path === 'zikr_members')).toBe(false);
  });
});

it('ne persiste pas un avertissement si sa mise en file échoue', async () => {
  const { db, warnParticipant } = fixture();
  const ref = db.ref;
  db.ref = (path, ...args) => {
    const value = ref(path, ...args);
    return path.startsWith('zikr_inactivity/') ? { ...value, set: async () => { throw new Error('File indisponible'); } } : value;
  };
  await expect(warnParticipant(db, 'g', 'guest', 'tester', 'Avis', start)).rejects.toThrow();
  expect(db.read('zikr_members/g/guest/warning')).toBeNull();
});

it('traite les retraits même si un rappel de renouvellement échoue', async () => {
  const { db, load, warnParticipant } = fixture();
  await warnParticipant(db, 'g', 'guest', 'tester', 'Avis', start);
  db.failNext('purchased_user', 'read');
  const cron = load('pages/api/cron/reminders.js').default;
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'inactivity-test-secret';
  try {
    const response = await invoke((req, res) => cron({ ...req, headers: { authorization: 'Bearer inactivity-test-secret' } }, res));
    expect(response.code).toBe(500);
    expect(db.read('zikr_members/g/guest')).toBeNull();
    expect(db.read('zikr_groups/g/membersCount')).toBe(1);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previous;
  }
});

it('poursuit le lot suivant au-delà de cinquante échéances sans toucher aux grains', async () => {
  const { db, processZikrInactivity } = fixture();
  const members = { tester: { fait: 100 } }, jobs = {};
  for (let n = 0; n < 60; n++) {
    const id = 'batch-' + n, uid = 'member-' + n;
    members[uid] = { fait: 0, warning: { id, deadline: end - 1, fait: 0 } };
    jobs[id] = { id, uid, gid: 'g', deadline: end - 1 };
  }
  await db.ref('zikr_members/g').set(members);
  await db.ref('zikr_groups/g/membersCount').set(61);
  await db.ref('zikr_inactivity').set(jobs);
  expect((await processZikrInactivity(db, end)).removed).toBe(60);
  expect(db.read('zikr_groups/g')).toMatchObject({ membersCount: 1, total: 120 });
  expect(Object.keys(db.read('zikr_members/g'))).toEqual(['tester']);
});
