import { afterEach, expect, it, vi } from 'vitest';
import { getChatCache, putChatCache, clearChatCache } from './zikrChatLive';
afterEach(() => vi.useRealTimers());
it('isole le cache en mémoire par compte et par groupe, même si leurs clés contiennent un séparateur', () => {
  putChatCache('a:b', 'c', [{ id: 'private' }]);
  expect(getChatCache('a', 'b:c')).toEqual([]);
  expect(getChatCache('a:b', 'c')).toEqual([{ id: 'private' }]);
  clearChatCache('a:b', 'c'); expect(getChatCache('a:b', 'c')).toEqual([]);
});
it('expire le cache et borne le nombre de conversations et de messages', () => {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  for (let i = 0; i < 6; i++) putChatCache('u', 'g' + i, Array.from({ length: 80 }, (_, id) => ({ id })));
  expect(getChatCache('u', 'g0')).toEqual([]); expect(getChatCache('u', 'g5')).toHaveLength(50);
  vi.setSystemTime(140000); expect(getChatCache('u', 'g5')).toEqual([]);
});
