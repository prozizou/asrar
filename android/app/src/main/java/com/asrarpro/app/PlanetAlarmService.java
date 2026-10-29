package com.asrarpro.app;

import android.app.*;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.*;
import android.net.Uri;
import android.os.*;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import org.json.JSONObject;

public class PlanetAlarmService extends Service {
    private static final String CHANNEL = "planet_alarm_clock_v1";
    private static final int NOTIFICATION_ID = 73001;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private MediaPlayer player;
    private Vibrator vibrator;
    private PowerManager.WakeLock wakeLock;
    private int activeId = -1;
    private AudioManager audioManager;
    private AudioFocusRequest focusRequest;
    private final AudioManager.OnAudioFocusChangeListener focusListener = change -> {
        if (change == AudioManager.AUDIOFOCUS_LOSS) stopSelf();
    };

    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) { stopSelf(); return START_NOT_STICKY; }
        if ("stop".equals(intent.getAction()) || "cancel".equals(intent.getAction())) {
            if ("stop".equals(intent.getAction()) || activeId == -1 || activeId == intent.getIntExtra("id", 0)) stopSelf();
            return START_NOT_STICKY;
        }
        try {
            JSONObject alarm = new JSONObject(intent.getStringExtra("alarm"));
            stopSound();
            activeId = alarm.getInt("id");
            PlanetAlarmDiagnostics.record(this, activeId, "service-started", "");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationChannel channel = new NotificationChannel(CHANNEL, "Réveils des heures planétaires", NotificationManager.IMPORTANCE_HIGH);
                channel.setSound(null, null);
                channel.enableVibration(false);
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                manager.createNotificationChannel(channel);
            }
            PendingIntent stop = PendingIntent.getService(this, 0, new Intent(this, PlanetAlarmService.class).setAction("stop"), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification note = new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(com.asrarpro.app.R.drawable.ic_stat_asrar)
                .setContentTitle(alarm.optString("title", "Réveil planétaire"))
                .setContentText(alarm.optString("body", ""))
                .setCategory(NotificationCompat.CATEGORY_ALARM).setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true).setContentIntent(open).setDeleteIntent(stop)
                .addAction(0, "Arrêter", stop).build();
            ServiceCompat.startForeground(this, NOTIFICATION_ID, note, Build.VERSION.SDK_INT >= 29 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK : 0);
            wakeLock = getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ASRAR:PlanetAlarm");
            wakeLock.acquire(10 * 60_000L);
            Uri sound = null;
            String name = alarm.optString("sound", "systeme");
            if (!"systeme".equals(name)) {
                int resource = getResources().getIdentifier("douce".equals(name) ? "asrar_notification_douce" : "asrar_notification", "raw", getPackageName());
                if (resource != 0) sound = Uri.parse("android.resource://" + getPackageName() + "/" + resource);
            }
            if (sound == null) sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (sound == null) sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            audioManager = getSystemService(AudioManager.class);
            AudioAttributes attributes = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
            int focus;
            if (Build.VERSION.SDK_INT >= 26) {
                focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT).setAudioAttributes(attributes).setOnAudioFocusChangeListener(focusListener).build();
                focus = audioManager.requestAudioFocus(focusRequest);
            } else focus = audioManager.requestAudioFocus(focusListener, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
            boolean audible = false;
            String failure = "audio-focus-denied";
            if (focus == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                audible = playSound(sound, attributes);
                if (!audible) {
                    // A missing or unreadable chosen ringtone must not silently
                    // discard the alarm. Try the system alarm, then the bundled tone.
                    audible = playSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM), attributes);
                    if (!audible) {
                        int fallback = getResources().getIdentifier("asrar_notification", "raw", getPackageName());
                        if (fallback != 0) audible = playSound(Uri.parse("android.resource://" + getPackageName() + "/" + fallback), attributes);
                    }
                }
                failure = "audio-playback-failed";
            }
            if (audible) PlanetAlarmDiagnostics.record(this, activeId, "ringing", "");
            else {
                PlanetAlarmDiagnostics.record(this, activeId, "audio-unavailable", failure);
                // Keep the stop action and vibration available instead of
                // stopping the service without any explanation.
                Notification warning = new NotificationCompat.Builder(this, CHANNEL)
                    .setSmallIcon(com.asrarpro.app.R.drawable.ic_stat_asrar)
                    .setContentTitle(alarm.optString("title", "Réveil planétaire"))
                    .setContentText("Son indisponible. Vérifiez le volume des alarmes et les réglages audio du téléphone.")
                    .setCategory(NotificationCompat.CATEGORY_ALARM).setOngoing(true)
                    .setContentIntent(open).addAction(0, "Arrêter", stop).build();
                manager.notify(NOTIFICATION_ID, warning);
            }
            if (alarm.optBoolean("vibration", true)) {
                vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                long[] pattern = {0, 500, 250, 500, 750};
                if (Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                else vibrator.vibrate(pattern, 0);
            }
            handler.postDelayed(() -> {
                PlanetAlarmDiagnostics.record(this, activeId, "timeout", "");
                stopSelf();
            }, alarm.optBoolean("test", false) ? 20_000L : 10 * 60_000L);
        } catch (Exception e) {
            PlanetAlarmDiagnostics.record(this, activeId, "failed", e.getClass().getSimpleName());
            stopSelf();
        }
        return START_NOT_STICKY;
    }
    private boolean playSound(Uri sound, AudioAttributes attributes) {
        if (sound == null) return false;
        MediaPlayer candidate = new MediaPlayer();
        try {
            candidate.setAudioAttributes(attributes);
            candidate.setDataSource(this, sound);
            candidate.setLooping(true);
            candidate.setOnErrorListener((mp, what, extra) -> {
                PlanetAlarmDiagnostics.record(this, activeId, "audio-unavailable", "media-error-" + what);
                stopSelf();
                return true;
            });
            candidate.prepare();
            candidate.start();
            player = candidate;
            return true;
        } catch (Exception failure) { candidate.release(); return false; }
    }
    private void stopSound() {
        handler.removeCallbacksAndMessages(null);
        if (player != null) { player.release(); player = null; }
        if (vibrator != null) { vibrator.cancel(); vibrator = null; }
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
        if (audioManager != null) {
            if (Build.VERSION.SDK_INT >= 26 && focusRequest != null) audioManager.abandonAudioFocusRequest(focusRequest);
            else audioManager.abandonAudioFocus(focusListener);
        }
        audioManager = null;
        focusRequest = null;
    }
    @Override public void onDestroy() {
        if (activeId >= 0) PlanetAlarmDiagnostics.record(this, activeId, "stopped", "");
        stopSound(); stopForeground(true); super.onDestroy();
    }
}
