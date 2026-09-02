import { describe, it, expect } from 'vitest';
import { normalizeText, searchSymbols, analyzeDream } from './tafsirLogic';
import { TAFSIR_CORPUS } from './tafsirCorpus';

describe('TAFSIR_CORPUS', () => {
  it('a des ids uniques et des mots-clés non vides pour chaque entrée', () => {
    const ids = TAFSIR_CORPUS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of TAFSIR_CORPUS) {
      expect(e.label).toBeTruthy();
      expect(e.interpretation).toBeTruthy();
      expect(Array.isArray(e.keywords)).toBe(true);
      expect(e.keywords.length).toBeGreaterThan(0);
    }
  });
});

describe('normalizeText', () => {
  it('met en minuscules et retire les diacritiques', () => {
    expect(normalizeText('Été Élevé')).toBe('ete eleve');
  });

  it('normalise les espaces multiples', () => {
    expect(normalizeText('  serpent   noir  ')).toBe('serpent noir');
  });
});

describe('searchSymbols', () => {
  it('sans requête, renvoie tout le corpus (filtré par catégorie si fournie)', () => {
    expect(searchSymbols('', null).length).toBe(TAFSIR_CORPUS.length);
    const nature = searchSymbols('', 'nature');
    expect(nature.every((e) => e.category === 'nature')).toBe(true);
    expect(nature.length).toBeGreaterThan(0);
  });

  it('trouve un symbole par son label', () => {
    const r = searchSymbols('serpent', null);
    expect(r.some((e) => e.id === 'serpent')).toBe(true);
  });

  it('trouve un symbole par un mot-clé (accents/casse ignorés)', () => {
    const r = searchSymbols('DENTS QUI TOMBENT', null);
    expect(r.some((e) => e.id === 'dents')).toBe(true);
  });

  it('ne renvoie rien pour une requête sans correspondance', () => {
    expect(searchSymbols('xyzabc123', null)).toEqual([]);
  });
});

describe('analyzeDream', () => {
  it('détecte les symboles connus mentionnés dans un texte libre', () => {
    const r = analyzeDream("Dans mon rêve, il y avait une mer agitée, un serpent, et je voulais nager.");
    const ids = r.map((m) => m.entry.id);
    expect(ids).toContain('mer');
    expect(ids).toContain('serpent');
    expect(ids).toContain('nager');
  });

  it('ne matche que des mots ENTIERS, pas une sous-chaîne dans un autre mot', () => {
    // "or" (argent-or) ne doit pas matcher à l'intérieur de "corpus"/"correspondent".
    const r = analyzeDream('Ces mots ne correspondent à rien du corpus de référence.');
    expect(r.map((m) => m.entry.id)).not.toContain('argent');
  });

  it('trie par nombre d’occurrences décroissant', () => {
    const r = analyzeDream('Un serpent, puis un autre serpent, et enfin un chat.');
    expect(r[0].entry.id).toBe('serpent');
    expect(r[0].hits).toBe(2);
  });

  it('renvoie un tableau vide pour un texte sans symbole connu ou vide', () => {
    expect(analyzeDream('')).toEqual([]);
    expect(analyzeDream('des mots qui ne correspondent à rien du corpus')).toEqual([]);
  });
});
