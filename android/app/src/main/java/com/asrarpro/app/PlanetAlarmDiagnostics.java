package com.asrarpro.app;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;

/** Bounded, device-local history. Contains no account, message or location data. */
final class PlanetAlarmDiagnostics {
    private PlanetAlarmDiagnostics() {}
    static void record(Context context, int id, String stage, String reason) {
        record(context, id, stage, reason, 0);
    }
    static void scheduled(Context context, int id, long triggerAt) {
        record(context, id, "scheduled", "", triggerAt);
    }
    private static synchronized void record(Context context, int id, String stage, String reason, long triggerAt) {
        try {
            JSONArray history = history(context);
            JSONArray next = new JSONArray();
            for (int i = Math.max(0, history.length() - 19); i < history.length(); i++) next.put(history.get(i));
            JSONObject event = new JSONObject().put("id", id).put("at", System.currentTimeMillis()).put("stage", stage).put("reason", reason);
            if (triggerAt > 0) event.put("triggerAt", triggerAt);
            next.put(event);
            context.getSharedPreferences("planet_alarm_diagnostics", Context.MODE_PRIVATE).edit().putString("events", next.toString()).commit();
        } catch (Exception ignored) { /* Diagnostics must never prevent an alarm. */ }
    }
    static synchronized JSONArray history(Context context) {
        try { return new JSONArray(context.getSharedPreferences("planet_alarm_diagnostics", Context.MODE_PRIVATE).getString("events", "[]")); }
        catch (Exception ignored) { return new JSONArray(); }
    }
}
