import { describe, it, expect } from 'vitest';
import { matchesModule, searchModules } from './moduleSearch';

// Jeu d'essai calqué sur lib/modulesCatalog.tsx, sans les icônes JSX (la
// recherche ne lit que label/desc/keywords).
const ITEMS = [
  { label: 'Hatims', desc: 'Carrés numériques (Al Kanzou), export Word', href: '/wafq/carre', keywords: ['carre magique', 'kanzou', 'wafq'] },
  { label: 'Géomancie', desc: 'Faire un tirage géomantique (Tourab)', href: '/geomancie', keywords: ['tourab', 'raml'] },
  { label: 'Abajad', desc: 'Calculer le poids numérique des lettres arabes', href: '/abajad', keywords: ['abjad', 'numerologie'] },
  { label: 'Bibliothèque', desc: 'Lire des livres et manuscrits', href: '/bibliotheque', keywords: ['livres'] },
];

describe('matchesModule', () => {
  it('trouve par le libellé, sans tenir compte de la casse ni des accents', () => {
    expect(matchesModule(ITEMS[1], 'geomancie')).toBe(true);
    expect(matchesModule(ITEMS[1], 'GÉOMANCIE')).toBe(true);
  });

  it('trouve par la description', () => {
    expect(matchesModule(ITEMS[2], 'lettres arabes')).toBe(true);
  });

  it('trouve par un mot-clé absent du nom', () => {
    expect(matchesModule(ITEMS[0], 'carré magique')).toBe(true);
    expect(matchesModule(ITEMS[1], 'tourab')).toBe(true);
  });

  it('exige TOUS les mots saisis', () => {
    expect(matchesModule(ITEMS[0], 'carre magique')).toBe(true);
    expect(matchesModule(ITEMS[0], 'carre babouche')).toBe(false);
  });

  it('ne correspond jamais sur une saisie vide', () => {
    expect(matchesModule(ITEMS[0], '')).toBe(false);
    expect(matchesModule(ITEMS[0], '   ')).toBe(false);
  });
});

describe('searchModules', () => {
  it('renvoie les modules correspondants dans l’ordre du catalogue', () => {
    expect(searchModules(ITEMS, 'li').map((m) => m.label)).toEqual(['Bibliothèque']);
  });

  it('renvoie une liste VIDE sur une saisie vide (pas tout le catalogue)', () => {
    expect(searchModules(ITEMS, '')).toEqual([]);
    expect(searchModules(ITEMS, '  ')).toEqual([]);
  });

  it('plafonne le nombre de résultats', () => {
    expect(searchModules(ITEMS, 'e', 2)).toHaveLength(2);
  });

  it('tolère une liste absente', () => {
    expect(searchModules(undefined, 'hatims')).toEqual([]);
  });
});
