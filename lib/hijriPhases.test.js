import { describe, it, expect } from 'vitest';
import { phaseOfDay } from './hijriPhases';

describe('phaseOfDay', () => {
  it('jours 1 à 15 : attraction', () => {
    expect(phaseOfDay(1).id).toBe('attraction');
    const p = phaseOfDay(15);
    expect(p.id).toBe('attraction');
    expect(p.daysLeft).toBe(0);
    expect(p.totalDays).toBe(15);
  });

  it('jour 16 et suivants : repoussement', () => {
    const p = phaseOfDay(16, 30);
    expect(p.id).toBe('repoussement');
    expect(p.dayInPhase).toBe(1);
    expect(p.totalDays).toBe(15);
    expect(phaseOfDay(29, 29).daysLeft).toBe(0);
    expect(phaseOfDay(29, 30).daysLeft).toBe(1);
  });

  it('part écoulée de la période', () => {
    expect(phaseOfDay(1).elapsedPct).toBe(0);
    expect(phaseOfDay(8).elapsedPct).toBe(47);
    expect(phaseOfDay(20).elapsedPct).toBeNull();
  });

  it('longueur du mois inconnue', () => {
    const p = phaseOfDay(20);
    expect(p.totalDays).toBeNull();
    expect(p.daysLeft).toBeNull();
  });

  it('jour invalide', () => {
    expect(phaseOfDay(0)).toBeNull();
    expect(phaseOfDay('x')).toBeNull();
    expect(phaseOfDay(31)).toBeNull();
  });
});
