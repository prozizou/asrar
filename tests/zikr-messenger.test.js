import { describe, expect, it } from 'vitest';
import { database, runtime, invoke } from './support/runtime';
function fixture(extra = {}) {
  const db = database({ zikr_groups: { g: { name: 'Groupe A', ownerUid: 'tester' }, h: { name: 'Groupe B', ownerUid: 'tester' } },
    zikr_members: { g: { tester: { fait: 0 }, other: { fait: 0 } }, h: { tester: { fait: 0 } } },
    zikr_chat: { g: { m1: { uid: 'tester', email: 'tester@example.invalid', text: 'Original confidentiel', at: 1 }, m2: { uid: 'other', text: 'Bonjour', at: 2 }, vocal: { uid: 'tester', text: '', mediaType: 'audio', mediaUrl: 'https://res.cloudinary.com/fixture/video/upload/vocal.webm', at: 3 } } }, ...extra });
  const call = (body, uid = 'tester') => invoke(runtime(db, { user: { uid, email: uid + '@example.invalid', name: uid === 'other' ? 'Autre membre' : 'Auteur' } })('pages/api/zikr.js').default, { groupId: 'g', ...body });
  return { db, call };
}
describe('messagerie Zikr : autorité serveur et historique', () => {
  it('refuse les actions à un non-membre ou à un membre en cours de retrait', async () => {
    const { db, call } = fixture();
    for (const action of ['messages', 'sendMessage', 'readMessages', 'deleteMessage', 'editMessage', 'reactMessage', 'messageReaders', 'forwardMessage']) {
      expect((await call({ action, text: 'Non', messageId: 'm1', targetGroupId: 'h', messageIds: ['m1'] }, 'outsider')).code).toBe(403);
    }
    await db.ref('zikr_members/g/other/removalId').set('removed');
    expect((await call({ action: 'messages' }, 'other')).code).toBe(403);
  });
  it('résout les réponses depuis le groupe et ne conserve aucun texte cité après suppression', async () => {
    const { db, call } = fixture();
    const sent = await call({ action: 'sendMessage', text: 'Réponse', replyTo: 'm1', reply: { text: 'Faux' } }, 'other');
    expect(sent.code).toBe(200);
    const stored = db.read(`zikr_chat/g/${sent.body.id}`);
    expect(stored.replyTo).toBe('m1'); expect(stored.reply).toBeUndefined();
    let list = (await call({ action: 'messages', withChanges: true })).body;
    expect(list.messages.find((m) => m.id === sent.body.id).reply.text).toBe('Original confidentiel');
    expect((await call({ action: 'deleteMessage', messageId: 'm1' })).code).toBe(200);
    list = (await call({ action: 'messages', withChanges: true })).body;
    expect(list.messages.find((m) => m.id === sent.body.id).reply).toEqual({ id: 'm1', deleted: true });
    expect(JSON.stringify(list)).not.toContain('Original confidentiel');
    expect(JSON.stringify(db.read('zikr_chat_changes'))).not.toContain('Original confidentiel');
    expect((await call({ action: 'sendMessage', text: 'Réponse', replyTo: 'm1' })).code).toBe(409);
  });
  it('réserve édition et suppression à l’auteur, même si le demandeur possède le groupe', async () => {
    const { call } = fixture();
    expect((await call({ action: 'editMessage', messageId: 'm2', text: 'Modifié' })).code).toBe(403);
    expect((await call({ action: 'deleteMessage', messageId: 'm2' })).code).toBe(403);
    expect((await call({ action: 'editMessage', messageId: 'm1', text: 'Correction' })).code).toBe(200);
    expect((await call({ action: 'deleteMessage', messageId: 'm1' })).code).toBe(200);
    expect((await call({ action: 'editMessage', messageId: 'm1', text: 'Résurrection' })).code).toBe(409);
  });
  it('conserve une suppression lors d’une course avec une édition', async () => {
    const { db, call } = fixture();
    await Promise.all([call({ action: 'editMessage', messageId: 'm1', text: 'Correction' }), call({ action: 'deleteMessage', messageId: 'm1' })]);
    expect(db.read('zikr_chat/g/m1')).toMatchObject({ deleted: true, text: '' });
  });
  it('répare le signal de suppression après une panne sans ressusciter le contenu', async () => {
    const { db, call } = fixture();
    db.failNext('zikr_chat_changes/g/generated00000001', 'set');
    expect((await call({ action: 'deleteMessage', messageId: 'm1' })).code).toBe(500);
    expect(db.read('zikr_chat/g/m1').deleted).toBe(true);
    expect((await call({ action: 'deleteMessage', messageId: 'm1' })).code).toBe(200);
    expect(db.read('zikr_chat_changes/g/generated00000001')).toEqual({ id: 'm1' });
  });
  it('copie le contenu réel lors du transfert et exige les deux appartenances', async () => {
    const { db, call } = fixture();
    const sent = await call({ action: 'forwardMessage', messageId: 'm2', targetGroupId: 'h', text: 'Fausse copie', mediaUrl: 'https://evil.invalid' });
    expect(sent.code).toBe(200);
    const stored = db.read(`zikr_chat/h/${sent.body.id}`);
    expect(stored).toMatchObject({ text: 'Bonjour', uid: 'tester', forwarded: true });
    expect(stored).not.toHaveProperty('sourceGroupId'); expect(stored).not.toHaveProperty('sourceUid');
    expect((await call({ action: 'forwardMessage', messageId: 'm2', targetGroupId: 'h' }, 'other')).code).toBe(403);
  });
  it('ne marque pas la discussion lue lors de sa simple récupération', async () => {
    const { db, call } = fixture();
    await call({ action: 'messages' }, 'other');
    expect(db.read('zikr_chat_reads')).toBeNull();
    await call({ action: 'readMessages', messageIds: ['m1', 'm2'] }, 'other');
    const first = db.read('zikr_chat_reads/g/m1/other');
    expect(first.name).toBe('Autre membre'); expect(first.at).toBeGreaterThan(0);
    expect(db.read('zikr_chat_reads/g/m2/other')).toBeNull();
    await call({ action: 'readMessages', messageIds: ['m1'] }, 'other');
    expect(db.read('zikr_chat_reads/g/m1/other').at).toBe(first.at);
    expect(db.read('zikr_chat_read_counts/g/tester/m1')).toEqual({ other: true });
    expect((await call({ action: 'messageReaders', messageId: 'm1' }, 'other')).code).toBe(403);
    const info = (await call({ action: 'messageReaders', messageId: 'm1' })).body;
    expect(info.readers).toHaveLength(1); expect(info.readers[0]).not.toHaveProperty('email');
  });
  it('distingue voir un vocal et terminer sa lecture', async () => {
    const { db, call } = fixture();
    await call({ action: 'readMessages', messageIds: ['vocal'] }, 'other');
    expect(db.read('zikr_chat_reads/g/vocal/other').playedAt).toBeUndefined();
    await call({ action: 'readMessages', messageIds: ['vocal'], kind: 'played' }, 'other');
    expect(db.read('zikr_chat_reads/g/vocal/other').playedAt).toBeGreaterThan(0);
  });
  it('ne permet qu’une réaction par membre et conserve les réactions des autres', async () => {
    const { db, call } = fixture();
    await call({ action: 'reactMessage', messageId: 'm1', emoji: '👍', uid: 'tester' }, 'other');
    await call({ action: 'reactMessage', messageId: 'm1', emoji: '❤️' });
    expect(db.read('zikr_chat/g/m1/reactions')).toEqual({ other: '👍', tester: '❤️' });
    await call({ action: 'reactMessage', messageId: 'm1', emoji: '🤲' }, 'other');
    await call({ action: 'editMessage', messageId: 'm1', text: 'Corrigé' });
    expect(db.read('zikr_chat/g/m1/reactions')).toEqual({ other: '🤲', tester: '❤️' });
    await call({ action: 'reactMessage', messageId: 'm1', emoji: '🤲' }, 'other');
    expect(db.read('zikr_chat/g/m1/reactions')).toEqual({ tester: '❤️' });
    expect((await call({ action: 'reactMessage', messageId: 'm1', emoji: 'arbitraire' })).code).toBe(400);
  });
  it('pagine l’historique sans doublons et livre tous les nouveaux messages dans l’ordre', async () => {
    const messages = Object.fromEntries(Array.from({ length: 80 }, (_, index) => ['m' + String(index).padStart(3, '0'), { uid: 'tester', text: String(index), at: index }]));
    const { call } = fixture({ zikr_chat: { g: messages } });
    const latest = (await call({ action: 'messages', limit: 20 })).body;
    expect(latest.messages.map((m) => m.id)).toEqual(Object.keys(messages).slice(-20));
    const older = (await call({ action: 'messages', limit: 20, before: latest.messages[0].id })).body;
    expect(older.messages.map((m) => m.id)).toEqual(Object.keys(messages).slice(-40, -20));
    const next = (await call({ action: 'messages', limit: 20, after: 'm019' })).body;
    expect(next.messages.map((m) => m.id)).toEqual(Object.keys(messages).slice(20, 40));
  });
});
