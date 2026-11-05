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
    static class FakeAd implements LevelPlayActionAds.Ad {
        final LevelPlayActionAds.Events events;
        int loads, shows;
        boolean available, cleared;
        FakeAd(LevelPlayActionAds.Events events) { this.events = events; }
        public void load() { loads++; }
        public boolean ready() { return available; }
        public void show(Activity activity) { available = false; shows++; }
        public void clear() { cleared = true; }
        void loaded() { available = true; events.loaded(); idle(); }
    }
    static class FakePlatform implements LevelPlayActionAds.Platform {
        final List<FakeAd> ads = new ArrayList<>();
        final List<Boolean> preparations = new ArrayList<>();
        boolean destroyed, interactive;
        boolean defer;
        String error;
        final List<LevelPlayActionAds.Prepared> callbacks = new ArrayList<>();
        public void initialize(boolean interactive, LevelPlayActionAds.Prepared callback) { preparations.add(interactive); if (defer) callbacks.add(callback); else callback.done(error); }
        public void allowConsentPrompt(boolean allowed) { interactive = allowed; }
        public LevelPlayActionAds.Ad create(LevelPlayActionAds.Events events) { FakeAd ad = new FakeAd(events); ads.add(ad); return ad; }
        public void destroy() { destroyed = true; }
    }
    static class Outcome {
        final boolean shown, completed;
        final String reason;
        Outcome(boolean shown, boolean completed, String reason) { this.shown = shown; this.completed = completed; this.reason = reason; }
    }
    static class Fixture {
        final Activity activity = Robolectric.buildActivity(Activity.class).setup().get();
        final FakePlatform platform = new FakePlatform();
        final LevelPlayActionAds controller = new LevelPlayActionAds(() -> activity, platform);
        final List<Outcome> results = new ArrayList<>();
        void show() { controller.show((shown, completed, reason) -> results.add(new Outcome(shown, completed, reason))); idle(); }
        FakeAd preload() { controller.preload(); idle(); return platform.ads.get(platform.ads.size() - 1); }
        FakeAd watch() { FakeAd ad = preload(); ad.loaded(); show(); dialog().getButton(DialogInterface.BUTTON_POSITIVE).performClick(); idle(); return ad; }
    }
    static void idle() { Shadows.shadowOf(Looper.getMainLooper()).idle(); }
    static AlertDialog dialog() { return ShadowAlertDialog.getLatestAlertDialog(); }

    @Test public void preloadedAdShowsOnClickWithoutAnotherInitializationOrDownload() {
        Fixture f = new Fixture();
        FakeAd ad = f.preload(); ad.loaded();
        assertEquals(List.of(false), f.platform.preparations);
        assertEquals(0, ad.shows);
        f.show();
        assertTrue(dialog().getButton(DialogInterface.BUTTON_POSITIVE).isEnabled());
        dialog().getButton(DialogInterface.BUTTON_POSITIVE).performClick(); idle();
        assertEquals(1, ad.shows);
        assertEquals(1, ad.loads);
        assertEquals(1, f.platform.preparations.size());
        assertTrue(f.results.isEmpty());
        f.controller.destroy();
    }

    @Test public void loadingIsVisibleAndCannotBeWatchedUntilReady() {
        Fixture f = new Fixture(); f.show();
        FakeAd ad = f.platform.ads.get(0);
        assertTrue(dialog().isShowing());
        android.widget.TextView message = dialog().findViewById(android.R.id.message);
        assertEquals(android.view.View.VISIBLE, message.getVisibility());
        assertTrue(message.getText().toString().contains("Chargement"));
        assertFalse(dialog().getButton(DialogInterface.BUTTON_POSITIVE).isEnabled());
        assertEquals("Chargement…", dialog().getButton(DialogInterface.BUTTON_POSITIVE).getText().toString());
        assertEquals(0, ad.shows);
        ad.loaded();
        assertTrue(dialog().getButton(DialogInterface.BUTTON_POSITIVE).isEnabled());
        assertEquals("Regarder", dialog().getButton(DialogInterface.BUTTON_POSITIVE).getText().toString());
        assertTrue(f.results.isEmpty());
        f.controller.destroy();
    }

    @Test public void followingAdDownloadsDuringVideoAndIsUsedForTheNextAction() {
        Fixture f = new Fixture(); FakeAd first = f.watch();
        first.events.displayed(); idle();
        assertEquals(2, f.platform.ads.size());
        FakeAd next = f.platform.ads.get(1); next.loaded();
        // A callback from the cached ad must not reward the video being watched.
        next.events.rewarded(); next.events.closed(); idle();
        assertTrue(f.results.isEmpty());
        first.events.rewarded(); first.events.closed(); idle();
        assertEquals(1, f.results.size()); assertTrue(f.results.get(0).completed);
        f.show(); dialog().getButton(DialogInterface.BUTTON_POSITIVE).performClick(); idle();
        assertEquals(1, next.shows);
        assertEquals(1, next.loads);
        assertEquals(2, f.platform.ads.size());
        f.controller.destroy();
    }

    @Test public void cancelAndConcurrentCallsNeverGrantAccessOrShowLateLoadedAds() {
        Fixture f = new Fixture(); f.show(); FakeAd ad = f.platform.ads.get(0);
        f.show(); assertEquals("busy", f.results.get(0).reason);
        dialog().getButton(DialogInterface.BUTTON_NEGATIVE).performClick(); idle();
        assertEquals("skipped", f.results.get(1).reason);
        assertFalse(f.platform.interactive);
        ad.loaded(); assertEquals(0, ad.shows);
        for (Outcome result : f.results) assertFalse(result.completed);
        f.controller.destroy();
    }

    @Test public void destroySettlesOnceAndIgnoresAllLateCallbacks() {
        Fixture f = new Fixture(); f.show(); FakeAd ad = f.platform.ads.get(0); AlertDialog prompt = dialog();
        f.controller.destroy();
        ad.loaded(); ad.events.displayed(); ad.events.rewarded(); ad.events.closed();
        Shadows.shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMinutes(3));
        assertFalse(prompt.isShowing()); assertTrue(ad.cleared); assertTrue(f.platform.destroyed);
        assertEquals(1, f.results.size()); assertEquals("background", f.results.get(0).reason);
        assertFalse(f.results.get(0).completed);
    }

    @Test public void failureNeverGrantsAndNextActionCanRetry() {
        Fixture f = new Fixture(); f.show();
        f.platform.ads.get(0).events.loadFailed("no_fill"); idle();
        assertEquals("no_fill", f.results.get(0).reason); assertFalse(f.results.get(0).completed);
        f.show();
        assertEquals(2, f.platform.ads.size());
        f.platform.ads.get(1).loaded();
        assertTrue(dialog().getButton(DialogInterface.BUTTON_POSITIVE).isEnabled());
        f.controller.destroy();
    }

    @Test public void timedOutPreloadDoesNotBlockAllFutureAttempts() {
        Fixture f = new Fixture(); f.show(); FakeAd expired = f.platform.ads.get(0);
        Shadows.shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(61));
        assertEquals("timeout", f.results.get(0).reason);
        expired.loaded(); assertEquals(0, expired.shows);
        f.show(); assertEquals(2, f.platform.ads.size());
        f.controller.destroy();
    }

    @Test public void closeWithoutRewardNeverGrantsEvenWhenNextAdIsReady() {
        Fixture f = new Fixture(); FakeAd ad = f.watch();
        ad.events.displayed(); idle(); f.platform.ads.get(1).loaded();
        ad.events.closed(); idle();
        Shadows.shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(6));
        assertEquals(1, f.results.size()); assertFalse(f.results.get(0).completed);
        assertEquals("skipped", f.results.get(0).reason);
        ad.events.rewarded(); idle(); assertEquals(1, f.results.size());
        f.controller.destroy();
    }

    @Test public void acceptsRewardArrivingAfterCloseExactlyOnce() {
        Fixture f = new Fixture(); FakeAd ad = f.watch();
        ad.events.displayed(); ad.events.closed(); idle(); assertTrue(f.results.isEmpty());
        ad.events.rewarded(); ad.events.rewarded(); idle();
        assertEquals(1, f.results.size()); assertTrue(f.results.get(0).completed);
        f.controller.destroy();
    }

    @Test public void expiredReadyAdIsReloadedBeforeWatchCanStart() {
        Fixture f = new Fixture(); FakeAd expired = f.preload(); expired.loaded(); f.show();
        expired.available = false;
        dialog().getButton(DialogInterface.BUTTON_POSITIVE).performClick(); idle();
        assertEquals(0, expired.shows); assertTrue(expired.cleared);
        assertFalse(dialog().getButton(DialogInterface.BUTTON_POSITIVE).isEnabled());
        assertEquals(2, f.platform.ads.size());
        f.controller.destroy();
    }

    @Test public void preloadWaitsForPrivacyApprovalBeforeCreatingAnAd() {
        Fixture f = new Fixture(); f.platform.error = "consent";
        f.controller.preload(); idle();
        assertTrue(f.platform.ads.isEmpty()); assertFalse(f.platform.interactive);
        f.platform.error = null; f.show();
        assertTrue(f.platform.interactive); assertEquals(1, f.platform.ads.size());
        assertEquals(List.of(false, true), f.platform.preparations);
        f.controller.destroy();
    }

    @Test public void lateInitializationCannotReplaceANewerPreload() {
        Fixture f = new Fixture(); f.platform.defer = true;
        f.controller.preload(); idle();
        Shadows.shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(121));
        f.show();
        f.platform.callbacks.get(0).done(null); idle();
        assertTrue(f.platform.ads.isEmpty());
        f.platform.callbacks.get(1).done(null); idle();
        assertEquals(1, f.platform.ads.size()); assertTrue(f.results.isEmpty());
        f.controller.destroy();
    }

    @Test public void inactiveActivityCannotStartOrPreload() {
        FakePlatform platform = new FakePlatform();
        LevelPlayActionAds ads = new LevelPlayActionAds(() -> null, platform);
        List<String> results = new ArrayList<>(); ads.preload();
        ads.show((shown, completed, reason) -> { assertFalse(shown); assertFalse(completed); results.add(reason); }); idle();
        assertEquals(List.of("background"), results); assertTrue(platform.ads.isEmpty());
        ads.destroy();
    }
}
