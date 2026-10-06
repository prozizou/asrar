import { describe, it, expect } from 'vitest';
import { loadHistory, addHistoryEntry, removeHistoryEntry, clearHistory, HISTORY_KEY, HISTORY_MAX } from './geomancieHistory';

function fakeStorage(init = {}) {
  const m = { ...init };
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, raw: m };
}
const mothers = (n) => [1, 2, 3, 4].map((i) => [1 + ((n >> i) & 1), 1 + ((n >> (i + 1)) & 1), 1 + (n & 1), 2]);

describe('historique des écus', () => {
  it('démarre vide, tolère un contenu invalide', () => {
    expect(loadHistory(fakeStorage())).toEqual([]);
    expect(loadHistory(fakeStorage({ [HISTORY_KEY]: 'pas du json' }))).toEqual([]);
    expect(loadHistory(fakeStorage({ [HISTORY_KEY]: '[{"id":1}]' }))).toEqual([]);
    expect(loadHistory(null)).toEqual([]);
  });

  it('ajoute en tête et relit', () => {
    const s = fakeStorage();
    addHistoryEntry({ mothers: mothers(1), judge: 'Youssouf', even: true, at: 1000 }, s);
    const list = addHistoryEntry({ mothers: mothers(2), judge: 'Adama', even: false, at: 2000 }, s);
    expect(list.map((e) => e.judge)).toEqual(['Adama', 'Youssouf']);
    expect(loadHistory(s)).toEqual(list);
  });

  it('un même jeu de Mères remplace l\'entrée précédente (remonte en tête)', () => {
    const s = fakeStorage();
    addHistoryEntry({ mothers: mothers(1), judge: 'A', at: 1 }, s);
    addHistoryEntry({ mothers: mothers(2), judge: 'B', at: 2 }, s);
    const list = addHistoryEntry({ mothers: mothers(1), judge: 'A2', at: 3 }, s);
    expect(list.map((e) => e.judge)).toEqual(['A2', 'B']);
  });

  it('plafonne à HISTORY_MAX', () => {
    const s = fakeStorage();
    for (let n = 0; n < HISTORY_MAX + 5; n++) {
      addHistoryEntry({ mothers: [[1, 1, 1, n % 2 + 1], [1, 1, 2, (n >> 1) % 2 + 1], [1, 2, 1, (n >> 2) % 2 + 1], [2, 1, 1, (n >> 3) % 2 + 1]].map((m, i) => (i === 0 ? [1 + (n >> 4) % 2, ...m.slice(1)] : m)), at: n + 1 }, s);
    }
    expect(loadHistory(s).length).toBeLessThanOrEqual(HISTORY_MAX);
  });

  it('supprime une entrée / vide tout', () => {
    const s = fakeStorage();
    const [a] = addHistoryEntry({ mothers: mothers(1), at: 1 }, s);
    addHistoryEntry({ mothers: mothers(2), at: 2 }, s);
    expect(removeHistoryEntry(a.id, s).length).toBe(1);
    expect(clearHistory(s)).toEqual([]);
    expect(loadHistory(s)).toEqual([]);
  });

  it('ignore un stockage qui lève une erreur', () => {
    const broken = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    expect(() => addHistoryEntry({ mothers: mothers(1) }, broken)).not.toThrow();
    expect(loadHistory(broken)).toEqual([]);
  });
});
