package com.asrarpro.app;

import android.app.Activity;
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

/** Privacy/SDK adapter; the controller can be tested without requesting real ads. */
final class LevelPlayAdPlatform implements LevelPlayActionAds.Platform {
    private static boolean initialized;
    private final Supplier<Activity> activity;
    private boolean consentChecked;
    private boolean interactive;
    private boolean destroyed;

    LevelPlayAdPlatform(Supplier<Activity> activity) { this.activity = activity; }
    public void allowConsentPrompt(boolean allowed) { interactive = allowed; }

    public void initialize(boolean interactive, LevelPlayActionAds.Prepared callback) {
        this.interactive |= interactive;
        try {
            ConsentInformation consent = UserMessagingPlatform.getConsentInformation(activity.get());
            if (consentChecked) { afterConsentUpdate(consent, callback); return; }
            consent.requestConsentInfoUpdate(activity.get(), new ConsentRequestParameters.Builder().build(), () -> {
                if (destroyed) return;
                consentChecked = true;
                afterConsentUpdate(consent, callback);
            }, error -> {
                if (destroyed) return;
                if (consent.canRequestAds()) { consentChecked = true; initializeSdk(callback); }
                else callback.done("consent");
            });
        } catch (RuntimeException error) { if (!destroyed) callback.done("consent"); }
    }

    private void afterConsentUpdate(ConsentInformation consent, LevelPlayActionAds.Prepared callback) {
        if (destroyed) return;
        if (consent.canRequestAds()) { initializeSdk(callback); return; }
        if (!interactive) { callback.done("consent"); return; }
        Activity host = activity.get();
        if (host == null || host.isFinishing() || host.isDestroyed() || (host instanceof LifecycleOwner && !((LifecycleOwner) host).getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED))) { callback.done("background"); return; }
        try {
            UserMessagingPlatform.loadAndShowConsentFormIfRequired(host, error -> {
                if (destroyed) return;
                if (consent.canRequestAds()) initializeSdk(callback);
                else callback.done("consent");
            });
        } catch (RuntimeException error) { if (!destroyed) callback.done("consent"); }
    }

    private void initializeSdk(LevelPlayActionAds.Prepared callback) {
        if (destroyed) return;
        if (initialized) { callback.done(null); return; }
        try {
            LevelPlay.init(activity.get().getApplicationContext(),
                new LevelPlayInitRequest.Builder(BuildConfig.LEVELPLAY_APP_KEY).build(),
                new LevelPlayInitListener() {
                    public void onInitSuccess(LevelPlayConfiguration config) {
                        initialized = true;
                        if (!destroyed) callback.done(null);
                    }
                    public void onInitFailed(LevelPlayInitError error) { if (!destroyed) callback.done("init"); }
                });
        } catch (RuntimeException error) { if (!destroyed) callback.done("init"); }
    }

    public LevelPlayActionAds.Ad create(LevelPlayActionAds.Events events) {
        LevelPlayRewardedAd ad = new LevelPlayRewardedAd(BuildConfig.LEVELPLAY_REWARDED_ID);
        ad.setListener(new LevelPlayRewardedAdListener() {
            public void onAdLoaded(LevelPlayAdInfo info) { events.loaded(); }
            public void onAdLoadFailed(LevelPlayAdError error) { events.loadFailed("no_fill"); }
            public void onAdDisplayed(LevelPlayAdInfo info) { events.displayed(); }
            public void onAdRewarded(LevelPlayReward reward, LevelPlayAdInfo info) { events.rewarded(); }
            public void onAdClosed(LevelPlayAdInfo info) { events.closed(); }
            public void onAdDisplayFailed(LevelPlayAdError error, LevelPlayAdInfo info) { events.displayFailed(); }
        });
        return new LevelPlayActionAds.Ad() {
            public void load() { ad.loadAd(); }
            public boolean ready() { return ad.isAdReady(); }
            public void show(Activity host) { ad.showAd(host); }
            public void clear() { ad.setListener(null); }
        };
    }

    public void destroy() { destroyed = true; }
}
