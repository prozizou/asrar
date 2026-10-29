// Adapter keeps the existing planetary-hour scheduling API. Only Android APKs
// with the native PlanetAlarm plugin use AlarmManager and looping alarm audio.
export function createAlarmClockAdapter(clock, legacyNotifications) {
  return {
    checkPermissions: async () => ({ display: 'granted' }),
    createChannel: async () => {},
    getPending: () => clock.getPending(),
    schedule: async ({ notifications }) => {
      const alarms = notifications.map((n) => ({
        id: n.id,
        at: n.schedule.at.getTime(),
        title: n.title,
        body: n.body,
        sound: n.extra.soundId,
        vibration: n.extra.vibration,
      }));
      await clock.schedule({ alarms });
      // Clear matching old one-shot notifications after the durable native
      // schedule succeeds. A failed native schedule leaves legacy reminders intact.
      await legacyNotifications.cancel({ notifications: alarms.map(({ id }) => ({ id })) }).catch(() => {});
      return {};
    },
    cancel: async ({ notifications }) => {
      await clock.cancel({ ids: notifications.map(({ id }) => id) });
      await legacyNotifications.cancel({ notifications });
    },
  };
}
