package com.asrarpro.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.os.Looper;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.Shadows;
import org.robolectric.shadows.ShadowAlertDialog;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class LevelPlayActionAdsTest {
    @Test public void cancelAndConcurrentCallsNeverGrantAccess() {
        Activity activity = Robolectric.buildActivity(Activity.class).setup().get();
        LevelPlayActionAds ads = new LevelPlayActionAds(() -> activity);
        List<String> results = new ArrayList<>();
        ads.show((shown, completed, reason) -> { assertFalse(completed); results.add(reason); });
        Shadows.shadowOf(Looper.getMainLooper()).idle();
        AlertDialog dialog = ShadowAlertDialog.getLatestAlertDialog();
        assertTrue(dialog.isShowing());
        ads.show((shown, completed, reason) -> { assertFalse(completed); results.add(reason); });
        Shadows.shadowOf(Looper.getMainLooper()).idle();
        assertEquals(List.of("busy"), results);
        dialog.getButton(DialogInterface.BUTTON_NEGATIVE).performClick();
        Shadows.shadowOf(Looper.getMainLooper()).idle();
        assertEquals(List.of("busy", "skipped"), results);
        ads.destroy();
    }

    @Test public void destroySettlesPendingCallOnceAndDismissesDialog() {
        Activity activity = Robolectric.buildActivity(Activity.class).setup().get();
        LevelPlayActionAds ads = new LevelPlayActionAds(() -> activity);
        List<String> results = new ArrayList<>();
        ads.show((shown, completed, reason) -> { assertFalse(completed); results.add(reason); });
        Shadows.shadowOf(Looper.getMainLooper()).idle();
        AlertDialog dialog = ShadowAlertDialog.getLatestAlertDialog();
        ads.destroy();
        Shadows.shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMinutes(3));
        assertFalse(dialog.isShowing());
        assertEquals(List.of("background"), results);
    }

    @Test public void inactiveActivityCannotStartAnAd() {
        LevelPlayActionAds ads = new LevelPlayActionAds(() -> null);
        List<String> results = new ArrayList<>();
        ads.show((shown, completed, reason) -> { assertFalse(shown); assertFalse(completed); results.add(reason); });
        Shadows.shadowOf(Looper.getMainLooper()).idle();
        assertEquals(List.of("background"), results);
    }
}
