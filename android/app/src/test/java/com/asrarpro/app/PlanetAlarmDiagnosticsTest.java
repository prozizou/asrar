package com.asrarpro.app;

import android.app.Application;
import android.content.Context;
import org.json.JSONArray;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
public class PlanetAlarmDiagnosticsTest {
    @Test public void onlyTheLastTwentyEventsAreKept() throws Exception {
        Application app = RuntimeEnvironment.getApplication();
        app.getSharedPreferences("planet_alarm_diagnostics", Context.MODE_PRIVATE).edit().clear().commit();
        for (int i = 0; i < 25; i++) PlanetAlarmDiagnostics.record(app, i, "received", "");
        JSONArray events = PlanetAlarmDiagnostics.history(app);
        assertEquals(20, events.length());
        assertEquals(5, events.getJSONObject(0).getInt("id"));
        assertEquals(24, events.getJSONObject(19).getInt("id"));
    }
}
