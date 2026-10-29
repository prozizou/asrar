import { describe, it, expect, vi } from 'vitest';
import { createAlarmClockAdapter } from './planetAlarmClock';

function fixture() {
  const clock = { schedule: vi.fn().mockResolvedValue({}), getPending: vi.fn().mockResolvedValue({ notifications: [{ id: 42 }] }), cancel: vi.fn().mockResolvedValue({}) };
  const legacy = { cancel: vi.fn().mockResolvedValue({}) };
  const adapter = createAlarmClockAdapter(clock, legacy);
  const notifications = [{ id: 42, title: 'Jupiter', body: '12:00–13:00', schedule: { at: new Date(2000000000000) }, extra: { soundId: 'douce', vibration: false } }];
  return { clock, legacy, adapter, notifications };
}

describe('Android planetary alarm clock adapter', () => {
  it('passes exact time, alarm sound and vibration to native scheduling then cancels the duplicate legacy notification', async () => {
    const { clock, legacy, adapter, notifications } = fixture();
    await adapter.schedule({ notifications });
    expect(clock.schedule).toHaveBeenCalledWith({ alarms: [{ id: 42, at: 2000000000000, title: 'Jupiter', body: '12:00–13:00', sound: 'douce', vibration: false }] });
    expect(legacy.cancel).toHaveBeenCalledWith({ notifications: [{ id: 42 }] });
  });
  it('preserves a legacy reminder when exact alarm permission or scheduling fails', async () => {
    const { clock, legacy, adapter, notifications } = fixture();
    clock.schedule.mockRejectedValue(new Error('exact-permission'));
    await expect(adapter.schedule({ notifications })).rejects.toThrow('exact-permission');
    expect(legacy.cancel).not.toHaveBeenCalled();
  });
  it('lists the native schedule and cancels both native and legacy alarm identifiers', async () => {
    const { clock, legacy, adapter } = fixture();
    expect(await adapter.getPending()).toEqual({ notifications: [{ id: 42 }] });
    await adapter.cancel({ notifications: [{ id: 42 }] });
    expect(clock.cancel).toHaveBeenCalledWith({ ids: [42] });
    expect(legacy.cancel).toHaveBeenCalledWith({ notifications: [{ id: 42 }] });
  });
});
