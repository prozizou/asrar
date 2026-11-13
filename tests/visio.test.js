// Visioconférences Google Meet : proposées par les utilisateurs, validées par
// l'administration (pages/api/visio.js, lib/visioLogic.js).
import { afterEach, describe, it, expect, vi } from 'vitest';
import { database, runtime, invoke } from './support/runtime';
import { normalizeMeetUrl, normalizeMeetingInput, meetingPhase, isListed } from '../lib/visioLogic';

afterEach(() => vi.unstubAllEnvs());

const HOUR = 3600 * 1000;
const member = { uid: 'member', email: 'member@example.test', name: 'Membre' };
const other = { uid: 'other', email: 'other@example.test' };
const admin = { uid: 'boss', email: 'boss@example.test' };
const baseDb = (extra = {}) => database({ admins: { 'boss@example,test': true, boss_example_test: true }, ...extra });
const api = (db, user) => runtime(db, { user, stubs: { 'server/access.js': {
  verifyUser: async () => ({ ...user, email_verified: true }),
  isAdmin: async (u) => u.uid === admin.uid,
} } })('pages/api/visio.js').default;
const meeting = (over = {}) => ({ title: 'Cours du soir', description: 'Sujet', meetUrl: 'https://meet.google.com/abc-defg-hij', startAt: Date.now() + 2 * HOUR, durationMin: 60, ...over });

describe('Lien Google Meet', () => {
  it.each([
    ['https://meet.google.com/abc-defg-hij', 'https://meet.google.com/abc-defg-hij'],
    ['meet.google.com/ABC-DEFG-HIJ?authuser=0', 'https://meet.google.com/abc-defg-hij'],
    ['abc-defg-hij', 'https://meet.google.com/abc-defg-hij'],
    ['  https://meet.google.com/abc-defg-hij/  ', 'https://meet.google.com/abc-defg-hij'],
  ])('accepte %s', (input, expected) => expect(normalizeMeetUrl(input)).toBe(expected));

  it.each([
    'https://evil.example/abc-defg-hij',
    'https://meet.google.com.evil.example/abc-defg-hij',
    'https://user@meet.google.com/abc-defg-hij',
    'https://meet.google.com:8443/abc-defg-hij',
    'javascript:alert(1)',
    'https://meet.google.com/',
    'https://meet.google.com/abc-defg-hij/../../redirect',
    'https://zoom.us/j/123',
    '',
  ])('refuse %s', (input) => expect(normalizeMeetUrl(input)).toBe(''));

  it('valide date, durée et titre', () => {
    const now = Date.now();
    expect(normalizeMeetingInput(meeting({ title: '  ' }), now).error).toBe('title');
    expect(normalizeMeetingInput(meeting({ startAt: now - 2 * HOUR }), now).error).toBe('past');
    expect(normalizeMeetingInput(meeting({ startAt: now + 100 * 24 * HOUR }), now).error).toBe('horizon');
    expect(normalizeMeetingInput(meeting({ durationMin: 5 }), now).error).toBe('duration');
    expect(normalizeMeetingInput(meeting(), now).value).toMatchObject({ title: 'Cours du soir', durationMin: 60 });
  });

  it('calcule la phase et la fin d’affichage', () => {
    const start = 10 * HOUR, m = { startAt: start, durationMin: 60 };
    expect(meetingPhase(m, start - HOUR)).toBe('upcoming');
    expect(meetingPhase(m, start - 5 * 60000)).toBe('soon');
    expect(meetingPhase(m, start + 60000)).toBe('live');
    expect(meetingPhase(m, start + 2 * HOUR)).toBe('ended');
    expect(isListed(m, start + HOUR + 30 * 60000)).toBe(true);
    expect(isListed(m, start + 3 * HOUR)).toBe(false);
  });
});

describe('API /api/visio', () => {
  it('une proposition reste invisible des autres jusqu’à la validation, puis tous sont notifiés', async () => {
    const db = baseDb();
    const created = await invoke(api(db, member), { action: 'create', ...meeting() });
    expect(created.code).toBe(200);
    const id = created.body.id;
    expect(db.read('visio_meetings/' + id + '/approved')).toBe(false);

    expect((await invoke(api(db, other), { action: 'list' })).body.meetings).toHaveLength(0);
    const mine = (await invoke(api(db, member), { action: 'list' })).body.meetings;
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ mine: true, approved: false, meetUrl: 'https://meet.google.com/abc-defg-hij' });
    expect(mine[0].ownerEmail).toBeUndefined();

    // Un utilisateur ne peut pas s'auto-approuver.
    expect((await invoke(api(db, member), { action: 'approve', meetingId: id })).code).toBe(403);
    expect(db.read('notification_jobs')).toBeNull();

    const moderation = (await invoke(api(db, admin), { action: 'list' })).body;
    expect(moderation.isAdmin).toBe(true);
    expect(moderation.meetings[0]).toMatchObject({ approved: false, ownerEmail: 'member@example.test' });

    expect((await invoke(api(db, admin), { action: 'approve', meetingId: id })).code).toBe(200);
    expect(db.read('visio_meetings/' + id + '/approved')).toBe(true);
    const jobs = Object.values(db.read('notification_jobs') || {});
    expect(jobs).toHaveLength(1);
    expect(JSON.stringify(jobs[0])).toContain('Nouvelle visioconférence');

    // Approbation répétée : pas de seconde diffusion.
    await invoke(api(db, admin), { action: 'approve', meetingId: id });
    expect(Object.keys(db.read('notification_jobs'))).toHaveLength(1);

    const seen = (await invoke(api(db, other), { action: 'list' })).body.meetings;
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ title: 'Cours du soir', mine: false, meetUrl: 'https://meet.google.com/abc-defg-hij' });
  });

  it('refuse un lien qui n’est pas Google Meet', async () => {
    const db = baseDb();
    const r = await invoke(api(db, member), { action: 'create', ...meeting({ meetUrl: 'https://phishing.example/login' }) });
    expect(r.code).toBe(400);
    expect(db.read('visio_meetings')).toBeNull();
  });

  it('une modification par le créateur repasse en validation', async () => {
    const db = baseDb();
    const id = (await invoke(api(db, member), { action: 'create', ...meeting() })).body.id;
    await invoke(api(db, admin), { action: 'approve', meetingId: id });
    const r = await invoke(api(db, member), { action: 'update', meetingId: id, ...meeting({ meetUrl: 'xyz-abcd-efg' }) });
    expect(r.body).toMatchObject({ ok: true, approved: false });
    expect(db.read('visio_meetings/' + id)).toMatchObject({ approved: false, meetUrl: 'https://meet.google.com/xyz-abcd-efg' });
    expect((await invoke(api(db, other), { action: 'list' })).body.meetings).toHaveLength(0);
  });

  it('seuls le créateur et l’administrateur modifient ou suppriment', async () => {
    const db = baseDb();
    const id = (await invoke(api(db, member), { action: 'create', ...meeting() })).body.id;
    expect((await invoke(api(db, other), { action: 'update', meetingId: id, ...meeting({ title: 'Piratée' }) })).code).toBe(403);
    expect((await invoke(api(db, other), { action: 'delete', meetingId: id })).code).toBe(403);
    expect(db.read('visio_meetings/' + id + '/title')).toBe('Cours du soir');
  });

  it('un refus de l’administrateur supprime la proposition et avertit son créateur', async () => {
    const db = baseDb();
    const id = (await invoke(api(db, member), { action: 'create', ...meeting() })).body.id;
    expect((await invoke(api(db, admin), { action: 'delete', meetingId: id })).code).toBe(200);
    expect(db.read('visio_meetings/' + id)).toBeNull();
    const jobs = Object.values(db.read('notification_jobs') || {});
    expect(jobs).toHaveLength(1);
    expect(JSON.stringify(jobs[0])).toContain('member');
    expect(JSON.stringify(jobs[0])).toContain('non retenue');
  });

  it('limite à trois visioconférences programmées par compte', async () => {
    const db = baseDb();
    for (let i = 0; i < 3; i++) expect((await invoke(api(db, member), { action: 'create', ...meeting() })).code).toBe(200);
    const fourth = await invoke(api(db, member), { action: 'create', ...meeting() });
    expect(fourth.code).toBe(400);
    expect(Object.keys(db.read('visio_meetings'))).toHaveLength(3);
  });

  it('efface les réunions terminées depuis plus d’un jour', async () => {
    const db = baseDb({ visio_meetings: { old: { title: 'Ancienne', startAt: Date.now() - 3 * 24 * HOUR, durationMin: 60, approved: true, ownerUid: 'x', meetUrl: 'https://meet.google.com/abc-defg-hij' } } });
    expect((await invoke(api(db, other), { action: 'list' })).body.meetings).toHaveLength(0);
    expect(db.read('visio_meetings/old')).toBeNull();
  });
});
