import { describe, it, expect } from 'vitest';
import { DAILY_CONTENT, dailyContentIndex, contentForDate, todayContent, pushBody } from './dailyContent';

describe('DAILY_CONTENT', () => {
  it('chaque élément a un id unique, un texte et une source', () => {
    const ids = new Set();
    for (const item of DAILY_CONTENT) {
      expect(item.id).toBeTruthy();
      expect(ids.has(item.id)).toBe(false);
      ids.add(item.id);
      expect(item.text).toBeTruthy();
      expect(item.source).toBeTruthy();
      expect(['verset', 'hadith', 'dua']).toContain(item.type);
    }
  });
});

describe('dailyContentIndex / contentForDate', () => {
  it('est déterministe pour une même clé de date', () => {
    expect(dailyContentIndex('2026-01-15')).toBe(dailyContentIndex('2026-01-15'));
    expect(contentForDate('2026-01-15')).toBe(contentForDate('2026-01-15'));
  });

  it('reste dans les bornes du tableau', () => {
    for (const key of ['2026-01-01', '2026-06-15', '2030-12-31', '1999-01-01']) {
      const idx = dailyContentIndex(key);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(DAILY_CONTENT.length);
    }
  });

  it('varie généralement d’un jour à l’autre (pas une constante)', () => {
    const a = dailyContentIndex('2026-01-15');
    const b = dailyContentIndex('2026-01-16');
    // Pas une garantie absolue (collision possible), mais sur deux jours
    // consécutifs avec une liste de cette taille, une égalité serait
    // suspecte plutôt qu'attendue.
    expect(a === b && DAILY_CONTENT.length > 1).toBe(false);
  });
});

describe('todayContent', () => {
  it('choisit le même contenu que contentForDate pour la clé UTC du jour', () => {
    const now = new Date('2026-03-10T12:00:00Z');
    expect(todayContent(now)).toBe(contentForDate('2026-03-10'));
  });
});

describe('pushBody', () => {
  it('renvoie le texte tel quel s’il est déjà court', () => {
    expect(pushBody({ text: 'Court.' })).toBe('Court.');
  });

  it('tronque proprement un texte trop long, avec une ellipse', () => {
    const long = 'a'.repeat(200);
    const body = pushBody({ text: long });
    expect(body.length).toBeLessThanOrEqual(140);
    expect(body.endsWith('…')).toBe(true);
  });
});
