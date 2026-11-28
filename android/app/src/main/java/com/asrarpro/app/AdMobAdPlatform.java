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
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAd;
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAdLoadCallback;
import java.util.function.Supplier;

/** Privacy/SDK adapter; the controller can be tested without requesting real ads. */
final class AdMobAdPlatform implements LevelPlayActionAds.Platform {
    private static volatile boolean initialized;
    private final Supplier<Activity> activity;
    private boolean consentChecked;
    private boolean interactive;
    private boolean destroyed;

    private final String serverId;
    private final boolean interstitial;
    AdMobAdPlatform(Supplier<Activity> activity, String serverId) { this(activity, serverId, false); }

    AdMobAdPlatform(Supplier<Activity> activity, String serverId, boolean interstitial) {
        this.activity = activity;
        this.serverId = serverId;
        this.interstitial = interstitial;
    }
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

    /** Blocs récompensés à essayer : « High ecpm » puis le bloc par défaut (démonstration en debug). */
    static String[] rewardedUnits() { return AdUnitChain.units(AdUnitChain.REWARDED, BuildConfig.DEBUG); }

    public LevelPlayActionAds.Ad create(LevelPlayActionAds.Events events) {
        return new LevelPlayActionAds.Ad() {
            private RewardedAd ad;
            private RewardedInterstitialAd interstitialAd;
            private boolean cleared;
            public void load() {
                // Annonce déjà chargée en attente (RewardedPreloader) : prête tout de suite. L'identifiant
                // de vérification serveur de CETTE demande est posé maintenant, avant l'affichage.
                if (!interstitial && !cleared && !destroyed) {
                    RewardedAd preloaded = RewardedPreloader.get().take();
                    if (preloaded != null) {
                        ad = preloaded;
                        ad.setServerSideVerificationOptions(verification());
                        ad.setFullScreenContentCallback(fullscreen());
                        events.loaded();
                        return;
                    }
                }
                AdRequest request = new AdRequest.Builder().build();
                // Bloc « high » d'abord ; s'il ne remplit pas, bloc par défaut ; sinon « no_fill ».
                if (interstitial) {
                    AdUnitChain.run(AdUnitChain.units(AdUnitChain.REWARDED_INTERSTITIAL, BuildConfig.DEBUG), (unit, next) -> {
                        if (cleared || destroyed) return;
                        RewardedInterstitialAd.load(activity.get(), unit, request, new RewardedInterstitialAdLoadCallback() {
                            @Override public void onAdLoaded(RewardedInterstitialAd loaded) {
                                if (cleared || destroyed) return;
                                interstitialAd = loaded;
                                loaded.setServerSideVerificationOptions(verification());
                                loaded.setFullScreenContentCallback(fullscreen());
                                events.loaded();
                            }
                            @Override public void onAdFailedToLoad(LoadAdError error) { next.run(); }
                        });
                    }, this::noFill);
                    return;
                }
                AdUnitChain.run(rewardedUnits(), (unit, next) -> {
                    if (cleared || destroyed) return;
                    RewardedAd.load(activity.get(), unit, request, new RewardedAdLoadCallback() {
                        @Override public void onAdLoaded(RewardedAd loaded) {
                            if (cleared || destroyed) return;
                            ad = loaded;
                            ad.setServerSideVerificationOptions(verification());
                            ad.setFullScreenContentCallback(fullscreen());
                            events.loaded();
                        }
                        @Override public void onAdFailedToLoad(LoadAdError error) { next.run(); }
                    });
                }, this::noFill);
            }
            private void noFill() { if (!cleared && !destroyed) events.loadFailed("no_fill"); }
            private ServerSideVerificationOptions verification() {
                return new ServerSideVerificationOptions.Builder().setCustomData(serverId).build();
            }
            private FullScreenContentCallback fullscreen() {
                return new FullScreenContentCallback() {
                    @Override public void onAdShowedFullScreenContent() { events.displayed(); }
                    @Override public void onAdDismissedFullScreenContent() {
                        events.closed();
                        // Annonce fermée : la suivante se recharge tout de suite, en attente.
                        RewardedPreloader.get().preloadNext();
                    }
                    @Override public void onAdFailedToShowFullScreenContent(AdError error) { events.displayFailed(); }
                };
            }
            public boolean ready() { return (ad != null || interstitialAd != null) && !cleared && !destroyed; }
            public void show(Activity host) {
                if (!ready()) { events.displayFailed(); return; }
                if (interstitialAd != null) interstitialAd.show(host, reward -> events.rewarded());
                else ad.show(host, reward -> events.rewarded());
            }
            public void clear() {
                cleared = true;
                if (ad != null) ad.setFullScreenContentCallback(null);
                if (interstitialAd != null) interstitialAd.setFullScreenContentCallback(null);
                ad = null;
                interstitialAd = null;
            }
        };
    }

    public boolean prefetchNext() { return false; }
    public void destroy() { destroyed = true; }
}
