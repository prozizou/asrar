import { describe, it, expect } from 'vitest';
import { alarmIdFor, isSchedulable, buildAlarmContent } from './planetAlarms';

describe('alarmIdFor', () => {
  it('déterministe : même planète + même instant → même id', () => {
    expect(alarmIdFor('Jupiter', 1758000000000)).toBe(alarmIdFor('Jupiter', 1758000000000));
  });

  it('des instants différents pour une même planète donnent des ids différents', () => {
    expect(alarmIdFor('Jupiter', 1758000000000)).not.toBe(alarmIdFor('Jupiter', 1758003600000));
  });

  it('des planètes différentes au même instant donnent des ids différents', () => {
    expect(alarmIdFor('Jupiter', 1758000000000)).not.toBe(alarmIdFor('Saturne', 1758000000000));
  });

  it('toujours un entier 32 bits positif (contrainte Android)', () => {
    for (const [planet, ms] of [
      ['Lune', 0],
      ['Saturne', 1758000000000],
      ['Mars', Date.now()],
      ['Mercure', -1758000000000],
    ]) {
      const id = alarmIdFor(planet, ms);
      expect(Number.isInteger(id)).toBe(true);
      expect(id).toBeGreaterThanOrEqual(0);
      expect(id).toBeLessThanOrEqual(2147483647);
    }
  });
});

describe('isSchedulable', () => {
  it('vrai si le début est dans le futur', () => {
    expect(isSchedulable(2000, 1000)).toBe(true);
  });

  it('faux si le début est passé ou déjà entamé', () => {
    expect(isSchedulable(1000, 2000)).toBe(false);
    expect(isSchedulable(1000, 1000)).toBe(false);
  });
});

describe('buildAlarmContent', () => {
  it('formate titre et corps comme demandé (revue produit)', () => {
    const content = buildAlarmContent({ planet: 'Jupiter', emoji: '♃', natTxt: 'Très favorable', interval: '22:47 – 23:46' });
    expect(content).toEqual({
      title: '♃ Jupiter commence maintenant',
      body: 'Très favorable · 22:47 – 23:46',
    });
  });
});
