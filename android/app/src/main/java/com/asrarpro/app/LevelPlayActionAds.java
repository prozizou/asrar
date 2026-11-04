package com.asrarpro.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Handler;
import android.os.Looper;
import androidx.lifecycle.Lifecycle;
import androidx.lifecycle.LifecycleOwner;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;
import com.unity3d.mediation.LevelPlay;
import com.unity3d.mediation.LevelPlayAdError;
import com.unity3d.mediation.LevelPlayAdInfo;
import com.unity3d.mediation.LevelPlayConfiguration;
import com.unity3d.mediation.LevelPlayInitError;
import com.unity3d.mediation.LevelPlayInitListener;
import com.unity3d.mediation.LevelPlayInitRequest;
import com.unity3d.mediation.rewarded.LevelPlayReward;
import com.unity3d.mediation.rewarded.LevelPlayRewardedAd;
import com.unity3d.mediation.rewarded.LevelPlayRewardedAdListener;
import java.util.function.Supplier;

/** One voluntary rewarded ad per action. Never creates a server-side credit. */
final class LevelPlayActionAds {
    interface Result { void done(boolean shown, boolean completed, String reason); }
    private static boolean initialized;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Supplier<Activity> activity;
    private Request pending;
    private boolean destroyed;

    private static final class Request {
        final Result callback;
        final RewardedActionState state = new RewardedActionState();
        LevelPlayRewardedAd ad;
        AlertDialog dialog;
        Runnable deadline;
        Request(Result callback) { this.callback = callback; }
    }

    LevelPlayActionAds(Supplier<Activity> activity) { this.activity = activity; }

    void show(Result callback) {
        main.post(() -> {
            if (destroyed || !foreground()) { callback.done(false, false, "background"); return; }
            if (pending != null) { callback.done(false, false, "busy"); return; }
            Request request = new Request(callback);
            pending = request;
            deadline(request, 120_000, "timeout");
            request.dialog = new AlertDialog.Builder(activity.get())
                .setTitle("Continuer avec une publicité")
                .setMessage("Regardez une publicité jusqu’au bout pour débloquer cette action.")
                .setPositiveButton("Regarder", (dialog, which) -> {
                    request.dialog = null;
                    requestConsent(request);
                })
                .setNegativeButton("Annuler", (dialog, which) -> finish(request, "skipped"))
                .setOnCancelListener(dialog -> finish(request, "skipped"))
                .show();
        });
    }

    private void requestConsent(Request request) {
        if (!active(request)) return;
        if (!foreground()) { finish(request, "background"); return; }
        deadline(request, 120_000, "timeout");
        try {
            Activity host = activity.get();
            ConsentInformation consent = UserMessagingPlatform.getConsentInformation(host);
            consent.requestConsentInfoUpdate(host, new ConsentRequestParameters.Builder().build(), () -> {
                if (!active(request)) return;
                if (!foreground()) { finish(request, "background"); return; }
                UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity.get(), error -> {
                    if (!active(request)) return;
                    if (!consent.canRequestAds()) { finish(request, "consent"); return; }
                    initialize(request);
                });
            }, error -> {
                if (!active(request)) return;
                if (consent.canRequestAds()) initialize(request);
                else finish(request, "consent");
            });
        } catch (RuntimeException error) { finish(request, "consent"); }
    }

    private boolean active(Request request) { return !destroyed && pending == request; }
    private boolean foreground() {
        Activity host = activity.get();
        return host != null && !host.isFinishing() && !host.isDestroyed()
            && (!(host instanceof LifecycleOwner) || ((LifecycleOwner) host).getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED));
    }

    private void initialize(Request request) {
        if (!active(request)) return;
        if (!foreground()) { finish(request, "background"); return; }
        deadline(request, 60_000, "timeout");
        if (initialized) { load(request); return; }
        try {
            if (BuildConfig.DEBUG) LevelPlay.setMetaData("is_test_suite", "enable");
            LevelPlay.init(activity.get().getApplicationContext(),
                new LevelPlayInitRequest.Builder(BuildConfig.LEVELPLAY_APP_KEY).build(),
                new LevelPlayInitListener() {
                    public void onInitSuccess(LevelPlayConfiguration configuration) {
                        initialized = true;
                        if (active(request)) load(request);
                    }
                    public void onInitFailed(LevelPlayInitError error) { finish(request, "init"); }
                });
        } catch (RuntimeException error) { finish(request, "init"); }
    }

    private void load(Request request) {
        if (!active(request)) return;
        if (!foreground()) { finish(request, "background"); return; }
        try {
            request.ad = new LevelPlayRewardedAd(BuildConfig.LEVELPLAY_REWARDED_ID);
            request.ad.setListener(new LevelPlayRewardedAdListener() {
                public void onAdLoaded(LevelPlayAdInfo info) {
                    if (!active(request)) return;
                    if (!foreground()) { finish(request, "background"); return; }
                    if (!request.ad.isAdReady()) { finish(request, "no_fill"); return; }
                    deadline(request, 600_000, "timeout");
                    try { request.ad.showAd(activity.get()); }
                    catch (RuntimeException error) { finish(request, "show"); }
                }
                public void onAdLoadFailed(LevelPlayAdError error) { finish(request, "no_fill"); }
                public void onAdDisplayed(LevelPlayAdInfo info) {
                    if (active(request)) request.state.displayed();
                }
                public void onAdRewarded(LevelPlayReward reward, LevelPlayAdInfo info) {
                    if (!active(request)) return;
                    request.state.rewarded();
                    if (request.state.isClosed()) finish(request, null);
                }
                public void onAdDisplayFailed(LevelPlayAdError error, LevelPlayAdInfo info) { finish(request, "show"); }
                public void onAdClosed(LevelPlayAdInfo info) {
                    if (!active(request)) return;
                    request.state.closed();
                    if (request.state.isComplete()) finish(request, null);
                    // Some adapters deliver the reward callback just after close.
                    else deadline(request, 5_000, "skipped");
                }
            });
            deadline(request, 60_000, "timeout");
            request.ad.loadAd();
        } catch (RuntimeException error) { finish(request, "load"); }
    }

    private void deadline(Request request, long delay, String reason) {
        if (request.deadline != null) main.removeCallbacks(request.deadline);
        request.deadline = () -> finish(request, reason);
        main.postDelayed(request.deadline, delay);
    }

    private void finish(Request request, String reason) {
        if (!active(request)) return;
        pending = null;
        if (request.deadline != null) main.removeCallbacks(request.deadline);
        if (request.ad != null) request.ad.setListener(null);
        if (request.dialog != null) request.dialog.dismiss();
        request.callback.done(request.state.wasDisplayed(), reason == null && request.state.isComplete(), reason);
    }

    void destroy() {
        if (pending != null) finish(pending, "background");
        destroyed = true;
        main.removeCallbacksAndMessages(null);
    }
}
