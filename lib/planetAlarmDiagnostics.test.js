import { describe, it, expect } from 'vitest';
import { alarmDiagnosticIssues, buildPlanetAlarmTest, PLANET_ALARM_TEST_ID } from './planetAlarmDiagnostics';
import { alarmIdFor } from './planetAlarms';

describe('native alarm diagnostics', () => {
  it('explains the permissions, muted alarm stream and total-silence mode without claiming the phone rang', () => {
    expect(alarmDiagnosticIssues({ exactAlarms: false, notifications: false, volume: 0, interruptionFilter: 3 })).toHaveLength(4);
    expect(alarmDiagnosticIssues({ exactAlarms: true, notifications: true, volume: 5, interruptionFilter: 1 })).toEqual([]);
  });
  it('distinguishes an unreceived trigger from one received or cancelled', () => {
    const settings = { exactAlarms: true, notifications: true, volume: 5, interruptionFilter: 1 };
    const scheduled = { id: 42, stage: 'scheduled', triggerAt: 1000 };
    expect(alarmDiagnosticIssues({ ...settings, events: [scheduled] }, 200000)).toHaveLength(1);
    expect(alarmDiagnosticIssues({ ...settings, events: [scheduled, { id: 42, stage: 'received' }] }, 200000)).toEqual([]);
    expect(alarmDiagnosticIssues({ ...settings, events: [scheduled, { id: 42, stage: 'cancelled' }] }, 200000)).toEqual([]);
  });
  it('reports audio failures while clearing the warning after a successful new launch', () => {
    const settings = { exactAlarms: true, notifications: true, volume: 5, interruptionFilter: 1 };
    const failure = { id: 42, stage: 'audio-unavailable' };
    expect(alarmDiagnosticIssues({ ...settings, events: [failure] })).toHaveLength(1);
    expect(alarmDiagnosticIssues({ ...settings, events: [failure, { id: 43, stage: 'ringing' }] })).toEqual([]);
  });
  it('schedules an independent short test without replacing a planetary alarm', () => {
    const alarm = buildPlanetAlarmTest({ soundId: 'douce', vibration: false }, 2000000000000);
    expect(alarm).toMatchObject({ id: PLANET_ALARM_TEST_ID, at: 2000000010000, sound: 'douce', vibration: false, test: true });
    expect(alarmIdFor('Jupiter', alarm.at)).not.toBe(alarm.id);
    expect(alarm.id).toBe(2147483647);
  });
});
