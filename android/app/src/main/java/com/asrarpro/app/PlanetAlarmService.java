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
            if (focus != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) { stopSelf(); return START_NOT_STICKY; }
            player = new MediaPlayer();
            player.setAudioAttributes(attributes);
            player.setDataSource(this, sound);
            player.setLooping(true);
            player.setOnErrorListener((mp, what, extra) -> { stopSelf(); return true; });
            player.prepare();
            player.start();
            if (alarm.optBoolean("vibration", true)) {
                vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                long[] pattern = {0, 500, 250, 500, 750};
                if (Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                else vibrator.vibrate(pattern, 0);
            }
            handler.postDelayed(this::stopSelf, 10 * 60_000L);
        } catch (Exception e) { stopSelf(); }
        return START_NOT_STICKY;
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
    @Override public void onDestroy() { stopSound(); stopForeground(true); super.onDestroy(); }
}
