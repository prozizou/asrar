package com.asrarpro.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import org.json.*;

@CapacitorPlugin(name = "PlanetAlarm", permissions = @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }))
public class PlanetAlarmPlugin extends Plugin {
    @PluginMethod public void schedule(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "permissionResult");
            return;
        }
        scheduleGranted(call);
    }
    @PermissionCallback private void permissionResult(PluginCall call) {
        if (getPermissionState("notifications") != PermissionState.GRANTED) { call.reject("permission"); return; }
        scheduleGranted(call);
    }
    private void scheduleGranted(PluginCall call) {
        if (!NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) { call.reject("permission"); return; }
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = getContext().getSystemService(NotificationManager.class).getNotificationChannel("planet_alarm_clock_v1");
            if (channel != null && channel.getImportance() == NotificationManager.IMPORTANCE_NONE) {
                getActivity().startActivity(new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName()).putExtra(Settings.EXTRA_CHANNEL_ID, "planet_alarm_clock_v1"));
                call.reject("permission");
                return;
            }
        }
        AlarmManager manager = getContext().getSystemService(AlarmManager.class);
        if (Build.VERSION.SDK_INT >= 31 && !manager.canScheduleExactAlarms()) {
            getActivity().startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getContext().getPackageName())));
            call.reject("exact-permission");
            return;
        }
        JSArray alarms = call.getArray("alarms");
        if (alarms == null || alarms.length() == 0 || alarms.length() > 100) { call.reject("invalid"); return; }
        JSArray ids = new JSArray();
        try {
            // Validate the entire batch before mutating the system schedule.
            for (int i = 0; i < alarms.length(); i++) {
                JSONObject alarm = alarms.getJSONObject(i);
                if (alarm.getInt("id") < 0 || alarm.getLong("at") <= System.currentTimeMillis()) throw new IllegalArgumentException("past");
            }
            for (int i = 0; i < alarms.length(); i++) {
                JSONObject alarm = alarms.getJSONObject(i);
                ids.put(alarm.getInt("id"));
                PlanetAlarmStore.schedule(getContext(), alarm);
            }
            JSObject result = new JSObject(); result.put("ids", ids); call.resolve(result);
        } catch (Exception e) {
            for (int i = 0; i < ids.length(); i++) {
                try { PlanetAlarmStore.cancel(getContext(), ids.optInt(i)); } catch (Exception ignored) {}
            }
            call.reject(e.getMessage());
        }
    }
    @PluginMethod public void getPending(PluginCall call) {
        PlanetAlarmStore.restore(getContext());
        JSArray notifications = new JSArray();
        for (Object value : PlanetAlarmStore.prefs(getContext()).getAll().values()) {
            try { notifications.put(new JSONObject((String) value)); } catch (Exception ignored) {}
        }
        JSObject result = new JSObject(); result.put("notifications", notifications); call.resolve(result);
    }
    @PluginMethod public void cancel(PluginCall call) {
        JSArray ids = call.getArray("ids", new JSArray());
        try {
            for (int i = 0; i < ids.length(); i++) PlanetAlarmStore.cancel(getContext(), ids.optInt(i));
            call.resolve();
        } catch (Exception e) { call.reject(e.getMessage()); }
    }
}
