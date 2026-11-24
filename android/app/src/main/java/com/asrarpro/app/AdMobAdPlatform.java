package com.asrarpro.app;

import android.app.Activity;
import androidx.lifecycle.Lifecycle;
import androidx.lifecycle.LifecycleOwner;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.gms.ads.rewarded.ServerSideVerificationOptions;
import java.util.function.Supplier;

/** Privacy/SDK adapter; the controller can be tested without requesting real ads. */
final class AdMobAdPlatform implements LevelPlayActionAds.Platform {
    private static volatile boolean initialized;
    private final Supplier<Activity> activity;
    private boolean consentChecked;
    private boolean interactive;
    private boolean destroyed;

    private final String serverId;
    AdMobAdPlatform(Supplier<Activity> activity, String serverId) { this.activity = activity; this.serverId = serverId; }
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
            android.content.Context context = activity.get().getApplicationContext();
            new Thread(() -> {
                try {
                    MobileAds.initialize(context, status -> {
                        initialized = true;
                        if (!destroyed) callback.done(null);
                    });
                } catch (RuntimeException error) { if (!destroyed) callback.done("init"); }
            }, "asrar-admob-init").start();
        } catch (RuntimeException error) { if (!destroyed) callback.done("init"); }
    }

    public LevelPlayActionAds.Ad create(LevelPlayActionAds.Events events) {
        return new LevelPlayActionAds.Ad() {
            private RewardedAd ad;
            private boolean cleared;
            public void load() {
                String unit = BuildConfig.DEBUG ? "ca-app-pub-3940256099942544/5224354917" : BuildConfig.ADMOB_REWARDED_ID;
                RewardedAd.load(activity.get(), unit, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
                    @Override public void onAdLoaded(RewardedAd loaded) {
                        if (cleared || destroyed) return;
                        ad = loaded;
                        ad.setServerSideVerificationOptions(new ServerSideVerificationOptions.Builder().setCustomData(serverId).build());
                        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                            @Override public void onAdShowedFullScreenContent() { events.displayed(); }
                            @Override public void onAdDismissedFullScreenContent() { ad = null; events.closed(); }
                            @Override public void onAdFailedToShowFullScreenContent(AdError error) { ad = null; events.displayFailed(); }
                        });
                        events.loaded();
                    }
                    @Override public void onAdFailedToLoad(LoadAdError error) { if (!cleared && !destroyed) events.loadFailed("no_fill"); }
                });
            }
            public boolean ready() { return ad != null && !cleared && !destroyed; }
            public void show(Activity host) { if (ready()) ad.show(host, reward -> events.rewarded()); else events.displayFailed(); }
            public void clear() { cleared = true; if (ad != null) ad.setFullScreenContentCallback(null); ad = null; }
        };
    }

    public boolean prefetchNext() { return false; }
    public void destroy() { destroyed = true; }
}
