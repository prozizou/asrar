import { describe, it, expect } from 'vitest';
import { crossedAdThreshold, adThresholdReached, ZIKR_AD_EVERY } from './zikrAdPrompt';

describe('crossedAdThreshold', () => {
  it('se déclenche au franchissement de chaque centaine', () => {
    expect(crossedAdThreshold(99, 100)).toBe(true);
    expect(crossedAdThreshold(199, 200)).toBe(true);
    expect(crossedAdThreshold(999, 1000)).toBe(true);
  });

  it('ne se déclenche pas entre deux centaines', () => {
    expect(crossedAdThreshold(0, 1)).toBe(false);
    expect(crossedAdThreshold(100, 101)).toBe(false);
    expect(crossedAdThreshold(150, 151)).toBe(false);
    expect(crossedAdThreshold(198, 199)).toBe(false);
  });

  it('ne se déclenche pas pour une restauration du compteur', () => {
    expect(crossedAdThreshold(0, 350)).toBe(false);
    expect(crossedAdThreshold(40, 400)).toBe(false);
  });

  it('ne se déclenche pas quand le compteur recule ou reste identique', () => {
    expect(crossedAdThreshold(100, 99)).toBe(false);
    expect(crossedAdThreshold(100, 100)).toBe(false);
    expect(crossedAdThreshold(250, 0)).toBe(false);
  });

  it('refuse les valeurs invalides', () => {
    expect(crossedAdThreshold(NaN, 100)).toBe(false);
    expect(crossedAdThreshold(99, undefined)).toBe(false);
  });

  it('accepte un pas de 2 ou 3 grains qui enjambe la centaine', () => {
    expect(crossedAdThreshold(99, 101)).toBe(true);
    expect(crossedAdThreshold(98, 101)).toBe(true);
  });
});

describe('adThresholdReached', () => {
  it('donne la centaine atteinte', () => {
    expect(adThresholdReached(100)).toBe(100);
    expect(adThresholdReached(101)).toBe(100);
    expect(adThresholdReached(1000)).toBe(1000);
    expect(adThresholdReached(ZIKR_AD_EVERY)).toBe(100);
  });
});
