import { expect, it } from 'vitest';
import { mergeChatMessages } from './chatMessages';
it('respecte l’ordre Firebase des clés, y compris majuscules, minuscules et soulignement', () => {
  const messages = ['-keya', '-key_', '-keyZ', '-key0'].map((id) => ({ id }));
  expect(mergeChatMessages([], messages).map((message) => message.id)).toEqual(['-key0', '-keyZ', '-key_', '-keya']);
});
it('ne ressuscite ni le texte ni un média après une réponse réseau arrivée en retard', () => {
  const tombstone = { id: 'm', version: 2, deleted: true, text: '' };
  const old = { id: 'm', version: 1, text: 'ancien', mediaUrl: 'ancienne-image' };
  expect(mergeChatMessages([tombstone], [old])).toEqual([tombstone]);
  expect(mergeChatMessages([old], [tombstone])).toEqual([tombstone]);
});
