package com.asrarpro.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;
import org.json.JSONObject;

public class PlanetAlarmReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action != null && action.startsWith("planet:")) {
            JSONObject alarm = PlanetAlarmStore.take(context, intent.getIntExtra("id", 0));
            // Ignore stale broadcasts and alarms delayed by more than two minutes.
            if (alarm == null) return;
            int id = alarm.optInt("id");
            if (Math.abs(System.currentTimeMillis() - alarm.optLong("at")) > 120000) {
                PlanetAlarmDiagnostics.record(context, id, "expired", "delivery-delayed");
                return;
            }
            PlanetAlarmDiagnostics.record(context, id, "received", "");
            try {
                ContextCompat.startForegroundService(context, new Intent(context, PlanetAlarmService.class).setAction("ring").putExtra("alarm", alarm.toString()));
            } catch (RuntimeException error) {
                PlanetAlarmDiagnostics.record(context, id, "failed", "service-start-" + error.getClass().getSimpleName());
            }
        } else {
            PlanetAlarmStore.restore(context);
        }
    }
}
