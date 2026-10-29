package com.asrarpro.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import org.json.JSONObject;
import java.util.Map;

final class PlanetAlarmStore {
    private PlanetAlarmStore() {}
    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("planet_alarm_clock", Context.MODE_PRIVATE); }
    static PendingIntent trigger(Context c, int id) {
        return PendingIntent.getBroadcast(c, id, new Intent(c, PlanetAlarmReceiver.class).setAction("planet:" + id).putExtra("id", id), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    static synchronized void schedule(Context c, JSONObject alarm) throws Exception {
        int id = alarm.getInt("id");
        long at = alarm.getLong("at");
        if (id < 0 || at <= System.currentTimeMillis()) throw new IllegalArgumentException("past");
        AlarmManager manager = c.getSystemService(AlarmManager.class);
        if (android.os.Build.VERSION.SDK_INT >= 31 && !manager.canScheduleExactAlarms()) throw new SecurityException("exact-permission");
        PendingIntent show = PendingIntent.getActivity(c, id, new Intent(c, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        // Persist before registration. A failed registration is rolled back by the caller.
        if (!prefs(c).edit().putString(String.valueOf(id), alarm.toString()).commit()) throw new IllegalStateException("storage");
        manager.setAlarmClock(new AlarmManager.AlarmClockInfo(at, show), trigger(c, id));
    }
    static synchronized JSONObject take(Context c, int id) {
        String value = prefs(c).getString(String.valueOf(id), null);
        if (value == null) return null;
        if (!prefs(c).edit().remove(String.valueOf(id)).commit()) return null;
        try { return new JSONObject(value); } catch (Exception e) { return null; }
    }
    static synchronized void cancel(Context c, int id) {
        if (!prefs(c).edit().remove(String.valueOf(id)).commit()) throw new IllegalStateException("storage");
        c.getSystemService(AlarmManager.class).cancel(trigger(c, id));
        c.startService(new Intent(c, PlanetAlarmService.class).setAction("cancel").putExtra("id", id));
    }
    static void restore(Context c) {
        for (Map.Entry<String, ?> item : prefs(c).getAll().entrySet()) {
            try {
                JSONObject alarm = new JSONObject((String) item.getValue());
                long at = alarm.getLong("at");
                long now = System.currentTimeMillis();
                if (at < now - 120000) prefs(c).edit().remove(item.getKey()).commit();
                else if (at > now) schedule(c, alarm);
                // Keep just-due entries: their AlarmManager broadcast may still
                // be queued. A simultaneous pending-list refresh must not eat it.
            } catch (SecurityException denied) {
                // Retain future entries: granting exact-alarm access can restore them.
            } catch (Exception invalid) { prefs(c).edit().remove(item.getKey()).commit(); }
        }
    }
}
