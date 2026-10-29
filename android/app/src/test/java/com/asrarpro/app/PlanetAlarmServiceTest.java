package com.asrarpro.app;

import android.app.Application;
import android.app.Notification;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Looper;
import android.os.PowerManager;
import java.time.Duration;
import org.json.JSONObject;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.android.controller.ServiceController;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowMediaPlayer;
import org.robolectric.util.ReflectionHelpers;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
public class PlanetAlarmServiceTest {
    private Application app;
    private ServiceController<PlanetAlarmService> controller;
    @Before public void setup() {
        app = RuntimeEnvironment.getApplication();
        ShadowMediaPlayer.setMediaInfoProvider(source -> new ShadowMediaPlayer.MediaInfo(3000, 0));
        shadowOf(app.getSystemService(AudioManager.class)).setNextFocusRequestResponse(AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
        controller = Robolectric.buildService(PlanetAlarmService.class).create();
    }
    @After public void cleanup() { controller.destroy(); }
    private PlanetAlarmService ring() throws Exception {
        PlanetAlarmService service = controller.get();
        JSONObject alarm = new JSONObject().put("id", 42).put("title", "Jupiter").put("sound", "asrar").put("vibration", false);
        service.onStartCommand(new Intent(app, PlanetAlarmService.class).setAction("ring").putExtra("alarm", alarm.toString()), 0, 1);
        return service;
    }
    @Test public void playbackLoopsOnAlarmAudioAndTheStopActionIsAvailable() throws Exception {
        PlanetAlarmService service = ring();
        MediaPlayer player = ReflectionHelpers.getField(service, "player");
        assertNotNull(player);
        assertTrue(player.isPlaying());
        assertTrue(player.isLooping());
        assertEquals(AudioAttributes.USAGE_ALARM, shadowOf(player).getAudioAttributes().getUsage());
        Notification note = shadowOf(service).getLastForegroundNotification();
        assertEquals(Notification.CATEGORY_ALARM, note.category);
        assertEquals("Arrêter", note.actions[0].title.toString());
        // Cancelling a different future occurrence must not stop this alarm.
        service.onStartCommand(new Intent(app, PlanetAlarmService.class).setAction("cancel").putExtra("id", 43), 0, 2);
        assertFalse(shadowOf(service).isStoppedBySelf());
        note.actions[0].actionIntent.send();
        Intent stop = shadowOf(app).getNextStartedService();
        assertEquals("stop", stop.getAction());
        service.onStartCommand(stop, 0, 3);
        assertTrue(shadowOf(service).isStoppedBySelf());
    }
    @Test public void theSafetyTimeoutStopsPlaybackAndReleasesTheWakeLock() throws Exception {
        PlanetAlarmService service = ring();
        MediaPlayer player = ReflectionHelpers.getField(service, "player");
        PowerManager.WakeLock wakeLock = ReflectionHelpers.getField(service, "wakeLock");
        assertNotNull(player);
        assertTrue(wakeLock.isHeld());
        // Audio looping is checked separately; pause the simulated media clock
        // before advancing ten minutes to avoid a ShadowMediaPlayer loop bug.
        player.pause();
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMinutes(10));
        assertTrue(shadowOf(service).isStoppedBySelf());
        service.onDestroy();
        assertFalse(wakeLock.isHeld());
        assertEquals(ShadowMediaPlayer.State.END, shadowOf(player).getState());
    }
}
