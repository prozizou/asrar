import { describe, it, expect } from 'vitest';
import { objSubdivisions } from './objSubdivisions';

describe('objSubdivisions', () => {
  it('subdivise un objectif en paires base×séries', () => {
    expect(objSubdivisions(100)).toEqual([
      { base: 50, series: 2, label: '50×2' },
      { base: 25, series: 4, label: '25×4' },
      { base: 20, series: 5, label: '20×5' },
      { base: 10, series: 10, label: '10×10' },
      { base: 5, series: 20, label: '5×20' },
      { base: 4, series: 25, label: '4×25' },
      { base: 2, series: 50, label: '2×50' },
    ]);
  });

  it('retrouve la subdivision traditionnelle 33×3', () => {
    expect(objSubdivisions(99)).toContainEqual({ base: 33, series: 3, label: '33×3' });
  });

  it('accepte une chaîne (valeur d’un champ de saisie)', () => {
    expect(objSubdivisions('12')).toContainEqual({ base: 6, series: 2, label: '6×2' });
  });

  it('renvoie une liste vide pour 0, 1, vide ou non numérique', () => {
    expect(objSubdivisions(0)).toEqual([]);
    expect(objSubdivisions(1)).toEqual([]);
    expect(objSubdivisions('')).toEqual([]);
    expect(objSubdivisions('abc')).toEqual([]);
  });

  it('renvoie une liste vide pour un nombre premier (aucun diviseur ≥ 2)', () => {
    expect(objSubdivisions(7)).toEqual([]);
  });

  it('borne la liste à 40 entrées', () => {
    expect(objSubdivisions(720720).length).toBeLessThanOrEqual(40);
  });
});
