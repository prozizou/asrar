package com.asrarpro.app;

import android.app.AlarmManager;
import android.app.Application;
import android.content.Intent;
import org.json.JSONObject;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
public class PlanetAlarmTest {
    private Application app;
    private JSONObject alarm(int id) throws Exception {
        return new JSONObject().put("id", id).put("at", System.currentTimeMillis() + 3600000).put("title", "Jupiter").put("vibration", true);
    }
    @Before public void setup() { app = RuntimeEnvironment.getApplication(); PlanetAlarmStore.prefs(app).edit().clear().commit(); }
    @Test public void exactAlarmIsDurableAndRestoreDoesNotDuplicateIt() throws Exception {
        PlanetAlarmStore.schedule(app, alarm(42));
        assertNotNull(PlanetAlarmStore.prefs(app).getString("42", null));
        PlanetAlarmStore.restore(app);
        assertEquals(1, shadowOf(app.getSystemService(AlarmManager.class)).getScheduledAlarms().size());
        assertNotNull(app.getSystemService(AlarmManager.class).getNextAlarmClock());
    }
    @Test public void cancelledAlarmCannotRingAndDoesNotDeleteOtherAlarms() throws Exception {
        PlanetAlarmStore.schedule(app, alarm(42));
        PlanetAlarmStore.schedule(app, alarm(43));
        PlanetAlarmStore.cancel(app, 42);
        assertNull(PlanetAlarmStore.take(app, 42));
        assertNotNull(PlanetAlarmStore.take(app, 43));
        assertEquals(1, shadowOf(app.getSystemService(AlarmManager.class)).getScheduledAlarms().size());
    }
    @Test public void aBroadcastIsConsumedOnlyOnceAndExpiredOnesDoNotStartTheRinger() throws Exception {
        JSONObject due = alarm(42).put("at", System.currentTimeMillis());
        PlanetAlarmStore.prefs(app).edit().putString("42", due.toString()).commit();
        PlanetAlarmReceiver receiver = new PlanetAlarmReceiver();
        Intent event = new Intent(app, PlanetAlarmReceiver.class).setAction("planet:42").putExtra("id", 42);
        receiver.onReceive(app, event);
        Intent started = shadowOf(app).getNextStartedService();
        assertNotNull(started);
        assertEquals("ring", started.getAction());
        receiver.onReceive(app, event);
        assertNull(shadowOf(app).getNextStartedService());
        PlanetAlarmStore.prefs(app).edit().putString("42", due.put("at", System.currentTimeMillis() - 180000).toString()).commit();
        receiver.onReceive(app, event);
        assertNull(shadowOf(app).getNextStartedService());
    }
    @Test @Config(sdk = 31) public void exactAlarmPermissionIsRequiredBeforeAnyPersistence() throws Exception {
        shadowOf(app.getSystemService(AlarmManager.class)).setCanScheduleExactAlarms(false);
        try { PlanetAlarmStore.schedule(app, alarm(42)); fail(); } catch (SecurityException expected) {}
        assertTrue(PlanetAlarmStore.prefs(app).getAll().isEmpty());
    }
    @Test public void pastAndInvalidAlarmsAreRejectedWithoutPersistence() throws Exception {
        try { PlanetAlarmStore.schedule(app, alarm(-1)); fail(); } catch (IllegalArgumentException expected) {}
        try { PlanetAlarmStore.schedule(app, alarm(42).put("at", System.currentTimeMillis() - 1)); fail(); } catch (IllegalArgumentException expected) {}
        assertTrue(PlanetAlarmStore.prefs(app).getAll().isEmpty());
    }
}
