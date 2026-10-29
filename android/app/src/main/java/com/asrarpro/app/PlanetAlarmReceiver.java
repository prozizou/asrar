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
            if (alarm == null || Math.abs(System.currentTimeMillis() - alarm.optLong("at")) > 120000) return;
            ContextCompat.startForegroundService(context, new Intent(context, PlanetAlarmService.class).setAction("ring").putExtra("alarm", alarm.toString()));
        } else {
            PlanetAlarmStore.restore(context);
        }
    }
}
